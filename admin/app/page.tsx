import Link from "next/link";
import { db } from "@/lib/db";
import {
  formatCents,
  LOW_STOCK_AT,
  type OrderRow,
  type StockItemRow,
} from "@/lib/types";

/*
 * Dashboard：小店量级全部 JS 聚合（订单全列拉回内存算，遵守
 * 「jsonb 不上 PostgREST 过滤」的既有约定）。
 * 净营收 = amount_total − refunded_cents，按下单日归属（含运费，对齐收款口径）。
 */

const DAYS = 30;

const dayKey = (d: Date) => d.toLocaleDateString("en-CA"); // YYYY-MM-DD（本地时区）

type OrderLite = Pick<
  OrderRow,
  | "order_ref" | "created_at" | "amount_total" | "refunded_cents"
  | "status" | "items" | "customer_name" | "email"
>;

export default async function DashboardPage() {
  const [ordersQ, stockQ, waitlistQ] = await Promise.all([
    db()
      .from("orders")
      .select(
        "order_ref,created_at,amount_total,refunded_cents,status,items,customer_name,email",
      )
      .order("created_at", { ascending: false })
      .limit(2000),
    db().from("stock_items").select("*").order("sort", { ascending: true }),
    db().from("waitlist").select("product_handle"),
  ]);
  if (ordersQ.error) throw new Error(ordersQ.error.message);
  if (stockQ.error) throw new Error(stockQ.error.message);
  if (waitlistQ.error) throw new Error(waitlistQ.error.message);

  const orders = (ordersQ.data ?? []) as OrderLite[];
  const stock = (stockQ.data ?? []) as StockItemRow[];
  const waitlist = (waitlistQ.data ?? []) as { product_handle: string }[];

  const net = (o: OrderLite) => o.amount_total - o.refunded_cents;
  const now = new Date();
  const since = (days: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    return d;
  };
  const within = (o: OrderLite, from: Date) => new Date(o.created_at) >= from;

  const todayKey = dayKey(now);
  const today = orders.filter((o) => dayKey(new Date(o.created_at)) === todayKey);
  const last7 = orders.filter((o) => within(o, since(7)));
  const last30 = orders.filter((o) => within(o, since(30)));

  const sum = (list: OrderLite[]) => list.reduce((a, o) => a + net(o), 0);
  const aov30 =
    last30.length === 0
      ? 0
      : Math.round(last30.reduce((a, o) => a + o.amount_total, 0) / last30.length);
  const refundedAll = orders.reduce((a, o) => a + o.refunded_cents, 0);

  const byStatus = new Map<string, number>();
  for (const o of orders) byStatus.set(o.status, (byStatus.get(o.status) ?? 0) + 1);

  // 30 天柱状图（净营收/日）
  const days: { key: string; label: string; cents: number }[] = [];
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = since(i);
    days.push({
      key: dayKey(d),
      label: d.toLocaleDateString("en-AU", { day: "2-digit", month: "short" }),
      cents: 0,
    });
  }
  const dayIndex = new Map(days.map((d, i) => [d.key, i]));
  for (const o of orders) {
    const i = dayIndex.get(dayKey(new Date(o.created_at)));
    if (i !== undefined) days[i].cents += net(o);
  }
  const maxDay = Math.max(...days.map((d) => d.cents), 1);

  // Top products（handle+variant 粒度，gross）
  const top = new Map<string, { title: string; units: number; cents: number }>();
  for (const o of orders) {
    if (o.status === "cancelled") continue; // 取消单不算卖出
    for (const it of o.items) {
      const key = `${it.handle}·${it.variant ?? ""}`;
      const row = top.get(key) ?? {
        title: `${it.title}${it.variant ? ` · ${it.variant}` : ""}`,
        units: 0,
        cents: 0,
      };
      row.units += it.qty;
      row.cents += it.unit_cents * it.qty;
      top.set(key, row);
    }
  }
  const topRows = [...top.values()].sort((a, b) => b.cents - a.cents).slice(0, 8);

  // 库存警报：跟踪中且（超卖/售罄/低于阈值）或已退役
  const alerts = stock.filter(
    (s) => (s.stock !== null && s.stock < LOW_STOCK_AT) || !s.available,
  );

  const wlCounts = new Map<string, number>();
  for (const w of waitlist) {
    wlCounts.set(w.product_handle, (wlCounts.get(w.product_handle) ?? 0) + 1);
  }

  const kpis = [
    { label: "Net revenue · today", value: formatCents(sum(today)) },
    { label: "Net revenue · 7 days", value: formatCents(sum(last7)) },
    { label: "Net revenue · 30 days", value: formatCents(sum(last30)) },
    { label: "Orders · 30 days", value: String(last30.length) },
    { label: "Avg order · 30 days", value: last30.length ? formatCents(aov30) : "·" },
    { label: "Refunded · all time", value: refundedAll > 0 ? `−${formatCents(refundedAll)}` : "AU$0" },
  ];

  const openToShip = byStatus.get("paid") ?? 0;
  const openReturns = byStatus.get("return_requested") ?? 0;

  return (
    <>
      <h1>Dashboard</h1>

      {(openToShip > 0 || openReturns > 0) && (
        <p>
          {openToShip > 0 && (
            <Link href="/orders">
              <b>{openToShip}</b> order{openToShip === 1 ? "" : "s"} to ship
            </Link>
          )}
          {openToShip > 0 && openReturns > 0 && " · "}
          {openReturns > 0 && (
            <Link href="/orders">
              <b>{openReturns}</b> return{openReturns === 1 ? "" : "s"} in progress
            </Link>
          )}
        </p>
      )}

      <div className="kpis">
        {kpis.map((k) => (
          <div className="kpi" key={k.label}>
            <div className="kpiLabel">{k.label}</div>
            <div className="kpiValue">{k.value}</div>
          </div>
        ))}
      </div>

      <h2>Last {DAYS} days · net revenue</h2>
      <div className="chartCard">
        {sum(last30) === 0 ? (
          <p className="hint" style={{ margin: 0 }}>No revenue in this window yet.</p>
        ) : (
          <svg
            viewBox={`0 0 ${DAYS * 20} 120`}
            width="100%"
            height="120"
            role="img"
            aria-label={`Daily net revenue, last ${DAYS} days`}
            preserveAspectRatio="none"
          >
            {days.map((d, i) => {
              const h = d.cents === 0 ? 2 : Math.max(4, (d.cents / maxDay) * 108);
              return (
                <rect
                  key={d.key}
                  x={i * 20 + 3}
                  y={112 - h}
                  width={14}
                  height={h}
                  rx={2}
                  fill={d.key === todayKey ? "var(--orange)" : "var(--blue)"}
                  opacity={d.cents === 0 ? 0.25 : 1}
                >
                  <title>{`${d.label} · ${formatCents(d.cents)}`}</title>
                </rect>
              );
            })}
          </svg>
        )}
        <div className="chartAxis hint">
          <span>{days[0].label}</span>
          <span>peak {formatCents(maxDay)}</span>
          <span>{days[days.length - 1].label}</span>
        </div>
      </div>

      <div className="cols" style={{ marginTop: 18 }}>
        <div>
          <h2 style={{ marginTop: 0 }}>Top products</h2>
          {topRows.length === 0 ? (
            <p className="hint">No sales yet.</p>
          ) : (
            <table>
              <thead>
                <tr><th>Product</th><th>Units</th><th>Gross</th></tr>
              </thead>
              <tbody>
                {topRows.map((r) => (
                  <tr key={r.title}>
                    <td>{r.title}</td>
                    <td>{r.units}</td>
                    <td>{formatCents(r.cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h2>Orders by status</h2>
          <p>
            {["paid", "shipped", "delivered", "return_requested", "returned", "cancelled"]
              .filter((s) => (byStatus.get(s) ?? 0) > 0)
              .map((s) => (
                <span key={s} style={{ marginRight: 8 }}>
                  <span className={`badge ${s}`}>{s.replaceAll("_", " ")}</span>{" "}
                  {byStatus.get(s)}
                </span>
              ))}
            {orders.length === 0 && <span className="hint">No orders yet.</span>}
          </p>
        </div>

        <div>
          <h2 style={{ marginTop: 0 }}>
            Inventory alerts <Link href="/products" className="hint">manage</Link>
          </h2>
          {alerts.length === 0 ? (
            <p className="hint">All tracked units look healthy.</p>
          ) : (
            <table>
              <thead>
                <tr><th>Unit</th><th>Stock</th><th>State</th></tr>
              </thead>
              <tbody>
                {alerts.map((s) => (
                  <tr key={s.id}>
                    <td>{s.label}</td>
                    <td className="mono">{s.stock === null ? "∞" : s.stock}</td>
                    <td>
                      {!s.available ? (
                        <span className="badge">retired</span>
                      ) : s.stock !== null && s.stock < 0 ? (
                        <span className="warn">OVERSOLD</span>
                      ) : s.stock === 0 ? (
                        <span className="warn">sold out</span>
                      ) : (
                        <span className="badge paid">low</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h2>Waitlist</h2>
          {wlCounts.size === 0 ? (
            <p className="hint">No signups yet.</p>
          ) : (
            <p>
              {[...wlCounts.entries()].map(([h, n]) => (
                <span key={h} style={{ marginRight: 10 }}>
                  <span className="mono">{h}</span> <b>{n}</b>
                </span>
              ))}
              {" · "}
              <Link href="/waitlist">view</Link>
            </p>
          )}

          <h2>Latest orders</h2>
          {orders.length === 0 ? (
            <p className="hint">No orders yet.</p>
          ) : (
            <table>
              <tbody>
                {orders.slice(0, 5).map((o) => (
                  <tr key={o.order_ref}>
                    <td className="mono">#{o.order_ref}</td>
                    <td>{new Date(o.created_at).toLocaleDateString("en-AU")}</td>
                    <td>{o.customer_name ?? o.email}</td>
                    <td>{formatCents(o.amount_total)}</td>
                    <td><span className={`badge ${o.status}`}>{o.status.replaceAll("_", " ")}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p>
            <Link href="/orders">All orders</Link>
          </p>
        </div>
      </div>
    </>
  );
}
