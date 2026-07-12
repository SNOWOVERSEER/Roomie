/*
 * 可购 SKU 的唯一事实源（规格决策：商品数据用代码常量，不引 CMS）。
 * 价格为 AUD 分、GST 含内；服务端结算一律从这里 re-derive，
 * 绝不信任客户端传来的价格。
 *
 * stripePriceId 由 `npm run stripe:setup` 幂等生成（当前为 test mode）。
 * 上 live：换 live key 重跑脚本，把打印出的新 Price ID 回填到这里。
 */
export type CatalogHandle = "canvas-scratcher" | "canvas-print";

export interface CatalogItem {
  handle: CatalogHandle;
  title: string;
  priceCents: number;
  image: string;
  stripePriceId: string;
  /** 编号件：购物车中一号一行、数量恒 1（当前无在售编号件） */
  numbered?: boolean;
}

/*
 * 猫屋（canvas-house）不在这里：首批改为 waitlist（2026-07-12 决策），
 * 不可购 —— 开售时把它加回来即可（Stripe 侧 product/price 已建好：
 * price_1TsHxqDzmUuzRpRKebu6oZDS，AU$189 占位）。
 */
export const CATALOG: Record<CatalogHandle, CatalogItem> = {
  "canvas-scratcher": {
    handle: "canvas-scratcher",
    title: "The Canvas Scratcher",
    priceCents: 8900,
    image: "/c01/print-01.webp",
    stripePriceId: "price_1TsHxoDzmUuzRpRKdgcL52kJ",
  },
  "canvas-print": {
    handle: "canvas-print",
    title: "Swap-in Print",
    priceCents: 3500, // TODO 占位价待确认（改这里 + 重跑 stripe:setup）
    image: "/c01/print-02.webp",
    stripePriceId: "price_1TsHxpDzmUuzRpRKRnGBcpHp",
  },
};

export const formatCents = (cents: number) =>
  `AU$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
