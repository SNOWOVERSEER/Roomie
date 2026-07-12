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
  stripe_session_id: string;
  stripe_payment_intent_id: string | null;
  email: string;
  customer_name: string | null;
  shipping_address: Record<string, unknown> | null;
  items: OrderItem[];
  amount_total: number;
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
