import { db } from "@/lib/db";
import type { OrderWithEvents } from "@/lib/types";
import OrdersList from "@/components/OrdersList";
import { stripeMode } from "@/lib/stripe";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  // Dashboard 行动卡/状态药丸直达预筛选视图（/orders?status=paid）
  const sp = await searchParams;
  const { data, error } = await db()
    .from("orders")
    .select("*, order_events(*)")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  return (
    <>
      <h1>Orders</h1>
      <OrdersList
        orders={(data ?? []) as OrderWithEvents[]}
        mode={stripeMode()}
        initialFilter={sp.status}
        initialQ={sp.q}
      />
    </>
  );
}
