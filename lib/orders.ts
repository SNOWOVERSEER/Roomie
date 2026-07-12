import { getSupabaseAdmin, type OrderRow } from "./supabase-admin";

/* orders 表的服务端查询助手（仅 API Routes / 服务端组件使用） */

export async function getOrderBySessionId(
  sessionId: string,
): Promise<OrderRow | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("orders")
    .select("*")
    .eq("stripe_session_id", sessionId)
    .maybeSingle();
  if (error) throw new Error(`orders 查询失败: ${error.message}`);
  return (data as OrderRow | null) ?? null;
}

export async function getOrderByNumber(n: number): Promise<OrderRow | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("orders")
    .select("*")
    .eq("order_number", n)
    .maybeSingle();
  if (error) throw new Error(`orders 查询失败: ${error.message}`);
  return (data as OrderRow | null) ?? null;
}

/*
 * （历史）getClaimedHouseNumbers 已随选号预售一起移除（2026-07-12）——
 * 猫屋首批改为 waitlist，见 /api/waitlist 与 components/WaitlistForm。
 */
