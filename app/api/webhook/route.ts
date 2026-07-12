import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { env } from "@/lib/env";
import { getSupabaseAdmin, type OrderItem, type OrderRow } from "@/lib/supabase-admin";
import { sendOrderConfirmation } from "@/lib/email";
import { CATALOG, type CatalogHandle } from "@/lib/catalog";

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
  }

  return NextResponse.json({ received: true });
}

async function recordOrder(session: Stripe.Checkout.Session) {
  const items = await itemsFromSession(session);
  const shipping = session.collected_information?.shipping_details ?? null;

  const { data, error } = await getSupabaseAdmin()
    .from("orders")
    .upsert(
      {
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
        currency: session.currency ?? "aud",
        status: "paid",
      },
      { onConflict: "stripe_session_id", ignoreDuplicates: true },
    )
    .select();

  if (error) throw new Error(`orders 写入失败: ${error.message}`);

  const inserted = (data ?? [])[0] as OrderRow | undefined;
  if (inserted) {
    await sendOrderConfirmation(inserted); // 内部吞错——邮件不阻断订单
  } else {
    console.log("[webhook] 重复事件，订单已存在:", session.id);
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
      return cart
        .filter((c) => c.h in CATALOG)
        .map((c) => {
          const item = CATALOG[c.h as CatalogHandle];
          return {
            handle: item.handle,
            title: item.title,
            variant: c.v || undefined,
            qty: Math.max(1, c.q ?? 1),
            unit_cents: item.priceCents,
          };
        });
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
