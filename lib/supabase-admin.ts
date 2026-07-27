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
 * Supabase 瞬时 "JWT issued at future"。
 *
 * 2026-07-27 更正根因（旧结论「机器睡醒本机时钟落后」是本地 dev 下得的，
 * 生产不成立）：本应用发出去的是不透明的 sb_secret_ 令牌，**根本不是 JWT**
 * （41 字符，无 payload），全项目也不存在任何 JWT 格式的凭证。所以那个 iat
 * 被判在未来的 JWT，只可能是 Supabase 网关在**每个请求**上现签的短命令牌。
 *
 * 而 PostgREST 把系统时间戳缓存 1 秒再拿去校验 iat，于是「现签的令牌」
 * 天然会撞上「最多落后 1 秒的校验基准」——这就是 PostgREST 的
 * JWTIssuedAtFuture（PostgREST#1139）。整条链路都在 Supabase 内部，
 * 本机/Vercel 的时钟不参与，我们既复现不了也修不掉。
 * （07-27 事故里连续数秒、多个查询全失败，比单纯的微秒级竞态更像是
 *   Supabase 某个节点持续偏移了一段时间。）
 *
 * 能做的只有把这段窗口熬过去：退避重试若干次。实测 07-27 生产事故里
 * 单次 600ms 重试不够——同一次渲染的多个查询全部落在窗口内，重试一次
 * 仍失败，root layout 抛错 → 整个首页 500（店主从 Instagram 点进来即中）。
 * 其它错误照旧交给调用方（error boundary）。
 */
const CLOCK_SKEW_RE = /issued at future|issued in the future/i;

/*
 * 退避梯度（ms），累计 ≈ 0.4 / 1.4 / 3.4 秒。
 * 按 07-27 11:02 那次生产日志实测标定：32.451→33.220 共 769ms 内，
 * 8 次尝试（4 首发 + 4 重试）无一成功——是成片窗口，不是零星随机失败
 * （与 PostgREST 缓存系统时间戳 1 秒的机制吻合）。老的 600ms 单次重试
 * 正好落在窗口内，所以必然失败。梯度要能跨过 ~1s 量级的整片窗口。
 */
const BACKOFF_MS = [400, 1000, 2000];

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
