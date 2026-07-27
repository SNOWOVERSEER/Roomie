import { cache } from "react";
import { readOrDegrade } from "./degrade";
import { getSupabaseAdmin, retryOnClockSkew } from "./supabase-admin";
import { ARTWORKS } from "./heroConfig";
import {
  getCatalogSafe,
  isSoldOut,
  type CatalogItem,
} from "./catalog";

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

/** 单次请求内记忆化，理由同 getCatalog（lib/catalog.ts）。 */
export const getStockItems = cache(async function getStockItems(): Promise<
  Map<string, StockItem>
> {
  const { data, error } = await retryOnClockSkew(() =>
    getSupabaseAdmin()
      .from("stock_items")
      .select("id,label,stock,available,sort")
      .order("sort", { ascending: true }),
  );
  if (error) throw new Error(`stock_items 读取失败: ${error.message}`);
  return new Map((data as StockItem[]).map((i) => [i.id, i]));
});

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
