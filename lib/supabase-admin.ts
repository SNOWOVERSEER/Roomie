import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

/*
 * 服务端 Supabase 客户端（sb_secret key，绕过 RLS）。
 * orders 表开着 RLS 且无策略，因此只有这条通道可读写 —— 前端永远不碰。
 */

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
  /** 客户可见订单号（6 位纯数字随机，不暴露销量） */
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

export interface ProductRow {
  handle: string;
  title: string;
  tagline: string;
  price_cents: number;
  image: string;
  stripe_product_id: string | null;
  stripe_price_id: string | null;
  /** null = 不限量/不跟踪；0 = 售罄（负数 = 并发竞态，admin 警报） */
  stock: number | null;
  available: boolean;
  /** 有完整购买流程（详情页+购买面板）才可被上架 */
  sellable: boolean;
  numbered: boolean;
  sort: number;
  created_at: string;
  updated_at: string;
}

/*
 * Supabase 瞬时时钟抖动（机器睡醒后本机时钟落后，JWT iat 被判在未来，
 * 几百 ms 到几秒内自愈）。这曾让 layout 的首个请求 500：错误页 →
 * dev 就地恢复途中客户端报 removeChild of null。只对这一种错误做一次
 * 短退避重试；其它错误照旧交给调用方（error boundary）。
 */
const CLOCK_SKEW_RE = /issued at future|issued in the future/i;

export async function retryOnClockSkew<
  R extends { error: { message: string } | null },
>(run: () => PromiseLike<R>): Promise<R> {
  const first = await run();
  if (first.error && CLOCK_SKEW_RE.test(first.error.message)) {
    console.warn(
      "[supabase] 时钟抖动瞬时错误，600ms 后重试一次:",
      first.error.message,
    );
    await new Promise((r) => setTimeout(r, 600));
    return await run();
  }
  return first;
}

let client: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!env.supabaseUrl || !env.supabaseSecretKey) {
    throw new Error("SUPABASE_URL / SUPABASE_SECRET_KEY 未配置");
  }
  client ??= createClient(env.supabaseUrl, env.supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
