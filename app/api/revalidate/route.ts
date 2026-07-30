import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { env } from "@/lib/env";
import { CATALOG_TAG } from "@/lib/catalog";

/*
 * POST /api/revalidate —— 让生产站的目录/库存缓存立刻作废。
 *
 * 为什么需要它：admin 是**跑在店主本机的另一个 Next 应用**，它直连
 * Supabase 改数据，但它的 revalidatePath 只作用于它自己的进程，够不到
 * 生产。加了 Data Cache（lib/catalog.ts）之后，如果没有这条通道，
 * 「admin 改价 → 站上立刻生效」这个原有行为就会退化成最长等一个 TTL。
 * admin 侧调用见 admin/lib/actions.ts 的 pokeProduction()。
 *
 * 鉴权照抄 /api/shipping：Bearer ADMIN_SECRET + 常数时间比较，
 * 未配置 secret 时恒 401。
 */

function authOk(header: string | null, secret: string): boolean {
  if (!secret || !header?.startsWith("Bearer ")) return false;
  const got = Buffer.from(header.slice(7));
  const want = Buffer.from(secret);
  return got.length === want.length && timingSafeEqual(got, want);
}

export async function POST(req: NextRequest) {
  if (!authOk(req.headers.get("authorization"), env.adminSecret)) {
    console.warn("[revalidate] 鉴权失败");
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  revalidateTag(CATALOG_TAG);
  return NextResponse.json({ ok: true, tag: CATALOG_TAG });
}
