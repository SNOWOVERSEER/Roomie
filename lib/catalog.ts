import { cache } from "react";
import { unstable_cache } from "next/cache";
import { readOrDegrade } from "./degrade";
import {
  getSupabaseAdmin,
  retryOnClockSkew,
  type ProductRow,
} from "./supabase-admin";

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
  sellable: boolean;
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
  sellable: r.sellable,
  numbered: r.numbered,
  sort: r.sort,
});

async function readProducts(): Promise<CatalogItem[]> {
  const { data, error } = await retryOnClockSkew(() =>
    getSupabaseAdmin()
      .from("products")
      .select("*")
      .order("sort", { ascending: true }),
  );
  if (error) throw new Error(`products 读取失败: ${error.message}`);
  return (data as ProductRow[]).map(fromRow);
}

/**
 * 跨请求缓存（Vercel Data Cache，**跨实例共享且持久**——这正是它比
 * lib/degrade.ts 那个进程内 lastGood 强的地方：冷实例也命中）。
 *
 * 为什么要缓存：站点 force-dynamic，从前每一次渲染都现查两张表，而这
 * 两张表一周才改两次。每次往返都是一次撞上 JWT 抖动的机会，也是冷进入
 * 的主要延迟来源（见 HANDOVER §9.4）。
 *
 * 抛错不入缓存（Data Cache 只存成功结果），所以一次瞬时 401 不会被
 * 固化成几分钟的坏数据。TTL 只是兜底：写路径都会按 tag 主动失效，
 * 唯一漏网的是有人直接在 Supabase 面板改行，那种情况 TTL 内自愈。
 */
export const CATALOG_TAG = "roomie-catalog";
const CATALOG_TTL_SECONDS = 300;

const cachedProducts = unstable_cache(readProducts, ["products"], {
  tags: [CATALOG_TAG],
  revalidate: CATALOG_TTL_SECONDS,
});

/**
 * 全量商品（含未上架），sort 升序。DB 不可达时抛错 → 调用方决定降级。
 *
 * 外面那层 `cache()` = React 的**单次请求内**记忆化。首页一次渲染里
 * layout/page/CanvasCollection/TheShelf/FinalCta 各自要一份目录，去重前
 * products 被打 5 次、stock_items 4 次 —— 9 次往返就是 9 次撞上瞬时故障
 * 的机会（也是 07-27 那次 500 的放大器）。去重后每次渲染各 1 次，再经
 * 上面的 Data Cache，绝大多数渲染一次网络都不发。
 * 写库不走这两个读函数（webhook 扣库存用 RPC），不存在读到自己写前快照。
 */
export const getCatalog = cache(
  (): Promise<CatalogItem[]> => cachedProducts(),
);

export async function getCatalogMap(): Promise<Map<string, CatalogItem>> {
  return new Map((await getCatalog()).map((i) => [i.handle, i]));
}

/**
 * 渲染路径用：读不到返回 null（= 未知，不是空）。见 lib/degrade.ts。
 * 结算/webhook/admin 继续用上面会抛错的版本。
 */
export const getCatalogSafe = cache(
  async (): Promise<CatalogItem[] | null> =>
    readOrDegrade("products", getCatalog),
);

export async function getCatalogMapSafe(): Promise<Map<
  string,
  CatalogItem
> | null> {
  const rows = await getCatalogSafe();
  return rows && new Map(rows.map((i) => [i.handle, i]));
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
 *
 * 多档模型已定稿（2026-07-19 店主拍板，首个大件 SKU 进库时才动手，
 * 口径全文见 HANDOVER §7）：每商品自带运费值（products 表字段），
 * 订单运费取最高那一件（max，不叠加）；188 免邮只对纯标准件订单生效，
 * 含大件订单不参与。实现时把本常量升级为 quoteShipping(items) 单点函数。
 * 站点话术已按此收敛：品牌层不出现 26/188，只在购买流程事实层与政策页。
 */
export const SHIPPING = {
  flatCents: 2600,
  freeOverCents: 18800,
} as const;

export const shippingCentsFor = (subtotalCents: number): number =>
  subtotalCents >= SHIPPING.freeOverCents ? 0 : SHIPPING.flatCents;
