"use server";

import { revalidatePath } from "next/cache";
import { assertAuth } from "@/lib/auth";

type Result = { ok: true } | { error: string };

/*
 * 发货/送达走主站 /api/shipping（不直写 DB）：发货邮件、追踪链接推导
 * 都在那里，复用不重复。默认打生产；SHIPPING_API_ORIGIN（根 .env.local）
 * 可显式改打本地 dev（同一个 Supabase 和 Resend，功能等价）。
 * 注意 NEXT_PUBLIC_URL 本地常是 localhost（教训：邮件断链），
 * 非 https 一律回退生产域名。
 */
const site = () => {
  const override = process.env.SHIPPING_API_ORIGIN ?? "";
  if (override.startsWith("http")) return override.replace(/\/$/, "");
  const u = process.env.NEXT_PUBLIC_URL ?? "";
  return u.startsWith("https://") ? u : "https://roomiepaw.vercel.app";
};

async function callShipping(body: Record<string, unknown>): Promise<Result> {
  await assertAuth();
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return { error: "ADMIN_SECRET missing" };
  try {
    const res = await fetch(`${site()}/api/shipping`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const data = (await res.json()) as { error?: string };
    if (res.status === 401) {
      return {
        error:
          "production rejected ADMIN_SECRET. Sync the value in Vercel env with root .env.local, then retry",
      };
    }
    if (!res.ok) return { error: data.error ?? `HTTP ${res.status}` };
    revalidatePath("/orders");
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "network error" };
  }
}

export async function shipOrder(
  orderRef: string,
  trackingNumber: string,
  carrier: string,
): Promise<Result> {
  if (!trackingNumber.trim()) return { error: "tracking number required" };
  return callShipping({
    order_ref: orderRef,
    tracking_number: trackingNumber.trim(),
    carrier: carrier.trim() || undefined,
  });
}

export async function markDelivered(orderRef: string): Promise<Result> {
  return callShipping({ order_ref: orderRef, status: "delivered" });
}
