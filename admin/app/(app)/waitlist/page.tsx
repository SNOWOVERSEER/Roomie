import { db } from "@/lib/db";
import type { WaitlistRow } from "@/lib/types";

export default async function WaitlistPage() {
  const { data, error } = await db()
    .from("waitlist")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as WaitlistRow[];
  const groups = new Map<string, WaitlistRow[]>();
  for (const r of rows) {
    const list = groups.get(r.product_handle);
    if (list) list.push(r);
    else groups.set(r.product_handle, [r]);
  }
  return (
    <>
      <h1>Waitlist</h1>
      <p>
        {rows.length} signups · <a href="/waitlist/export">download CSV</a>
      </p>
      {[...groups.entries()].map(([handle, list]) => (
        <section key={handle}>
          <h2>
            <span className="mono">{handle}</span>{" "}
            <span className="badge">{list.length}</span>
          </h2>
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id}>
                  <td>{r.email}</td>
                  <td>{new Date(r.created_at).toLocaleDateString("en-AU")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
      {rows.length === 0 && <p className="hint">No signups yet.</p>}
    </>
  );
}
