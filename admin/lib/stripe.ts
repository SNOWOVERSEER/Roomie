import Stripe from "stripe";

/* 服务端 Stripe 单例。key 与生产必须同模式（test/live），否则改价建错侧。 */
let client: Stripe | null = null;
export function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY missing (root .env.local)");
  client ??= new Stripe(key);
  return client;
}

/** 界面提醒条用：当前 key 的模式（test/live）。改价建的 Price 会落在这个模式。 */
export function stripeMode(): "test" | "live" | "unknown" {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  if (key.startsWith("sk_test") || key.startsWith("rk_test")) return "test";
  if (key.startsWith("sk_live") || key.startsWith("rk_live")) return "live";
  return "unknown";
}
