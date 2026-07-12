import Stripe from "stripe";
import { env } from "./env";

/* 服务端 Stripe 单例（API 版本随 SDK 锁定）。仅在 API Routes 使用。 */
let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (!env.stripeSecretKey) {
    throw new Error("STRIPE_SECRET_KEY 未配置");
  }
  client ??= new Stripe(env.stripeSecretKey);
  return client;
}
