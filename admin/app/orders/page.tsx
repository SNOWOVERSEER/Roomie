import { db } from "@/lib/db";
import type { OrderRow } from "@/lib/types";
import OrdersList from "@/components/OrdersList";

export default async function OrdersPage() {
  const { data, error } = await db()
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (
    <>
      <h1>Orders</h1>
      <OrdersList orders={(data ?? []) as OrderRow[]} />
    </>
  );
}
