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

/**
 * 已被真实订单占用的猫屋编号（items 里 canvas-house 行的 "№ 03" → 3）。
 * 首批只有 10 件、订单量小 —— 全表扫可接受；量大再做物化视图。
 * TODO(并发)：两人同时买同一编号 MVP 不加锁（规格：库存管理不做）。
 */
export async function getClaimedHouseNumbers(): Promise<number[]> {
  // 不用 jsonb containment（对象数组的 cs 过滤在 PostgREST 侧易踩坑），
  // 直接取 items 列 JS 过滤 —— MVP 订单量级下最稳
  const { data, error } = await getSupabaseAdmin()
    .from("orders")
    .select("items");
  if (error) throw new Error(`orders 查询失败: ${error.message}`);
  const claimed = new Set<number>();
  for (const row of data ?? []) {
    for (const it of (row as { items: { handle: string; variant?: string }[] }).items) {
      if (it.handle !== "canvas-house") continue;
      const m = it.variant?.match(/(\d+)/);
      if (m) claimed.add(parseInt(m[1], 10));
    }
  }
  return [...claimed].sort((a, b) => a - b);
}
