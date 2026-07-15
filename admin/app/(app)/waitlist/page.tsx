import { db } from "@/lib/db";
import type { SubscriberRow, WaitlistRow } from "@/lib/types";

export default async function WaitlistPage() {
  const [wl, subs] = await Promise.all([
    db().from("waitlist").select("*").order("created_at", { ascending: true }),
    db()
      .from("subscribers")
      .select("*")
      .order("created_at", { ascending: false }),
  ]);
  if (wl.error) throw new Error(wl.error.message);
  if (subs.error) throw new Error(subs.error.message);
  const rows = (wl.data ?? []) as WaitlistRow[];
  const letter = (subs.data ?? []) as SubscriberRow[];
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

      <section>
        <h2>
          The Roomie letter <span className="badge">{letter.length}</span>
        </h2>
        <p>
          Newsletter signups from the promo bar. Each gets a one-use 10% code
          (ROOMIE10 coupon). ·{" "}
          <a href="/waitlist/letter-export">download CSV</a>
        </p>
        {letter.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Code</th>
                <th>Welcome email</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {letter.map((s) => (
                <tr key={s.id}>
                  <td>{s.email}</td>
                  <td className="mono">{s.promo_code ?? "pending"}</td>
                  <td>{s.emailed_at ? "sent" : "not sent"}</td>
                  <td>{new Date(s.created_at).toLocaleDateString("en-AU")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="hint">No letter signups yet.</p>
        )}
      </section>
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
