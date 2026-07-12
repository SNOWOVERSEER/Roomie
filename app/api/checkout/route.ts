import { NextRequest, NextResponse } from "next/server";
import { CATALOG, type CatalogHandle } from "@/lib/catalog";
import { getStripe } from "@/lib/stripe";
import { env } from "@/lib/env";

/*
 * POST /api/checkout —— 创建 Stripe Checkout Session（托管结算页）。
 * 价格一律按 lib/catalog.ts 的 Price ID 服务端 re-derive，
 * 客户端只被信任「买什么、买几个」。
 */

interface InLine {
  handle: CatalogHandle;
  variant?: string;
  qty?: number;
}

export async function POST(req: NextRequest) {
  let body: { lines?: InLine[] };
  try {
    body = (await req.json()) as { lines?: InLine[] };
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const input = (body.lines ?? []).filter(
    (l): l is InLine => !!l && typeof l === "object" && l.handle in CATALOG,
  );
  if (input.length === 0 || input.length > 20) {
    return NextResponse.json({ error: "empty or oversized cart" }, { status: 400 });
  }

  // 规范化：数量 1..9；编号件（猫屋）恒 1
  const lines = input.map((l) => ({
    handle: l.handle,
    variant:
      typeof l.variant === "string" ? l.variant.slice(0, 40) : undefined,
    qty: CATALOG[l.handle].numbered
      ? 1
      : Math.min(9, Math.max(1, Math.round(l.qty ?? 1))),
  }));

  const base = env.publicUrl || req.nextUrl.origin;

  // 购物车快照进 metadata（webhook 写库时的 variant 事实源）；
  // Stripe metadata 值上限 500 字符，超限则置空、webhook 退回 line_items 兜底
  const snapshot = JSON.stringify(
    lines.map((l) => ({ h: l.handle, v: l.variant, q: l.qty })),
  );
  const cartMeta = snapshot.length <= 500 ? snapshot : "";

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      line_items: lines.map((l) => ({
        price: CATALOG[l.handle].stripePriceId,
        quantity: l.qty,
      })),
      shipping_address_collection: { allowed_countries: ["AU"] },
      allow_promotion_codes: true, // 优惠券在 Stripe Dashboard 建（规格决策）
      ...(env.stripeTaxEnabled ? { automatic_tax: { enabled: true } } : {}),
      metadata: { cart: cartMeta },
      success_url: `${base}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/cart`,
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("[checkout] session 创建失败:", e);
    return NextResponse.json(
      { error: "checkout unavailable" },
      { status: 502 },
    );
  }
}
