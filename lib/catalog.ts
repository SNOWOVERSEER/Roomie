import { getSupabaseAdmin, type ProductRow } from "./supabase-admin";

/*
 * 商品唯一事实源 = Supabase products 表（admin-platform，2026-07-13 起）。
 * 本模块是主站读取入口（仅服务端）；写入只发生在本地 admin 后台。
 * stock 语义：null = 不限量；0 = 售罄；服务端结算一律从这里 re-derive，
 * 绝不信任客户端传来的价格。
 */

export interface CatalogItem {
  handle: string;
  title: string;
  tagline: string;
  priceCents: number;
  image: string;
  stripeProductId: string | null;
  stripePriceId: string | null;
  stock: number | null;
  available: boolean;
  numbered: boolean;
  sort: number;
}

const fromRow = (r: ProductRow): CatalogItem => ({
  handle: r.handle,
  title: r.title,
  tagline: r.tagline,
  priceCents: r.price_cents,
  image: r.image,
  stripeProductId: r.stripe_product_id,
  stripePriceId: r.stripe_price_id,
  stock: r.stock,
  available: r.available,
  numbered: r.numbered,
  sort: r.sort,
});

/** 全量商品（含未上架），sort 升序。DB 不可达时抛错 → 页面 error boundary。 */
export async function getCatalog(): Promise<CatalogItem[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("products")
    .select("*")
    .order("sort", { ascending: true });
  if (error) throw new Error(`products 读取失败: ${error.message}`);
  return (data as ProductRow[]).map(fromRow);
}

export async function getCatalogMap(): Promise<Map<string, CatalogItem>> {
  return new Map((await getCatalog()).map((i) => [i.handle, i]));
}

export const isSoldOut = (i: CatalogItem): boolean =>
  i.stock !== null && i.stock <= 0;

/** 可购 = 上架 + 已接 Stripe + 未售罄（checkout 的唯一判定） */
export const canBuy = (i: CatalogItem): boolean =>
  i.available && !!i.stripePriceId && !isSoldOut(i);

export const formatCents = (cents: number) =>
  `AU$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;

/*
 * 运费规则（单一事实源；购物车/抽屉/结算/文档都从这里读）：
 * 只发澳洲；统一 AU$26，商品小计满 AU$188 免运。
 */
export const SHIPPING = {
  flatCents: 2600,
  freeOverCents: 18800,
} as const;

export const shippingCentsFor = (subtotalCents: number): number =>
  subtotalCents >= SHIPPING.freeOverCents ? 0 : SHIPPING.flatCents;
