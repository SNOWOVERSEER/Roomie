import { NextRequest, NextResponse } from "next/server";
import { getCatalogMapFresh, canBuy, shippingCentsFor } from "@/lib/catalog";
import { componentsFor, getStockItemsFresh } from "@/lib/inventory";
import { ARTWORKS } from "@/lib/heroConfig";
import { getStripe } from "@/lib/stripe";
import { env, publicOrigin, PROD_ORIGIN } from "@/lib/env";

/* variant 只可能是画名（白名单校验，非法值剥离）——它会进订单快照与
   邮件模板，绝不能是自由字符串（HTML 注入面）。猫屋编号 variant 待开售时扩。 */
const VALID_VARIANTS = new Set<string>(ARTWORKS.map((a) => a.title));

/*
 * POST /api/checkout —— 创建 Stripe Checkout Session（托管结算页）。
 * 价格一律按 products 表的 price_cents 服务端 re-derive（行项目走
 * price_data 动态生成，见下），客户端只被信任「买什么、买几个」。
 * 库存校验两层：商品级（products.stock，非 BOM 商品）+ 组件级
 * （stock_items，BOM 展开聚合：画框/各画芯）→ 不足或退役 → 409 sold_out。
 */

interface InLine {
  handle: string;
  variant?: string;
  qty?: number;
  /** 客户端当时显示的单价（分）。价格漂移闸门用，见下方 */
  unit_cents?: number;
}

interface InBody {
  lines?: InLine[];
}

export async function POST(req: NextRequest) {
  let body: InBody;
  try {
    body = (await req.json()) as InBody;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  /* 直接问库，不吃渲染路径那层 Data Cache（见 lib/catalog.ts
     getCatalogFresh）——页面上的价格可以旧几分钟，收钱的这一步不行。 */
  const [catalog, stockItems] = await Promise.all([
    getCatalogMapFresh(),
    getStockItemsFresh(),
  ]);
  const input = (body.lines ?? []).filter(
    (l): l is InLine =>
      !!l &&
      typeof l === "object" &&
      typeof l.handle === "string" &&
      catalog.has(l.handle),
  );
  if (input.length === 0 || input.length > 20) {
    return NextResponse.json({ error: "empty or oversized cart" }, { status: 400 });
  }

  // 规范化：数量 1..9；编号件恒 1
  const lines = input.map((l) => {
    const item = catalog.get(l.handle)!;
    return {
      item,
      variant:
        typeof l.variant === "string" && VALID_VARIANTS.has(l.variant)
          ? l.variant
          : undefined,
      qty: item.numbered ? 1 : Math.min(9, Math.max(1, Math.round(l.qty ?? 1))),
      claimedUnitCents: l.unit_cents,
    };
  });

  // 商品级校验（上架 + Stripe 接入 + 非 BOM 商品的 products.stock）
  const qtyByHandle = new Map<string, number>();
  for (const l of lines) {
    qtyByHandle.set(l.item.handle, (qtyByHandle.get(l.item.handle) ?? 0) + l.qty);
  }
  for (const [handle, qty] of qtyByHandle) {
    const item = catalog.get(handle)!;
    if (!canBuy(item) || (item.stock !== null && qty > item.stock)) {
      return NextResponse.json(
        { error: "sold_out", handle, title: item.title },
        { status: 409 },
      );
    }
  }

  // 组件级校验（BOM 展开聚合：一次结算里所有行对同一组件的需求求和）
  const need = new Map<string, number>();
  for (const l of lines) {
    const comps = componentsFor(l.item.handle, l.variant);
    if (!comps) continue;
    for (const c of comps) need.set(c, (need.get(c) ?? 0) + l.qty);
  }
  for (const [id, qty] of need) {
    const unit = stockItems.get(id);
    if (!unit || !unit.available || (unit.stock !== null && qty > unit.stock)) {
      return NextResponse.json(
        { error: "sold_out", component: id, title: unit?.label ?? id },
        { status: 409 },
      );
    }
  }

  /*
   * 价格漂移闸门。渲染路径带缓存（TTL 见 lib/catalog.ts），店主改完价的
   * 头几分钟里客人看到的可能还是旧价。这里对一下，不一致就请他刷新，
   * 而不是闷声按新价扣款。
   *
   * **逐行比单价，不比小计**：服务端会把 qty 归一化（编号件恒 1、钳到
   * 1–9）并剔掉目录里没有的行，拿小计对账会因为这些归一化差异误报，
   * 把真实结算挡在门外——那比不做这个检查更伤。单价不受 qty 影响。
   * 客户端没传（老版本 JS / 直接打 API）就跳过，不因此挡住结算。
   */
  const drifted = lines.filter(
    (l) =>
      typeof l.claimedUnitCents === "number" &&
      l.claimedUnitCents !== l.item.priceCents,
  );
  if (drifted.length > 0) {
    console.warn(
      "[checkout] 价格漂移：",
      drifted
        .map((l) => `${l.item.handle} 客户端 ${l.claimedUnitCents} vs 实际 ${l.item.priceCents}`)
        .join("; "),
    );
    return NextResponse.json({ error: "price_changed" }, { status: 409 });
  }

  // 结算回跳地址：生产上只信 https（NEXT_PUBLIC_URL 误配 localhost 时
  // 退回请求源），本地 dev 照常回 localhost:3000
  const base = publicOrigin(req.nextUrl.origin);

  // 购物车快照进 metadata（webhook 写库时的 variant 事实源）；
  // Stripe metadata 值上限 500 字符，超限则置空、webhook 退回 line_items 兜底
  const snapshot = JSON.stringify(
    lines.map((l) => ({ h: l.item.handle, v: l.variant, q: l.qty })),
  );
  const cartMeta = snapshot.length <= 500 ? snapshot : "";

  // 运费：小计满 AU$188 免运，否则统一 AU$26（只发澳洲；规则见 lib/catalog SHIPPING）
  const subtotalCents = lines.reduce(
    (s, l) => s + l.item.priceCents * l.qty,
    0,
  );
  const shipCents = shippingCentsFor(subtotalCents);

  /* 行项目用 price_data 动态生成而非预建 Price：托管页行名/图要反映
     所选画芯（"The Canvas Scratcher · Wave Light" + 对应画芯白底图），
     固定 Price 做不到（2026-07-21 用户在 live 首单截图指出）。金额仍是
     服务端从 products 表 re-derive，客户端只报 handle/variant/qty。
     products 表的 stripe_price_id 自此不再被结算引用（admin 改价仍维护）。
     图片 host 固定生产域名：Stripe 服务端抓图，localhost 它够不着。 */
  const lineName = (l: (typeof lines)[number]) =>
    l.variant ? `${l.item.title} · ${l.variant}` : l.item.title;
  const lineImage = (l: (typeof lines)[number]) => {
    const i = l.variant
      ? ARTWORKS.findIndex((a) => a.title === l.variant)
      : -1;
    const path = i >= 0 ? `/c01/print-0${i + 1}.webp` : l.item.image;
    return path ? `${PROD_ORIGIN}${path}` : null;
  };

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      line_items: lines.map((l) => {
        const img = lineImage(l);
        return {
          quantity: l.qty,
          price_data: {
            currency: "aud",
            unit_amount: l.item.priceCents,
            // 未注册 GST 期间 automatic_tax 关着，此字段无感；注册后开税时必需
            tax_behavior: "inclusive",
            product_data: {
              name: lineName(l),
              ...(img ? { images: [img] } : {}),
              metadata: { roomie_handle: l.item.handle },
            },
          },
        };
      }),
      shipping_address_collection: { allowed_countries: ["AU"] },
      shipping_options: [
        {
          shipping_rate_data: {
            type: "fixed_amount",
            display_name:
              shipCents === 0 ? "Free shipping" : "Standard shipping (AU)",
            fixed_amount: { amount: shipCents, currency: "aud" },
            delivery_estimate: {
              minimum: { unit: "business_day", value: 2 },
              maximum: { unit: "business_day", value: 8 },
            },
          },
        },
      ],
      allow_promotion_codes: true, // 优惠券在 Stripe Dashboard 建（规格决策）
      /* 店主未注册 GST（2026-07-21）：注册前 STRIPE_TAX_ENABLED 不得开，
         站内也不出现任何 GST 字样 */
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
