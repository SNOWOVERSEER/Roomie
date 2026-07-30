/*
 * 通知生产站作废目录/库存缓存。
 *
 * 由来：admin 跑在店主本机，直连同一个 Supabase 改数据；但生产站的
 * Data Cache（主站 lib/catalog.ts）活在 Vercel 上，本进程的
 * revalidatePath 只作用于 admin 自己，够不到它。没有这条通道的话，
 * 「admin 改价 → 站上立刻生效」这个加缓存之前就有的行为会退化成
 * 「最长等一个 TTL」。对应端点：主站 app/api/revalidate/route.ts。
 *
 * 失败只记日志、绝不抛：数据已经落库了，生产最长一个 TTL 也会自愈，
 * 不该因为一次通知没送到就让店主的改价操作报错。
 */

/** 目标站点。默认生产；本地联调可用 SHIPPING_API_ORIGIN 指到 localhost:3000 */
const SITE_ORIGIN =
  process.env.SHIPPING_API_ORIGIN || "https://roomiepaw.com.au";

export async function pokeProduction(): Promise<void> {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    console.warn("[admin] 未配 ADMIN_SECRET，跳过生产缓存失效");
    return;
  }
  try {
    const res = await fetch(`${SITE_ORIGIN}/api/revalidate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.warn(`[admin] 生产缓存失效失败: HTTP ${res.status}`);
    }
  } catch (e) {
    console.warn(
      "[admin] 生产缓存失效失败:",
      e instanceof Error ? e.message : String(e),
    );
  }
}
