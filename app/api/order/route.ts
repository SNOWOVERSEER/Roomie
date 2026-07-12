import { NextRequest, NextResponse } from "next/server";
import { getOrderBySessionId } from "@/lib/orders";
import { getStripe } from "@/lib/stripe";

/*
 * GET /api/order?session_id=cs_xxx —— 付款成功页轮询用。
 * 只回订单摘要（不含收货地址等隐私字段）；webhook 尚未落库时
 * 查 Stripe session 状态，给前端一个「处理中」的中间态。
 */

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session_id") ?? "";
  if (!/^cs_[a-zA-Z0-9_]+$/.test(sessionId)) {
    return NextResponse.json({ error: "bad session_id" }, { status: 400 });
  }

  try {
    const order = await getOrderBySessionId(sessionId);
    if (order) {
      return NextResponse.json(
        {
          order: {
            order_number: order.order_number,
            email: order.email,
            items: order.items,
            amount_total: order.amount_total,
            currency: order.currency,
            status: order.status,
            created_at: order.created_at,
          },
        },
        { headers: { "cache-control": "no-store" } },
      );
    }
  } catch (e) {
    console.error("[order] supabase 查询失败:", e);
  }

  // 还没入库：看 Stripe 侧状态（付了但 webhook 迟到 / 异步支付处理中）
  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    return NextResponse.json(
      {
        pending: true,
        payment_status: session.payment_status,
        email: session.customer_details?.email ?? null,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}
