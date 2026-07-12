import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

/*
 * POST /api/waitlist —— 候补登记 {email, handle}。
 * 幂等：unique(email, product_handle)；重复提交回 already=true（前端给友好提示）。
 * 邮箱只做格式校验 + 归一化（trim/lowercase），不发验证邮件（MVP）。
 */

const VALID_HANDLES = new Set([
  "canvas-house",
  "nook-house",
  "cloud-perch",
  "wave-bowls",
]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(req: NextRequest) {
  let body: { email?: string; handle?: string };
  try {
    body = (await req.json()) as { email?: string; handle?: string };
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const handle = body.handle ?? "";
  if (!VALID_HANDLES.has(handle)) {
    return NextResponse.json({ error: "unknown product" }, { status: 400 });
  }
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ error: "invalid email" }, { status: 422 });
  }

  const { data, error } = await getSupabaseAdmin()
    .from("waitlist")
    .upsert(
      { email, product_handle: handle },
      { onConflict: "email,product_handle", ignoreDuplicates: true },
    )
    .select();

  if (error) {
    console.error("[waitlist] 写入失败:", error.message);
    return NextResponse.json({ error: "try again" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, already: (data ?? []).length === 0 });
}
