import { db } from "@/lib/db";
import type { SubscriberRow } from "@/lib/types";

/* Roomie letter 订阅名单 CSV（middleware 已做 Host + 认证门） */
export async function GET() {
  const { data, error } = await db()
    .from("subscribers")
    .select("*")
    .order("created_at");
  if (error) return new Response(error.message, { status: 500 });
  const rows = (data ?? []) as SubscriberRow[];
  const esc = (s: string) => `"${s.replaceAll('"', '""')}"`;
  const csv = [
    "email,promo_code,source,welcome_emailed,joined",
    ...rows.map((r) =>
      [
        esc(r.email),
        esc(r.promo_code ?? ""),
        esc(r.source),
        r.emailed_at ? "yes" : "no",
        r.created_at,
      ].join(","),
    ),
  ].join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="roomie-letter.csv"`,
    },
  });
}
