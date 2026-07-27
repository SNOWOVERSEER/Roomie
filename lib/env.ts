/*
 * 环境变量统一入口（仅服务端 import；见 .env.example）。
 * 缺失不 throw —— 降级策略由调用方决定（邮件跳过、webhook 503 等），
 * 保证未配 key 的环境（如 Preview 部署）页面照常构建与浏览。
 */
export const env = {
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  stripeTaxEnabled: process.env.STRIPE_TAX_ENABLED === "1",
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseSecretKey: process.env.SUPABASE_SECRET_KEY ?? "",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  resendFrom: process.env.RESEND_FROM ?? "RoomiePaw <onboarding@resend.dev>",
  resendWebhookSecret: process.env.RESEND_WEBHOOK_SECRET ?? "",
  inboundForwardTo: process.env.INBOUND_FORWARD_TO ?? "",
  adminSecret: process.env.ADMIN_SECRET ?? "",
  publicUrl: process.env.NEXT_PUBLIC_URL ?? "",
};

/** 客户端生产环境的规范地址（改域名只动这里 + .env.example；
 * 2026-07-19 起正典域名 roomiepaw.com.au，vercel.app 仍作别名服务） */
export const PROD_ORIGIN = "https://roomiepaw.com.au";

/**
 * 站点对外源（结算回跳等客户可见 URL 用）：
 * - https 的 NEXT_PUBLIC_URL 永远可信；
 * - http（本地 dev 的 localhost:3000）只在非生产构建可信——
 *   生产上 NEXT_PUBLIC_URL 误配成 localhost 时绝不能把付完款的客户
 *   重定向到 localhost；
 * - 其余情况用调用方兜底（如请求源），再兜到生产域名。
 */
export function publicOrigin(fallback: string = PROD_ORIGIN): string {
  const u = env.publicUrl.replace(/\/+$/, "");
  if (u.startsWith("https://")) return u;
  if (u.startsWith("http://") && process.env.NODE_ENV !== "production") return u;
  return fallback.replace(/\/+$/, "") || PROD_ORIGIN;
}
