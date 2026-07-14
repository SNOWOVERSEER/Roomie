"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { assertAuth } from "@/lib/auth";
import {
  sendCancellation,
  sendCustomerNote,
  sendOrderConfirmation,
  sendRefundNotice,
  sendReturnInstructions,
  sendShippingNotice,
} from "../../lib/email";
import { componentsFor } from "../../lib/inventory";
import { formatCents, type OrderRow } from "@/lib/types";

type Result = { ok: true } | { error: string };

/*
 * 订单生命周期 actions（admin 直连 Supabase + Stripe + Resend，零 Vercel 依赖，
 * 与发货同一决策：生产挂了也能干活）。
 *
 * 设计要点（spec 2026-07-14）：
 * - 退款先行：cancel / mark returned 里 Stripe 退款失败则整个动作不落库，
 *   绝不出现「已取消但钱没退」的状态。
 * - refunded_cents 永远回读 Stripe charge.amount_refunded 权威累计值，
 *   与 webhook 的 charge.refunded 同步天然幂等。
 * - 邮件失败不回滚业务变更（沿用发货语义），返回 warning 文案给店主。
 * - 里程碑时间戳都在 orders 列上；order_events 只记列装不下的流水
 *   （退款/邮件/回补/撤销退货），写入失败只记日志不阻断。
 */

const TRACK_URL: Record<string, (n: string) => string> = {
  auspost: (n) => `https://auspost.com.au/mypost/track/#/details/${n}`,
  sendle: (n) => `https://track.sendle.com/tracking?ref=${n}`,
};

export type RefundReason = "requested_by_customer" | "duplicate" | "fraudulent";
const REFUND_REASONS = new Set(["requested_by_customer", "duplicate", "fraudulent"]);

async function getOrder(orderRef: string): Promise<OrderRow | null> {
  const { data } = await db()
    .from("orders")
    .select("*")
    .eq("order_ref", orderRef)
    .maybeSingle();
  return (data as OrderRow) ?? null;
}

/** 事件流水，尽力而为：失败只记日志，绝不让主动作跟着失败 */
async function logEvent(
  orderId: string,
  type: "refund" | "email" | "restock" | "return_cancelled",
  message: string,
  data: Record<string, unknown> = {},
) {
  const { error } = await db()
    .from("order_events")
    .insert({ order_id: orderId, type, message, data });
  if (error) console.error("[admin] order_events 写入失败:", error.message);
}

/** 邮件结果 → 事件 + warning 文案（actionDone 形如 "cancelled"） */
async function afterEmail(
  order: OrderRow,
  mail: { skipped: boolean; error?: string; id?: string },
  kind: string,
  subject: string,
  actionDone: string,
): Promise<Result> {
  if (mail.error) {
    return { error: `${actionDone}, but the email failed: ${mail.error}` };
  }
  if (mail.skipped) {
    return {
      error: `${actionDone}, but no email was sent (RESEND_API_KEY missing)`,
    };
  }
  await logEvent(order.id, "email", `Email sent: ${subject}`, { kind });
  return { ok: true };
}

/**
 * 回补库存（取消/退货收货）：BOM 商品按组件展开，其余走商品级。
 * RPC 只影响 stock 非 null 的跟踪行；不限量的行天然跳过。
 */
async function restockOrder(order: OrderRow): Promise<string[]> {
  const restocked: string[] = [];
  for (const it of order.items) {
    const comps = componentsFor(it.handle, it.variant);
    if (comps) {
      for (const c of comps) {
        const { error } = await db().rpc("restock_item", { p_id: c, p_qty: it.qty });
        if (error) console.error("[admin] 回补组件失败:", c, error.message);
        else restocked.push(`${c} ×${it.qty}`);
      }
    } else {
      const { error } = await db().rpc("restock_product", {
        p_handle: it.handle,
        p_qty: it.qty,
      });
      if (error) console.error("[admin] 回补商品失败:", it.handle, error.message);
      else restocked.push(`${it.handle} ×${it.qty}`);
    }
  }
  if (restocked.length > 0) {
    await logEvent(order.id, "restock", `Restocked ${restocked.join(", ")}`, {
      units: restocked,
    });
  }
  return restocked;
}

/** Stripe 退款 + 回读权威累计退款额 */
async function stripeRefund(
  order: OrderRow,
  cents: number,
  reason?: RefundReason,
): Promise<{ refundId: string; totalRefunded: number } | { error: string }> {
  const pi = order.stripe_payment_intent_id;
  if (!pi) {
    return {
      error: "no payment intent on file for this order. Refund it in the Stripe dashboard instead",
    };
  }
  try {
    const refund = await stripe().refunds.create({
      payment_intent: pi,
      amount: cents,
      ...(reason ? { reason } : {}),
    });
    const intent = await stripe().paymentIntents.retrieve(pi, {
      expand: ["latest_charge"],
    });
    const charge = intent.latest_charge;
    const totalRefunded =
      charge && typeof charge === "object"
        ? charge.amount_refunded
        : order.refunded_cents + cents;
    return { refundId: refund.id, totalRefunded };
  } catch (e) {
    return { error: `Stripe: ${e instanceof Error ? e.message : "refund failed"}` };
  }
}

function refresh() {
  revalidatePath("/orders");
  revalidatePath("/customers");
  revalidatePath("/");
}

/* ―――――――――――――― 履约主线 ―――――――――――――― */

export async function shipOrder(
  orderRef: string,
  trackingNumber: string,
  carrier: string,
): Promise<Result> {
  await assertAuth();
  const tracking = trackingNumber.trim();
  if (!tracking) return { error: "tracking number required" };

  const c = carrier.trim().toLowerCase();
  const trackingUrl = c && TRACK_URL[c] ? TRACK_URL[c](tracking) : null;

  const { data, error } = await db()
    .from("orders")
    .update({
      status: "shipped",
      tracking_number: tracking,
      tracking_url: trackingUrl,
      carrier: c || null,
      shipped_at: new Date().toISOString(),
    })
    .eq("order_ref", orderRef)
    .eq("status", "paid")
    .select()
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { error: "order not found (or not in To ship)" };

  const order = data as OrderRow;
  const mail = await sendShippingNotice(order);
  refresh();
  return afterEmail(order, mail, "shipping", "shipping notice", "shipped");
}

export async function markDelivered(orderRef: string): Promise<Result> {
  await assertAuth();
  const { data, error } = await db()
    .from("orders")
    .update({ status: "delivered", delivered_at: new Date().toISOString() })
    .eq("order_ref", orderRef)
    .eq("status", "shipped")
    .select("order_ref")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "order not found (or not in Shipped)" };
  refresh();
  return { ok: true };
}

/* ―――――――――――――― 退单（取消） ―――――――――――――― */

export async function cancelOrder(
  orderRef: string,
  restock: boolean,
): Promise<Result> {
  await assertAuth();
  const order = await getOrder(orderRef);
  if (!order) return { error: "order not found" };
  if (order.status !== "paid") {
    return { error: "only orders in To ship can be cancelled (use returns instead)" };
  }

  // 退款先行：失败则整个取消不发生
  const remaining = order.amount_total - order.refunded_cents;
  let refundId: string | null = null;
  let totalRefunded = order.refunded_cents;
  if (remaining > 0) {
    const r = await stripeRefund(order, remaining, "requested_by_customer");
    if ("error" in r) return { error: r.error };
    refundId = r.refundId;
    totalRefunded = r.totalRefunded;
  }

  const { data, error } = await db()
    .from("orders")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      refunded_cents: totalRefunded,
    })
    .eq("order_ref", orderRef)
    .select()
    .maybeSingle();
  if (error || !data) {
    // 已退款但状态没写上——极端情形，把实情交给店主处理
    return {
      error: `refund ${refundId ?? "n/a"} issued but the status update failed: ${error?.message ?? "order vanished"}. Fix manually`,
    };
  }
  const updated = data as OrderRow;

  if (refundId) {
    await logEvent(updated.id, "refund", `Refunded ${formatCents(remaining)} (cancellation)`, {
      cents: remaining,
      refund_id: refundId,
    });
  }
  if (restock) await restockOrder(updated);

  const mail = await sendCancellation(updated, remaining > 0 ? remaining : 0);
  refresh();
  return afterEmail(updated, mail, "cancellation", "cancellation notice", "cancelled");
}

/* ―――――――――――――― 退款（部分/全额） ―――――――――――――― */

export async function refundOrder(
  orderRef: string,
  cents: number,
  reason: string,
): Promise<Result> {
  await assertAuth();
  const order = await getOrder(orderRef);
  if (!order) return { error: "order not found" };

  const remaining = order.amount_total - order.refunded_cents;
  if (!Number.isInteger(cents) || cents < 1) return { error: "bad amount" };
  if (cents > remaining) {
    return { error: `amount exceeds what's left to refund (${formatCents(remaining)})` };
  }
  const why = REFUND_REASONS.has(reason) ? (reason as RefundReason) : undefined;

  const r = await stripeRefund(order, cents, why);
  if ("error" in r) return { error: r.error };

  const { data, error } = await db()
    .from("orders")
    .update({ refunded_cents: r.totalRefunded })
    .eq("order_ref", orderRef)
    .select()
    .maybeSingle();
  if (error || !data) {
    return {
      error: `refund ${r.refundId} issued but the record update failed: ${error?.message ?? "order vanished"}. Fix manually`,
    };
  }
  const updated = data as OrderRow;
  await logEvent(updated.id, "refund", `Refunded ${formatCents(cents)}`, {
    cents,
    refund_id: r.refundId,
    reason: why ?? null,
  });

  const mail = await sendRefundNotice(updated, cents);
  refresh();
  return afterEmail(updated, mail, "refund", "refund notice", "refunded");
}

/* ―――――――――――――― 退货流 ―――――――――――――― */

export async function requestReturn(
  orderRef: string,
  reason: string,
  emailInstructions: boolean,
  note: string,
): Promise<Result> {
  await assertAuth();
  const order = await getOrder(orderRef);
  if (!order) return { error: "order not found" };
  if (order.status !== "shipped" && order.status !== "delivered") {
    return { error: "returns start from Shipped or Delivered" };
  }

  const { data, error } = await db()
    .from("orders")
    .update({
      status: "return_requested",
      return_requested_at: new Date().toISOString(),
      return_reason: reason.trim() || null,
    })
    .eq("order_ref", orderRef)
    .select()
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "order not found" };
  const updated = data as OrderRow;

  if (!emailInstructions) {
    refresh();
    return { ok: true };
  }
  const mail = await sendReturnInstructions(updated, note.trim() || undefined);
  refresh();
  return afterEmail(updated, mail, "return", "return instructions", "return started");
}

export async function cancelReturn(orderRef: string): Promise<Result> {
  await assertAuth();
  const order = await getOrder(orderRef);
  if (!order) return { error: "order not found" };
  if (order.status !== "return_requested") {
    return { error: "no return in progress on this order" };
  }
  const back = order.delivered_at ? "delivered" : "shipped";
  const { error } = await db()
    .from("orders")
    .update({ status: back, return_requested_at: null, return_reason: null })
    .eq("order_ref", orderRef);
  if (error) return { error: error.message };
  await logEvent(order.id, "return_cancelled", `Return cancelled, back to ${back}`);
  refresh();
  return { ok: true };
}

export async function markReturned(
  orderRef: string,
  refundCents: number | null,
  restock: boolean,
): Promise<Result> {
  await assertAuth();
  const order = await getOrder(orderRef);
  if (!order) return { error: "order not found" };
  if (order.status !== "return_requested") {
    return { error: "start the return first" };
  }

  // 可选同时退款——失败则收货动作整体不发生
  const remaining = order.amount_total - order.refunded_cents;
  let refundId: string | null = null;
  let totalRefunded = order.refunded_cents;
  if (refundCents !== null) {
    if (!Number.isInteger(refundCents) || refundCents < 1) {
      return { error: "bad refund amount" };
    }
    if (refundCents > remaining) {
      return { error: `amount exceeds what's left to refund (${formatCents(remaining)})` };
    }
    const r = await stripeRefund(order, refundCents, "requested_by_customer");
    if ("error" in r) return { error: r.error };
    refundId = r.refundId;
    totalRefunded = r.totalRefunded;
  }

  const { data, error } = await db()
    .from("orders")
    .update({
      status: "returned",
      returned_at: new Date().toISOString(),
      refunded_cents: totalRefunded,
    })
    .eq("order_ref", orderRef)
    .select()
    .maybeSingle();
  if (error || !data) {
    return {
      error: refundId
        ? `refund ${refundId} issued but the status update failed: ${error?.message ?? "order vanished"}. Fix manually`
        : (error?.message ?? "order not found"),
    };
  }
  const updated = data as OrderRow;

  if (refundId && refundCents !== null) {
    await logEvent(updated.id, "refund", `Refunded ${formatCents(refundCents)} (return)`, {
      cents: refundCents,
      refund_id: refundId,
    });
  }
  if (restock) await restockOrder(updated);

  if (refundCents !== null) {
    const mail = await sendRefundNotice(updated, refundCents);
    refresh();
    return afterEmail(updated, mail, "refund", "refund notice", "marked returned");
  }
  refresh();
  return { ok: true };
}

/* ―――――――――――――― 备注与客户沟通 ―――――――――――――― */

export async function saveNote(orderRef: string, note: string): Promise<Result> {
  await assertAuth();
  const trimmed = note.trim();
  if (trimmed.length > 2000) return { error: "note too long (2000 max)" };
  const { data, error } = await db()
    .from("orders")
    .update({ admin_note: trimmed || null })
    .eq("order_ref", orderRef)
    .select("order_ref")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "order not found" };
  revalidatePath("/orders");
  return { ok: true };
}

export async function emailCustomer(
  orderRef: string,
  subject: string,
  message: string,
): Promise<Result> {
  await assertAuth();
  const s = subject.trim();
  const m = message.trim();
  if (s.length < 2 || s.length > 120) return { error: "subject length 2 to 120" };
  if (m.length < 2 || m.length > 5000) return { error: "message length 2 to 5000" };
  const order = await getOrder(orderRef);
  if (!order) return { error: "order not found" };

  const mail = await sendCustomerNote(order, s, m);
  if (mail.error) return { error: `email failed: ${mail.error}` };
  if (mail.skipped) return { error: "email not configured (RESEND_API_KEY missing)" };
  await logEvent(order.id, "email", `Email sent: ${s}`, { kind: "custom", subject: s });
  revalidatePath("/orders");
  return { ok: true };
}

export async function resendConfirmation(orderRef: string): Promise<Result> {
  await assertAuth();
  const order = await getOrder(orderRef);
  if (!order) return { error: "order not found" };
  const mail = await sendOrderConfirmation(order);
  if (mail.error) return { error: `email failed: ${mail.error}` };
  if (mail.skipped) return { error: "email not configured (RESEND_API_KEY missing)" };
  await logEvent(order.id, "email", "Confirmation email re-sent", { kind: "confirmation" });
  revalidatePath("/orders");
  return { ok: true };
}

export async function resendShippingEmail(orderRef: string): Promise<Result> {
  await assertAuth();
  const order = await getOrder(orderRef);
  if (!order) return { error: "order not found" };
  if (!order.tracking_number) return { error: "no tracking on this order yet" };
  const mail = await sendShippingNotice(order);
  if (mail.error) return { error: `email failed: ${mail.error}` };
  if (mail.skipped) return { error: "email not configured (RESEND_API_KEY missing)" };
  await logEvent(order.id, "email", "Shipping email re-sent", { kind: "shipping" });
  revalidatePath("/orders");
  return { ok: true };
}
