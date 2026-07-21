import { db } from "@/lib/db";
import type { StockItemRow } from "@/lib/types";
import { ARTWORKS } from "../../../lib/heroConfig";
import Dashboard, {
  type DashOrder,
  type DashRefund,
  type DashWaitlist,
} from "@/components/Dashboard";

/*
 * Dashboard 数据层：全量订单（小店量级）+ 退款流水 + 候补 + 库存一次取回，
 * 周期切换/图表悬停等交互全在客户端算——切周期零往返，SaaS 手感的关键。
 * `now` 由服务端下发：SSR 与水合用同一时钟，杜绝边界抖动。
 */

const SITE = "https://roomiepaw.com.au";

export default async function DashboardPage() {
  const [ordersQ, refundsQ, stockQ, wlQ, productsQ] = await Promise.all([
    db()
      .from("orders")
      .select(
        "order_ref,created_at,amount_total,refunded_cents,status,items,customer_name,email,shipped_at,delivered_at,cancelled_at,returned_at",
      )
      .order("created_at", { ascending: false })
      .limit(2000),
    db()
      .from("order_events")
      .select("message,created_at,orders(order_ref)")
      .eq("type", "refund")
      .order("created_at", { ascending: false })
      .limit(50),
    db().from("stock_items").select("*").order("sort", { ascending: true }),
    db()
      .from("waitlist")
      .select("email,product_handle,created_at")
      .order("created_at", { ascending: false })
      .limit(100),
    db().from("products").select("handle,image"),
  ]);
  for (const q of [ordersQ, refundsQ, stockQ, wlQ, productsQ]) {
    if (q.error) throw new Error(q.error.message);
  }

  const images: Record<string, string> = {};
  for (const p of (productsQ.data ?? []) as { handle: string; image: string }[]) {
    if (p.image?.startsWith("/")) images[p.handle] = `${SITE}${p.image}`;
  }
  // 画芯 variant → 平面稿缩略图（与邮件 itemThumb 同一约定）
  const artThumbs: Record<string, string> = {};
  ARTWORKS.forEach((a, i) => {
    artThumbs[a.title] = `${SITE}/hero/art/flat-0${i + 1}.png`;
  });

  const refunds: DashRefund[] = (
    (refundsQ.data ?? []) as unknown as {
      message: string;
      created_at: string;
      orders: { order_ref: string } | null;
    }[]
  ).map((r) => ({
    message: r.message,
    created_at: r.created_at,
    order_ref: r.orders?.order_ref ?? null,
  }));

  return (
    <Dashboard
      now={Date.now()}
      orders={(ordersQ.data ?? []) as DashOrder[]}
      refunds={refunds}
      waitlist={(wlQ.data ?? []) as DashWaitlist[]}
      stock={(stockQ.data ?? []) as StockItemRow[]}
      images={images}
      artThumbs={artThumbs}
    />
  );
}
