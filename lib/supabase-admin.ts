import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

/*
 * 服务端 Supabase 客户端（sb_secret key，绕过 RLS）。
 * orders 表开着 RLS 且无策略，因此只有这条通道可读写 —— 前端永远不碰。
 */

export interface OrderItem {
  handle: string;
  title: string;
  variant?: string;
  qty: number;
  unit_cents: number;
}

/**
 * 履约状态机（0007 起）：paid → shipped → delivered 主线；
 * paid → cancelled（退单）；shipped/delivered → return_requested → returned（退货）。
 * 退款独立于状态：refunded_cents 存 Stripe 权威累计值（部分退款不改状态）。
 */
export type OrderStatus =
  | "paid"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "return_requested"
  | "returned";

export interface OrderRow {
  id: string;
  order_number: number;
  /** 客户可见订单号（6 位纯数字随机，不暴露销量） */
  order_ref: string;
  stripe_session_id: string;
  stripe_payment_intent_id: string | null;
  email: string;
  customer_name: string | null;
  shipping_address: Record<string, unknown> | null;
  items: OrderItem[];
  amount_total: number;
  shipping_cents: number;
  /** 已退款累计（分）。与 Stripe charge.amount_refunded 对齐 */
  refunded_cents: number;
  currency: string;
  status: OrderStatus;
  tracking_number: string | null;
  tracking_url: string | null;
  carrier: string | null;
  return_reason: string | null;
  admin_note: string | null;
  created_at: string;
  shipped_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  return_requested_at: string | null;
  returned_at: string | null;
  updated_at: string;
}

/** 订单事件（时间线补充；里程碑由 orders 时间戳列派生，不入表） */
export interface OrderEventRow {
  id: string;
  order_id: string;
  type: "refund" | "email" | "restock" | "return_cancelled";
  message: string;
  data: Record<string, unknown>;
  created_at: string;
}

export interface ProductRow {
  handle: string;
  title: string;
  tagline: string;
  price_cents: number;
  image: string;
  stripe_product_id: string | null;
  stripe_price_id: string | null;
  /** null = 不限量/不跟踪；0 = 售罄（负数 = 并发竞态，admin 警报） */
  stock: number | null;
  available: boolean;
  /** 有完整购买流程（详情页+购买面板）才可被上架 */
  sellable: boolean;
  numbered: boolean;
  sort: number;
  created_at: string;
  updated_at: string;
}

/*
 * Supabase 瞬时 "JWT issued at future"。全文见 docs/HANDOVER §9.4。
 *
 * 根因（2026-07-30 定稿）：**Supabase 内部两台机器的时钟分歧超过 30 秒。**
 * 我们发的 sb_secret_ 是不透明字符串、不含时间；官方文档说 API key 会被
 * 即时换成一张短命 JWT；那张 JWT 交给项目侧 PostgREST 校验，而它只在
 * iat > now + 30s 时拒绝（源码 Auth/Jwt.hs 的 allowedSkewSeconds = 30，
 * 文案出自 Error.hs）。签发方的钟快过 30 秒，签出来的证就是「未来的」。
 *
 * 关键推论，也是本文件退避策略的依据：**校验只查 iat 有没有超前，从不查
 * 证有多旧**。证的 iat 冻住不动而校验方的钟一直走，所以一张证活过
 * (分歧 − 30) 秒就必然被放行 —— 但前提是那张证被**复用**。重试若拿到的
 * 是新签的证，年龄归零，等多久都没用。
 *
 * 前两版结论已作废，别捡回来：①「机器睡醒本机时钟落后」（本地 dev 下得
 * 的，生产不成立）；②「PostgREST 缓存系统时间戳 1 秒导致的竞态
 * （#1139）」—— 那个病早修了，而且秒级抖动过不了 30 秒容差这道闸。
 */
const CLOCK_SKEW_RE = /issued at future|issued in the future/i;

/*
 * 退避梯度（ms），累计 ≈ 0.4 / 1.4 秒。
 *
 * 战绩：四次生产事故 **0/4**，一次没救回来过。留着只因为它便宜，赌的是
 * 分歧刚好略高于 30 秒、一两秒就能熬过去的情形。
 *
 * 早先这里写着「这东西等不出来」——**说反了**，等得出来，只是要等的是
 * (分歧 − 30) 秒（实测那一次落在 1.6–5.5 秒之间），不是几百毫秒。服务端
 * 不等是**主动取舍**：等下去就是让用户对着白屏干等，而分歧多大事先根本
 * 不知道。所以短打快撤，页面先吐出去，由客户端在第 2/7/19 秒重跑服务端
 * 渲染把价格补回来（components/DegradedRetry.tsx）——那时同一张证已经
 * 熬老，成功率高得多。
 *
 * 补充：自 2026-07-30 上了 Data Cache（lib/catalog.ts）之后，绝大多数
 * 渲染压根不发这个请求，这条退避路径实际被触发的机会已经很少。
 */
const BACKOFF_MS = [400, 1000];

export async function retryOnClockSkew<
  R extends { error: { message: string } | null },
>(run: () => PromiseLike<R>): Promise<R> {
  let last = await run();
  for (let i = 0; i < BACKOFF_MS.length; i++) {
    if (!last.error || !CLOCK_SKEW_RE.test(last.error.message)) return last;
    // 抖动窗口内并发查询会一起醒来再一起打，加抖动摊开重试时刻
    const wait = BACKOFF_MS[i] + Math.floor(Math.random() * 150);
    console.warn(
      `[supabase] JWT iat 抖动（Supabase 侧），${wait}ms 后重试 ${i + 1}/${BACKOFF_MS.length}:`,
      last.error.message,
    );
    await new Promise((r) => setTimeout(r, wait));
    last = await run();
  }
  return last;
}

let client: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!env.supabaseUrl || !env.supabaseSecretKey) {
    throw new Error("SUPABASE_URL / SUPABASE_SECRET_KEY 未配置");
  }
  client ??= createClient(env.supabaseUrl, env.supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
