import { db } from "@/lib/db";
import type { OrderRow } from "@/lib/types";

/* 订单 CSV 导出（对账口径：金额一律元、GST 含内；middleware 已做认证门） */
export async function GET() {
  const { data, error } = await db()
    .from("orders")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) return new Response(error.message, { status: 500 });
  const rows = (data ?? []) as OrderRow[];

  const esc = (s: string) => `"${s.replaceAll('"', '""')}"`;
  const dollars = (cents: number) => (cents / 100).toFixed(2);
  const csv = [
    [
      "order_ref", "placed_at", "status", "email", "name",
      "items", "subtotal_aud", "shipping_aud", "total_aud",
      "refunded_aud", "net_aud", "carrier", "tracking_number",
      "shipped_at", "delivered_at", "cancelled_at", "returned_at",
    ].join(","),
    ...rows.map((o) =>
      [
        o.order_ref,
        o.created_at,
        o.status,
        esc(o.email),
        esc(o.customer_name ?? ""),
        esc(
          o.items
            .map(
              (it) =>
                `${it.title}${it.variant ? ` (${it.variant})` : ""} x${it.qty}`,
            )
            .join("; "),
        ),
        dollars(o.amount_total - o.shipping_cents),
        dollars(o.shipping_cents),
        dollars(o.amount_total),
        dollars(o.refunded_cents),
        dollars(o.amount_total - o.refunded_cents),
        o.carrier ?? "",
        esc(o.tracking_number ?? ""),
        o.shipped_at ?? "",
        o.delivered_at ?? "",
        o.cancelled_at ?? "",
        o.returned_at ?? "",
      ].join(","),
    ),
  ].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="roomie-orders.csv"`,
    },
  });
}
