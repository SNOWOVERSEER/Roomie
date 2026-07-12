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
  resendFrom: process.env.RESEND_FROM ?? "Roomie <onboarding@resend.dev>",
  adminSecret: process.env.ADMIN_SECRET ?? "",
  publicUrl: process.env.NEXT_PUBLIC_URL ?? "",
};
