import { randomInt } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { env } from "@/lib/env";
import { getSupabaseAdmin, type OrderItem, type OrderRow } from "@/lib/supabase-admin";
import { sendOrderConfirmation } from "@/lib/email";
import { CATALOG_TAG, formatCents, getCatalogMap } from "@/lib/catalog";
import { componentsFor } from "@/lib/inventory";

/*
 * POST /api/webhook —— Stripe 事件入口（生产 endpoint 由
 * scripts/stripe-setup.mjs 创建；本地用 `stripe listen` 转发）。
 *
 * 幂等：orders.stripe_session_id 唯一 + upsert ignoreDuplicates，
 * Stripe 重投同一事件不会重复写库/重复发信。
 * 失败语义：写库失败 → 500（让 Stripe 重试）；邮件失败只记日志。
 */

export const maxDuration = 30; // 规格：webhook 函数超时 30s

export async function POST(req: NextRequest) {
  if (!env.stripeWebhookSecret) {
    return NextResponse.json(
      { error: "webhook not configured" },
      { status: 503 },
    );
  }

  const raw = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      raw,
      sig,
      env.stripeWebhookSecret,
    );
  } catch {
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object;
      // Afterpay 等异步支付 completed 时可能还未扣款成功——只记已付的
      if (session.payment_status === "paid") await recordOrder(session);
      break;
    }
    case "checkout.session.async_payment_failed":
      console.warn("[webhook] 异步支付失败:", event.data.object.id);
      break;
    // 退款同步（含 Stripe Dashboard 手工退款）：refunded_cents 永远写
    // charge.amount_refunded 权威累计值。按增量判断幂等：admin 侧退款自己
    // 先写了 DB（增量为 0），这里只补记「外部发起」的退款流水——
    // 时间线/Activity 才看得见 Dashboard 手工退款（店主反馈 07-15）。
    case "charge.refunded": {
      const charge = event.data.object;
      const pi =
        typeof charge.payment_intent === "string"
          ? charge.payment_intent
          : (charge.payment_intent?.id ?? null);
      if (pi) {
        const { data: row, error: readErr } = await getSupabaseAdmin()
          .from("orders")
          .select("id, refunded_cents")
          .eq("stripe_payment_intent_id", pi)
          .maybeSingle();
        if (readErr) {
          return NextResponse.json({ error: "sync read failed" }, { status: 500 });
        }
        if (!row) {
          console.warn("[webhook] 退款同步：找不到订单", pi);
          break;
        }
        const delta = charge.amount_refunded - row.refunded_cents;
        if (delta <= 0) break; // 已是最新（重投/admin 已记）
        const { error } = await getSupabaseAdmin()
          .from("orders")
          .update({ refunded_cents: charge.amount_refunded })
          .eq("id", row.id);
        if (error) {
          // 让 Stripe 重试，避免退款额漂移
          return NextResponse.json({ error: "sync failed" }, { status: 500 });
        }
        const { error: evErr } = await getSupabaseAdmin()
          .from("order_events")
          .insert({
            order_id: row.id,
            type: "refund",
            message: `Refunded ${formatCents(delta)} (Stripe)`,
            data: { cents: delta, stripe_event_id: event.id },
          });
        if (evErr) console.error("[webhook] 退款流水写入失败:", evErr.message);
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}

/** 客户可见订单号：6 位纯数字随机（用户定稿：无前缀）。
    非顺序 = 不暴露销量/增速；内部对账仍有自增 order_number */
const newOrderRef = () => String(randomInt(100000, 1000000));

async function recordOrder(session: Stripe.Checkout.Session) {
  const items = await itemsFromSession(session);
  const shipping = session.collected_information?.shipping_details ?? null;

  const row = {
    stripe_session_id: session.id,
    stripe_payment_intent_id:
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : (session.payment_intent?.id ?? null),
    email: session.customer_details?.email ?? "unknown",
    customer_name: session.customer_details?.name ?? null,
    shipping_address: shipping
      ? { name: shipping.name, ...shipping.address }
      : null,
    items,
    amount_total: session.amount_total ?? 0,
    shipping_cents: session.shipping_cost?.amount_total ?? 0,
    currency: session.currency ?? "aud",
    status: "paid" as const,
  };

  // order_ref 随机 5 位，撞唯一约束就换号重试（90k 空间，MVP 量级足够）
  for (let attempt = 0; ; attempt++) {
    const { data, error } = await getSupabaseAdmin()
      .from("orders")
      .upsert(
        { ...row, order_ref: newOrderRef() },
        { onConflict: "stripe_session_id", ignoreDuplicates: true },
      )
      .select();

    if (!error) {
      const inserted = (data ?? [])[0] as OrderRow | undefined;
      if (inserted) {
        // 原子扣库存（重复事件走不到这里）：BOM 商品按组件展开扣
        // stock_items，非 BOM 商品扣 products.stock。RPC 只影响
        // stock 非 null 的跟踪行。
        for (const it of inserted.items) {
          const comps = componentsFor(it.handle, it.variant);
          if (comps) {
            for (const c of comps) {
              const { error: decErr } = await getSupabaseAdmin().rpc(
                "decrement_stock_item",
                { p_id: c, p_qty: it.qty },
              );
              if (decErr) {
                console.error("[webhook] 扣组件库存失败:", c, decErr.message);
              }
            }
          } else {
            const { error: decErr } = await getSupabaseAdmin().rpc(
              "decrement_stock",
              { p_handle: it.handle, p_qty: it.qty },
            );
            if (decErr) {
              console.error("[webhook] 扣库存失败:", it.handle, decErr.message);
            }
          }
        }
        /* 库存刚变，让渲染路径的 Data Cache 立刻作废（见 lib/catalog.ts）。
           不这么做的话，售罄状态最长会滞后一个 TTL 才反映到站上。 */
        revalidateTag(CATALOG_TAG);
        await sendOrderConfirmation(inserted); // 内部吞错，邮件不阻断订单
      } else {
        console.log("[webhook] 重复事件，订单已存在:", session.id);
      }
      return;
    }
    const refCollision =
      error.code === "23505" && error.message.includes("order_ref");
    if (!refCollision || attempt >= 4) {
      throw new Error(`orders 写入失败: ${error.message}`);
    }
  }
}

/** 商品行：优先 metadata.cart（带画芯/编号 variant），退回 Stripe line_items */
async function itemsFromSession(
  session: Stripe.Checkout.Session,
): Promise<OrderItem[]> {
  try {
    const cart = JSON.parse(session.metadata?.cart ?? "") as {
      h: string;
      v?: string;
      q?: number;
    }[];
    if (Array.isArray(cart) && cart.length > 0) {
      const catalog = await getCatalogMap();
      const known = cart.filter((c) => catalog.has(c.h));
      if (known.length > 0) {
        return known.map((c) => {
          const item = catalog.get(c.h)!;
          return {
            handle: item.handle,
            title: item.title,
            variant: c.v || undefined,
            qty: Math.max(1, c.q ?? 1),
            unit_cents: item.priceCents,
          };
        });
      }
    }
  } catch {
    /* 快照缺失/超限 → 兜底 */
  }
  const li = await getStripe().checkout.sessions.listLineItems(session.id, {
    limit: 100,
  });
  return li.data.map((d) => ({
    handle: "unknown",
    title: d.description ?? "Item",
    qty: d.quantity ?? 1,
    unit_cents: Math.round((d.amount_total ?? 0) / (d.quantity || 1)),
  }));
}
