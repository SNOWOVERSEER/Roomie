import Link from "next/link";
import { db } from "@/lib/db";
import { formatCents, type OrderRow, type WaitlistRow } from "@/lib/types";

/*
 * 客户视图：orders 按 email 聚合（无账号系统，email 即客户身份），
 * waitlist 交叉标记。量级小，全部 JS 聚合。
 */

type OrderLite = Pick<
  OrderRow,
  | "order_ref" | "created_at" | "amount_total" | "refunded_cents"
  | "status" | "customer_name" | "email"
>;

interface Customer {
  email: string;
  name: string | null;
  orders: OrderLite[];
  netCents: number;
  lastAt: string;
  waitlists: string[];
}

export default async function CustomersPage() {
  const [ordersQ, wlQ] = await Promise.all([
    db()
      .from("orders")
      .select(
        "order_ref,created_at,amount_total,refunded_cents,status,customer_name,email",
      )
      .order("created_at", { ascending: false })
      .limit(2000),
    db().from("waitlist").select("*"),
  ]);
  if (ordersQ.error) throw new Error(ordersQ.error.message);
  if (wlQ.error) throw new Error(wlQ.error.message);

  const map = new Map<string, Customer>();
  for (const o of (ordersQ.data ?? []) as OrderLite[]) {
    const key = o.email.toLowerCase();
    const c = map.get(key) ?? {
      email: o.email,
      name: null,
      orders: [],
      netCents: 0,
      lastAt: o.created_at,
      waitlists: [],
    };
    c.orders.push(o);
    c.netCents += o.amount_total - o.refunded_cents;
    c.name ??= o.customer_name; // 列表按时间倒序，首个非空名即最新
    if (o.created_at > c.lastAt) c.lastAt = o.created_at;
    map.set(key, c);
  }
  for (const w of (wlQ.data ?? []) as WaitlistRow[]) {
    const key = w.email.toLowerCase();
    const c = map.get(key);
    if (c && !c.waitlists.includes(w.product_handle)) {
      c.waitlists.push(w.product_handle);
    }
  }
  const customers = [...map.values()].sort((a, b) => b.netCents - a.netCents);
  const wlOnly = ((wlQ.data ?? []) as WaitlistRow[]).filter(
    (w) => !map.has(w.email.toLowerCase()),
  );

  return (
    <>
      <h1>Customers</h1>
      <p className="hint">
        {customers.length} customer{customers.length === 1 ? "" : "s"} with
        orders · {wlOnly.length} on the waitlist only (see{" "}
        <Link href="/waitlist">Waitlist</Link>)
      </p>
      {customers.length === 0 ? (
        <p className="hint">No customers yet. The wall is patient.</p>
      ) : (
        customers.map((c) => (
          <details key={c.email}>
            <summary>
              <b>{c.name ?? c.email}</b>
              <span className="hint">{c.email}</span>
              <span style={{ flex: 1 }} />
              <span>
                {c.orders.length} order{c.orders.length === 1 ? "" : "s"}
              </span>
              <b>{formatCents(c.netCents)}</b>
              {c.waitlists.map((h) => (
                <span key={h} className="badge">wl: {h}</span>
              ))}
            </summary>
            <div className="body">
              <p style={{ marginTop: 4 }}>
                <a href={`mailto:${c.email}`}>{c.email}</a>
                <span className="hint">
                  {" "}· last order{" "}
                  {new Date(c.lastAt).toLocaleDateString("en-AU")}
                </span>
              </p>
              <table style={{ margin: "8px 0", maxWidth: 720 }}>
                <thead>
                  <tr><th>Order</th><th>Date</th><th>Total</th><th>Refunded</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {c.orders.map((o) => (
                    <tr key={o.order_ref}>
                      <td className="mono">#{o.order_ref}</td>
                      <td>{new Date(o.created_at).toLocaleDateString("en-AU")}</td>
                      <td>{formatCents(o.amount_total)}</td>
                      <td>{o.refunded_cents > 0 ? `−${formatCents(o.refunded_cents)}` : "·"}</td>
                      <td>
                        <span className={`badge ${o.status}`}>
                          {o.status.replaceAll("_", " ")}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="hint">
                Manage these orders (email, refund, returns) from the{" "}
                <Link href="/orders">Orders</Link> page.
              </p>
            </div>
          </details>
        ))
      )}
    </>
  );
}
