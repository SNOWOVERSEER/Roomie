import { db } from "@/lib/db";
import type { WaitlistRow } from "@/lib/types";

/* CSV 导出（middleware 已做 Host + 认证门；无 cookie 到不了这里） */
export async function GET() {
  const { data, error } = await db()
    .from("waitlist")
    .select("*")
    .order("product_handle")
    .order("created_at");
  if (error) return new Response(error.message, { status: 500 });
  const rows = (data ?? []) as WaitlistRow[];
  const esc = (s: string) => `"${s.replaceAll('"', '""')}"`;
  const csv = [
    "product,email,joined",
    ...rows.map((r) =>
      [esc(r.product_handle), esc(r.email), r.created_at].join(","),
    ),
  ].join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="roomie-waitlist.csv"`,
    },
  });
}
