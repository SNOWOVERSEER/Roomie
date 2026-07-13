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

export interface OrderRow {
  id: string;
  order_number: number;
  /** 客户可见订单号（RP-XXXXX，随机非顺序，不暴露销量） */
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
