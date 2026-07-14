import { db } from "@/lib/db";
import type { OrderWithEvents } from "@/lib/types";
import OrdersList from "@/components/OrdersList";
import { stripeMode } from "@/lib/stripe";

export default async function OrdersPage() {
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
      />
    </>
  );
}
