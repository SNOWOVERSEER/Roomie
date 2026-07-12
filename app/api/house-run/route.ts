import { NextResponse } from "next/server";
import { getHouseRun } from "@/lib/shopify";
import { getClaimedHouseNumbers } from "@/lib/orders";

/*
 * GET /api/house-run —— 猫屋首批编号占用情况。
 * claimed = mock 基础值 ∪ 真实订单里已买走的编号；
 * Supabase 不可用时退回 mock，选号界面永不因此挂掉。
 */

export async function GET() {
  const base = await getHouseRun();
  let claimed = base.claimed;
  try {
    const real = await getClaimedHouseNumbers();
    claimed = [...new Set([...base.claimed, ...real])].sort((a, b) => a - b);
  } catch (e) {
    console.error("[house-run] 查询失败，用 mock 兜底:", e);
  }
  return NextResponse.json(
    { total: base.total, claimed },
    { headers: { "cache-control": "no-store" } },
  );
}
