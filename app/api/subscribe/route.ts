import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getStripe } from "@/lib/stripe";
import { env } from "@/lib/env";
import {
  SUBSCRIBED_COOKIE,
  WELCOME_COUPON_ID,
  WELCOME_PERCENT,
} from "@/lib/promos";
import { sendWelcomeCoupon } from "@/lib/email";

/*
 * POST /api/subscribe —— The Roomie letter 订阅 {email, source?, company?}。
 * 回报：每邮箱一枚一次性 10% Stripe promotion code（结算页优惠码框直接可用，
 * checkout 已开 allow_promotion_codes）。
 *
 * 落库顺序（self-healing）：先占行（email 唯一）→ 再造码 → 回填。
 * 任一步失败都不丢状态：下次同邮箱提交会走「已存在但缺码」分支把码补上。
 * 邮件 best-effort：码已经回给页面展示，发信失败不影响主流程。
 * company 是蜜罐字段：真人表单里不可见，填了值的一律静默丢弃。
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* 码面字符池去掉易混形（0/O、1/I/L），客服口述也不出错 */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function mintCode(): string {
  let s = "";
  for (let i = 0; i < 5; i++)
    s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return `ROOMIE10-${s}`;
}

/** 10% 欢迎 coupon 懒创建（固定 id 幂等；test/live 各自首次订阅时成立） */
async function ensureCoupon(stripe: Stripe): Promise<void> {
  try {
    await stripe.coupons.retrieve(WELCOME_COUPON_ID);
    return;
  } catch {
    /* 不存在 → 创建 */
  }
  try {
    await stripe.coupons.create({
      id: WELCOME_COUPON_ID,
      percent_off: WELCOME_PERCENT,
      duration: "once",
      name: "Roomie letter · welcome 10%",
    });
  } catch {
    // 并发双创会撞已存在 —— 再取一次，取不到才算真失败
    await stripe.coupons.retrieve(WELCOME_COUPON_ID);
  }
}

/** 唯一 promotion code（码面撞车重试三次） */
async function mintPromotionCode(
  stripe: Stripe,
  email: string,
): Promise<Stripe.PromotionCode> {
  let lastErr: unknown;
  for (let i = 0; i < 3; i++) {
    try {
      return await stripe.promotionCodes.create({
        coupon: WELCOME_COUPON_ID,
        code: mintCode(),
        max_redemptions: 1,
        metadata: { email, source: "roomie-letter" },
      });
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

export async function POST(req: NextRequest) {
  let body: { email?: string; source?: string; company?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  // 蜜罐：脚本填了隐藏字段 → 装作成功，什么都不做
  if (typeof body.company === "string" && body.company.trim() !== "") {
    return NextResponse.json({ ok: true, code: null });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ error: "invalid email" }, { status: 422 });
  }
  const source =
    typeof body.source === "string" && body.source.length <= 40
      ? body.source
      : "promo-bar";

  const sb = getSupabaseAdmin();

  // 已订阅且已有码 → 直接把码还给它的主人
  const { data: existing, error: readErr } = await sb
    .from("subscribers")
    .select("id, promo_code")
    .eq("email", email)
    .maybeSingle();
  if (readErr) {
    console.error("[subscribe] 读取失败:", readErr.message);
    return NextResponse.json({ error: "try again" }, { status: 500 });
  }
  const already = !!existing;
  if (existing?.promo_code) {
    return withSubscribedCookie(
      NextResponse.json({ ok: true, already: true, code: existing.promo_code }),
    );
  }

  // 占行（unique email；并发撞车走 ignoreDuplicates，随后统一补码）
  if (!existing) {
    const { error: insErr } = await sb
      .from("subscribers")
      .upsert({ email, source }, { onConflict: "email", ignoreDuplicates: true });
    if (insErr) {
      console.error("[subscribe] 写入失败:", insErr.message);
      return NextResponse.json({ error: "try again" }, { status: 500 });
    }
  }

  // 无 Stripe key 的环境（Preview 等）：行已记下，码留给生产补发
  if (!env.stripeSecretKey) {
    console.log("[subscribe] STRIPE_SECRET_KEY 未配置，只记订阅不发码:", email);
    return withSubscribedCookie(
      NextResponse.json({ ok: true, already, code: null }),
    );
  }

  try {
    const stripe = getStripe();
    await ensureCoupon(stripe);
    const promo = await mintPromotionCode(stripe, email);

    // 回填。并发下另一请求可能已回填 —— 以先写入者为准，本次的码作废也无妨
    // （max_redemptions=1 的闲置码没有成本），读回权威值返回。
    await sb
      .from("subscribers")
      .update({
        promo_code: promo.code,
        stripe_promotion_code_id: promo.id,
      })
      .eq("email", email)
      .is("promo_code", null);
    const { data: settled } = await sb
      .from("subscribers")
      .select("promo_code")
      .eq("email", email)
      .maybeSingle();
    const code = settled?.promo_code ?? promo.code;

    // 邮件 best-effort：失败只记日志（码已在页面上展示）
    const sent = await sendWelcomeCoupon(email, code);
    if (!sent.skipped && !("error" in sent)) {
      await sb
        .from("subscribers")
        .update({ emailed_at: new Date().toISOString() })
        .eq("email", email);
    }

    return withSubscribedCookie(
      NextResponse.json({ ok: true, already, code }),
    );
  } catch (e) {
    console.error("[subscribe] 发码失败（订阅已记录，下次提交自愈）:", e);
    return withSubscribedCookie(
      NextResponse.json({ ok: true, already, code: null }),
    );
  }
}

/** 订阅成功的响应统一带上 cookie：SSR 据此隐藏 letter 活动位 */
function withSubscribedCookie(res: NextResponse) {
  res.cookies.set(SUBSCRIBED_COOKIE, "1", {
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax",
    httpOnly: true,
  });
  return res;
}
