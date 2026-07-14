/* 与主站 lib/supabase-admin.ts 同构（表结构变更时两处同步改） */

export interface ProductRow {
  handle: string;
  title: string;
  tagline: string;
  price_cents: number;
  image: string;
  stripe_product_id: string | null;
  stripe_price_id: string | null;
  /** null = 不限量/不跟踪；0 = 售罄；负数 = 并发竞态（界面红色警报） */
  stock: number | null;
  available: boolean;
  /** 有完整购买流程（详情页+购买面板）才可被上架 */
  sellable: boolean;
  numbered: boolean;
  sort: number;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  handle: string;
  title: string;
  variant?: string;
  qty: number;
  unit_cents: number;
}

/**
 * 履约状态机（0007 起）：paid → shipped → delivered 主线；
 * paid → cancelled（退单）；shipped/delivered → return_requested → returned（退货）。
 * 退款独立于状态：refunded_cents 存 Stripe 权威累计值（部分退款不改状态）。
 */
export type OrderStatus =
  | "paid"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "return_requested"
  | "returned";

export interface OrderRow {
  id: string;
  order_number: number;
  order_ref: string;
  stripe_session_id: string;
  stripe_payment_intent_id: string | null;
  email: string;
  customer_name: string | null;
  shipping_address: Record<string, unknown> | null;
  items: OrderItem[];
  amount_total: number;
  shipping_cents: number;
  /** 已退款累计（分）。与 Stripe charge.amount_refunded 对齐 */
  refunded_cents: number;
  currency: string;
  status: OrderStatus;
  tracking_number: string | null;
  tracking_url: string | null;
  carrier: string | null;
  return_reason: string | null;
  admin_note: string | null;
  created_at: string;
  shipped_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  return_requested_at: string | null;
  returned_at: string | null;
  updated_at: string;
}

/** 订单事件（时间线补充；里程碑由 orders 时间戳列派生，不入表） */
export interface OrderEventRow {
  id: string;
  order_id: string;
  type: "refund" | "email" | "restock" | "return_cancelled";
  message: string;
  data: Record<string, unknown>;
  created_at: string;
}

/** Orders 页联查（PostgREST 关系嵌套 select） */
export interface OrderWithEvents extends OrderRow {
  order_events: OrderEventRow[];
}

export interface WaitlistRow {
  id: string;
  email: string;
  product_handle: string;
  created_at: string;
}

export interface StockItemRow {
  id: string;
  label: string;
  /** null = 不限量/不跟踪；0 = 售罄；负数 = 并发竞态（红色警报） */
  stock: number | null;
  /** false = 画作退役（seasonal drop 下场，购买动线消失） */
  available: boolean;
  sort: number;
  created_at: string;
  updated_at: string;
}

/** 低库存警报阈值（与主站 lib/inventory.ts LOW_STOCK_AT 同步改） */
export const LOW_STOCK_AT = 10;

export const formatCents = (cents: number) =>
  `AU$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
