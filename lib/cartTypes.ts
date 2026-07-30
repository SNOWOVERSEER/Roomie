/*
 * 服务端 → 客户端购物车的数据契约。
 *
 * 单独成文件是有原因的：产出方是 lib/inventory.ts（服务端，依赖
 * service key），消费方是 components/CartContext.tsx（客户端组件）。
 * 类型放在任何一边都会让另一边跨边界 import ——
 *   放客户端：admin 把主站 lib/ 卷进自己的类型检查时解析不到 `@/components/*`
 *             （admin 的 `@/*` 指向 admin/ 自己，参见 HANDOVER §9.12 的同类坑）；
 *   放服务端：客户端组件得从依赖 supabase-admin 的模块里 import。
 * 本文件零依赖，两边都能安全引用。
 */

/** layout（服务端）注入的商品快照：仅上架商品，含售罄标记 */
export interface ClientCatalogItem {
  handle: string;
  title: string;
  priceCents: number;
  image: string;
  numbered: boolean;
  soldOut: boolean;
}

/**
 * root layout 传给 CartProvider 的东西。传的是**未 await 的 promise**：
 * await 会挡住整棵树，冷进入就是几秒白屏（见 app/layout.tsx 的注释）。
 */
export interface CartSnapshot {
  catalog: ClientCatalogItem[];
  /** 目录缺失（DB 不可达）。true = 金额不可信，只读不写、不显示金额 */
  catalogUnknown: boolean;
  /** 本轮任一读取降级 → 需要客户端稍后补价 */
  degraded: boolean;
}
