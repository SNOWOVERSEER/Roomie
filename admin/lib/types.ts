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
  currency: string;
  status: "paid" | "shipped" | "delivered";
  tracking_number: string | null;
  tracking_url: string | null;
  carrier: string | null;
  created_at: string;
  shipped_at: string | null;
  delivered_at: string | null;
  updated_at: string;
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
