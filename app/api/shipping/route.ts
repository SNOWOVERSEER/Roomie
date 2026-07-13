import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getSupabaseAdmin, type OrderRow } from "@/lib/supabase-admin";
import { sendShippingNotice } from "@/lib/email";

/*
 * POST /api/shipping —— 内部履约接口（Bearer ADMIN_SECRET 鉴权）。
 * 手动发货后调用：更新状态/追踪号并发发货邮件。用法见 docs/phase2-runbook.md：
 *
 *   curl -X POST https://roomiepaw.vercel.app/api/shipping \
 *     -H "Authorization: Bearer $ADMIN_SECRET" -H "Content-Type: application/json" \
 *     -d '{"order_ref":"482916","tracking_number":"XX123","carrier":"auspost"}'
 */

const TRACK_URL: Record<string, (n: string) => string> = {
  auspost: (n) => `https://auspost.com.au/mypost/track/#/details/${n}`,
  sendle: (n) => `https://track.sendle.com/tracking?ref=${n}`,
};

interface Body {
  order_ref?: string; // 客户可见订单号（6 位数字），首选
  order_number?: number; // 内部自增号，兼容保留
  session_id?: string;
  tracking_number?: string;
  tracking_url?: string;
  carrier?: string; // "auspost" | "sendle" | 任意
  status?: "shipped" | "delivered";
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  if (!env.adminSecret || auth !== `Bearer ${env.adminSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  if (!body.order_ref && !body.order_number && !body.session_id) {
    return NextResponse.json(
      { error: "order_ref / order_number / session_id 必填其一" },
      { status: 400 },
    );
  }

  const status = body.status ?? "shipped";
  if (status === "shipped" && !body.tracking_number) {
    return NextResponse.json(
      { error: "发货需要 tracking_number" },
      { status: 400 },
    );
  }

  const carrier = body.carrier?.toLowerCase();
  const trackingUrl =
    body.tracking_url ??
    (carrier && body.tracking_number && TRACK_URL[carrier]
      ? TRACK_URL[carrier](body.tracking_number)
      : null);

  const patch: Record<string, unknown> = { status };
  if (status === "shipped") {
    patch.tracking_number = body.tracking_number;
    patch.tracking_url = trackingUrl;
    patch.carrier = body.carrier ?? null;
    patch.shipped_at = new Date().toISOString();
  } else {
    patch.delivered_at = new Date().toISOString();
  }

  let q = getSupabaseAdmin().from("orders").update(patch);
  q = body.order_ref
    ? q.eq("order_ref", body.order_ref.trim())
    : body.order_number
      ? q.eq("order_number", body.order_number)
      : q.eq("stripe_session_id", body.session_id!);
  const { data, error } = await q.select().maybeSingle();

  if (error) {
    console.error("[shipping] 更新失败:", error.message);
    return NextResponse.json({ error: "update failed" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "order not found" }, { status: 404 });
  }

  const order = data as OrderRow;
  const email =
    status === "shipped" ? await sendShippingNotice(order) : { skipped: true };

  return NextResponse.json({
    ok: true,
    order: {
      order_ref: order.order_ref,
      order_number: order.order_number,
      status: order.status,
      tracking_number: order.tracking_number,
      tracking_url: order.tracking_url,
    },
    email,
  });
}
