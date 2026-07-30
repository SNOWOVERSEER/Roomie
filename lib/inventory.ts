import { cache } from "react";
import { unstable_cache } from "next/cache";
import { readOrDegrade } from "./degrade";
import { getSupabaseAdmin, retryOnClockSkew } from "./supabase-admin";
import { ARTWORKS } from "./heroConfig";
import {
  CATALOG_TAG,
  CATALOG_TTL_SECONDS,
  getCatalogSafe,
  isSoldOut,
  type CatalogItem,
} from "./catalog";
import type { CartSnapshot } from "./cartTypes";

/*
 * 组件库存（BOM）：备货单位 = 画框 ×1 + 画芯 ×6（stock_items 表），
 * 商品可售性由组件组合决定（R1 修订，用户定义的规则）：
 *   Frame+print·画X 可买 = 画框可买 ∧ 画X 可买
 *   Print only·画X 可买 = 画X 可买
 * 画芯另有「退役」（available=false，seasonal drops）：购买动线里彻底
 * 消失；hero 换画交互是品牌艺术层，不过滤。
 * 仅服务端 import（依赖 service key）。
 */

export interface StockItem {
  id: string;
  label: string;
  /** null = 不限量/不跟踪；0 = 售罄；负数 = 并发竞态（admin 警报） */
  stock: number | null;
  available: boolean;
  sort: number;
}

/** 前台低库存标注阈值（用户定：低于 10 件标 low stock） */
export const LOW_STOCK_AT = 10;

async function readStockItems(): Promise<StockItem[]> {
  const { data, error } = await retryOnClockSkew(() =>
    getSupabaseAdmin()
      .from("stock_items")
      .select("id,label,stock,available,sort")
      .order("sort", { ascending: true }),
  );
  if (error) throw new Error(`stock_items 读取失败: ${error.message}`);
  return data as StockItem[];
}

/* 缓存的是**数组**，不是 Map —— Data Cache 要序列化结果，Map 进去出来
   会变成空对象。Map 在缓存外面现建，成本可忽略。缓存语义同 catalog。 */
const cachedStockItems = unstable_cache(readStockItems, ["stock-items"], {
  tags: [CATALOG_TAG],
  revalidate: CATALOG_TTL_SECONDS,
});

/** 单次请求内记忆化 + 跨请求 Data Cache，理由同 getCatalog（lib/catalog.ts）。 */
export const getStockItems = cache(
  async (): Promise<Map<string, StockItem>> =>
    new Map((await cachedStockItems()).map((i) => [i.id, i])),
);

/** 权威读取：绕过 Data Cache，结算专用。理由见 lib/catalog.ts 同名函数。 */
export const getStockItemsFresh = cache(
  async (): Promise<Map<string, StockItem>> =>
    new Map((await readStockItems()).map((i) => [i.id, i])),
);

export const itemBuyable = (i?: StockItem): boolean =>
  !!i && i.available && (i.stock === null || i.stock > 0);

export const itemLow = (i?: StockItem): boolean =>
  !!i &&
  i.available &&
  i.stock !== null &&
  i.stock > 0 &&
  i.stock < LOW_STOCK_AT;

/** 画名（ARTWORKS.title，购物行 variant）→ 库存单元 id */
export function printIdFor(variantTitle?: string): string | null {
  const i = ARTWORKS.findIndex((a) => a.title === variantTitle);
  return i >= 0 ? `print-0${i + 1}` : null;
}

/**
 * 一条购物行消耗的库存单元（BOM 展开）。
 * 返回 null = 非 BOM 商品（可售性走 products.stock 商品级判定）。
 */
export function componentsFor(
  handle: string,
  variant?: string,
): string[] | null {
  const printId = printIdFor(variant);
  if (handle === "canvas-scratcher") {
    return printId ? ["frame", printId] : ["frame"];
  }
  if (handle === "canvas-print") {
    return printId ? [printId] : [];
  }
  return null;
}

/** landing 入口/购物车快照用的商品状态一览（一次拉齐两表） */
export interface ProductStatus {
  offSale: boolean;
  soldOut: boolean;
  priceCents: number;
}

/** 渲染路径用：读不到返回 null（= 未知）。见 lib/degrade.ts。 */
export const getStockItemsSafe = cache(
  async (): Promise<Map<string, StockItem> | null> =>
    readOrDegrade("stock_items", getStockItems),
);

/**
 * root layout 用：把购物车要的东西一次聚好。
 *
 * layout **刻意不 await 它**，而是把 promise 传给 CartProvider —— 一旦
 * await，整棵树都要等 Supabase 回来才能吐出第一个字节，那正是「冷进入
 * 几秒白屏」的成因（实测 TTFB 18ms 而 HTML 主体流了 2.4s）。
 */
export async function getCartSnapshot(): Promise<CartSnapshot> {
  const [rows, items] = await Promise.all([
    getCatalogSafe(),
    getStockItemsSafe(),
  ]);
  return {
    catalog: (rows ?? [])
      .filter((i) => i.available)
      .map((i) => ({
        handle: i.handle,
        title: i.title,
        priceCents: i.priceCents,
        image: i.image,
        numbered: i.numbered,
        // 库存未知时不冤枉成售罄；可售性与金额服务端还会 re-derive
        soldOut: items ? productSoldOut(i, items) : false,
      })),
    catalogUnknown: rows === null,
    degraded: rows === null || items === null,
  };
}

/**
 * landing 各入口的状态源。**读不到返回 null = 未知**，调用方据此
 * 隐去价格即可，绝不能退化成 AU$0 或「售罄」。
 */
export async function getProductStatuses(): Promise<Map<
  string,
  ProductStatus
> | null> {
  const [catalog, items] = await Promise.all([
    getCatalogSafe(),
    getStockItemsSafe(),
  ]);
  if (!catalog) return null;
  return new Map(
    catalog.map((p) => [
      p.handle,
      {
        offSale: !p.available,
        // 库存未知时不冤枉成售罄（宁可放进详情页，那里会再判一次）
        soldOut: items ? productSoldOut(p, items) : false,
        priceCents: p.priceCents,
      },
    ]),
  );
}

/**
 * 商品级「完全无货可卖」聚合（landing 入口标注 / 客户端购物车快照）。
 * BOM 商品按组件推导；其余商品按 products.stock。
 */
export function productSoldOut(
  product: CatalogItem,
  items: Map<string, StockItem>,
): boolean {
  const anyPrintBuyable = ARTWORKS.some((a) =>
    itemBuyable(items.get(printIdFor(a.title)!)),
  );
  if (product.handle === "canvas-scratcher") {
    return !itemBuyable(items.get("frame")) || !anyPrintBuyable;
  }
  if (product.handle === "canvas-print") {
    return !anyPrintBuyable;
  }
  return isSoldOut(product);
}
