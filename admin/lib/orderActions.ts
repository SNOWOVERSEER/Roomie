"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { assertAuth } from "@/lib/auth";
import { sendShippingNotice } from "../../lib/email";
import type { OrderRow } from "@/lib/types";

type Result = { ok: true } | { error: string };

/*
 * 发货/送达：admin 直连 Supabase 更新订单 + 直调 Resend 发邮件
 * （2026-07-14 决策：发货本质 = 一次 DB 更新 + 一次邮件 API 调用，
 * 不依赖 Vercel 部署可用性——生产挂了也能发货）。
 * 邮件模板跨目录复用主站 lib/email.ts（单一事实源）。
 * 生产 /api/shipping 保留作 curl fallback，与这里逻辑对齐。
 */

const TRACK_URL: Record<string, (n: string) => string> = {
  auspost: (n) => `https://auspost.com.au/mypost/track/#/details/${n}`,
  sendle: (n) => `https://track.sendle.com/tracking?ref=${n}`,
};

export async function shipOrder(
  orderRef: string,
  trackingNumber: string,
  carrier: string,
): Promise<Result> {
  await assertAuth();
  const tracking = trackingNumber.trim();
  if (!tracking) return { error: "tracking number required" };

  const c = carrier.trim().toLowerCase();
  const trackingUrl = c && TRACK_URL[c] ? TRACK_URL[c](tracking) : null;

  const { data, error } = await db()
    .from("orders")
    .update({
      status: "shipped",
      tracking_number: tracking,
      tracking_url: trackingUrl,
      carrier: c || null,
      shipped_at: new Date().toISOString(),
    })
    .eq("order_ref", orderRef)
    .select()
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { error: "order not found" };

  // 邮件失败不回滚发货状态（与主站语义一致）：记错误给店主看，可人工补发
  const mail = await sendShippingNotice(data as OrderRow);
  revalidatePath("/orders");
  if ("error" in mail && mail.error) {
    return { error: `shipped, but the email failed: ${mail.error}` };
  }
  return { ok: true };
}

export async function markDelivered(orderRef: string): Promise<Result> {
  await assertAuth();
  const { data, error } = await db()
    .from("orders")
    .update({ status: "delivered", delivered_at: new Date().toISOString() })
    .eq("order_ref", orderRef)
    .select("order_ref")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "order not found" };
  revalidatePath("/orders");
  return { ok: true };
}
