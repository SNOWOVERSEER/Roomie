"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatCents, LOW_STOCK_AT, type StockItemRow } from "@/lib/types";

/*
 * 交互式 Dashboard（数据由服务端一次下发，交互零往返）：
 * - 周期切换 Today/7d/30d/90d/All，KPI 带上一周期环比
 * - 图表：营收/单量双指标，悬停逐列提示（今日橙色高亮）
 * - Needs attention 行动卡（直达 Orders 预筛选/Products）
 * - Activity 动态流（下单/发货/送达/取消/退货/退款/候补）
 * - Top products 随周期变化（缩略图 + 份额条）
 * 约定：所有时间窗基于服务端下发的 now（SSR/水合一致）；
 * 相对时间元素 suppressHydrationWarning。
 */

export interface DashOrder {
  order_ref: string;
  created_at: string;
  amount_total: number;
  refunded_cents: number;
  status: string;
  items: { handle: string; title: string; variant?: string; qty: number; unit_cents: number }[];
  customer_name: string | null;
  email: string;
  shipped_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  returned_at: string | null;
}
export interface DashRefund {
  message: string;
  created_at: string;
  order_ref: string | null;
}
export interface DashWaitlist {
  email: string;
  product_handle: string;
  created_at: string;
}

interface Props {
  now: number;
  orders: DashOrder[];
  refunds: DashRefund[];
  waitlist: DashWaitlist[];
  stock: StockItemRow[];
  images: Record<string, string>;
  artThumbs: Record<string, string>;
}

const DAY = 86_400_000;

type PeriodKey = "today" | "7d" | "30d" | "90d" | "all";
const PERIODS: { key: PeriodKey; label: string; days: number | null }[] = [
  { key: "today", label: "Today", days: null },
  { key: "7d", label: "7 days", days: 7 },
  { key: "30d", label: "30 days", days: 30 },
  { key: "90d", label: "90 days", days: 90 },
  { key: "all", label: "All time", days: null },
];

const net = (o: DashOrder) => o.amount_total - o.refunded_cents;
const inWin = (iso: string, from: number, to: number) => {
  const t = new Date(iso).getTime();
  return t >= from && t < to;
};

interface Metrics {
  revenue: number;
  orders: number;
  aov: number;
  units: number;
  refunded: number;
  shipHours: number | null;
}

function metricsFor(orders: DashOrder[], from: number, to: number): Metrics {
  const list = orders.filter((o) => inWin(o.created_at, from, to));
  const revenue = list.reduce((a, o) => a + net(o), 0);
  const gross = list.reduce((a, o) => a + o.amount_total, 0);
  const sold = list.filter((o) => o.status !== "cancelled");
  const units = sold.reduce((a, o) => a + o.items.reduce((b, it) => b + it.qty, 0), 0);
  const refunded = list.reduce((a, o) => a + o.refunded_cents, 0);
  // 履约时效按发货时间归属周期（度量这段时间发货动作的快慢）
  const shipped = orders.filter((o) => o.shipped_at && inWin(o.shipped_at, from, to));
  const shipHours =
    shipped.length === 0
      ? null
      : shipped.reduce(
          (a, o) =>
            a + (new Date(o.shipped_at!).getTime() - new Date(o.created_at).getTime()),
          0,
        ) /
        shipped.length /
        3_600_000;
  return {
    revenue,
    orders: list.length,
    aov: list.length ? Math.round(gross / list.length) : 0,
    units,
    refunded,
    shipHours,
  };
}

const fmtHours = (h: number | null) =>
  h === null ? "·" : h < 48 ? `${h.toFixed(h < 10 ? 1 : 0)}h` : `${(h / 24).toFixed(1)}d`;

/** 环比：pct=null 表示上期为 0 或不适用（All time） */
function delta(cur: number, prev: number | null): number | null {
  if (prev === null || prev === 0) return null;
  return (cur - prev) / prev;
}

function Delta({
  value,
  goodWhen,
}: {
  value: number | null;
  /** up = 涨了是好事（营收）；down = 降了是好事（退款、发货时效） */
  goodWhen: "up" | "down";
}) {
  if (value === null) return <span className="delta flat">·</span>;
  if (Math.abs(value) < 0.0005) return <span className="delta flat">— 0%</span>;
  const up = value > 0;
  const good = (up && goodWhen === "up") || (!up && goodWhen === "down");
  const pct = Math.abs(value) >= 9.995 ? "999%+" : `${(Math.abs(value) * 100).toFixed(0)}%`;
  return (
    <span className={`delta ${good ? "good" : "bad"}`}>
      {up ? "↑" : "↓"} {pct}
      <span className="srOnly">{up ? " up" : " down"} vs previous period</span>
    </span>
  );
}

/* ―――――――――――――― 图表 ―――――――――――――― */

interface Bucket {
  key: string;
  label: string;
  cents: number;
  count: number;
  isNow: boolean;
}

function buildBuckets(orders: DashOrder[], period: PeriodKey, now: number): Bucket[] {
  const d = new Date(now);
  if (period === "today") {
    const buckets: Bucket[] = [];
    for (let h = 0; h < 24; h++) {
      buckets.push({
        key: `h${h}`,
        label: `${h === 0 ? 12 : h > 12 ? h - 12 : h} ${h < 12 ? "am" : "pm"}`,
        cents: 0,
        count: 0,
        isNow: h === d.getHours(),
      });
    }
    const midnight = new Date(now);
    midnight.setHours(0, 0, 0, 0);
    for (const o of orders) {
      const t = new Date(o.created_at);
      if (t.getTime() >= midnight.getTime()) {
        buckets[t.getHours()].cents += net(o);
        buckets[t.getHours()].count += 1;
      }
    }
    return buckets;
  }

  const dayKey = (x: Date) => x.toLocaleDateString("en-CA");
  const dayLabel = (x: Date) =>
    x.toLocaleDateString("en-AU", { day: "2-digit", month: "short" });

  let days: number;
  if (period === "all") {
    const first = orders.length
      ? Math.min(...orders.map((o) => new Date(o.created_at).getTime()))
      : now;
    days = Math.max(1, Math.ceil((now - first) / DAY) + 1);
    if (days > 120) {
      // 月桶
      const buckets: Bucket[] = [];
      const idx = new Map<string, number>();
      const cur = new Date(first);
      cur.setDate(1);
      const nowKey = `${d.getFullYear()}-${d.getMonth()}`;
      while (cur.getTime() <= now) {
        const key = `${cur.getFullYear()}-${cur.getMonth()}`;
        idx.set(key, buckets.length);
        buckets.push({
          key,
          label:
            cur.getMonth() === 0 || buckets.length === 0
              ? cur.toLocaleDateString("en-AU", { month: "short", year: "numeric" })
              : cur.toLocaleDateString("en-AU", { month: "short" }),
          cents: 0,
          count: 0,
          isNow: key === nowKey,
        });
        cur.setMonth(cur.getMonth() + 1);
      }
      for (const o of orders) {
        const t = new Date(o.created_at);
        const i = idx.get(`${t.getFullYear()}-${t.getMonth()}`);
        if (i !== undefined) {
          buckets[i].cents += net(o);
          buckets[i].count += 1;
        }
      }
      return buckets;
    }
  } else {
    days = { "7d": 7, "30d": 30, "90d": 90 }[period]!;
  }

  const buckets: Bucket[] = [];
  const idx = new Map<string, number>();
  const todayKey = dayKey(d);
  for (let i = days - 1; i >= 0; i--) {
    const x = new Date(now - i * DAY);
    const key = dayKey(x);
    idx.set(key, buckets.length);
    buckets.push({ key, label: dayLabel(x), cents: 0, count: 0, isNow: key === todayKey });
  }
  for (const o of orders) {
    const i = idx.get(dayKey(new Date(o.created_at)));
    if (i !== undefined) {
      buckets[i].cents += net(o);
      buckets[i].count += 1;
    }
  }
  return buckets;
}

function Chart({ buckets, metric }: { buckets: Bucket[]; metric: "revenue" | "orders" }) {
  const [hover, setHover] = useState<number | null>(null);
  const val = (b: Bucket) => (metric === "revenue" ? b.cents : b.count);
  const max = Math.max(...buckets.map(val), 1);
  const W = buckets.length * 20;
  const H = 132;
  const PLOT = 112;
  const empty = buckets.every((b) => val(b) === 0);

  return (
    <div className="chartWrap">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${metric === "revenue" ? "Net revenue" : "Orders"} per ${buckets.length > 31 ? "period" : "day"}`}
        onMouseLeave={() => setHover(null)}
      >
        {/* 25/50/75% 参考线 */}
        {[0.25, 0.5, 0.75].map((g) => (
          <line
            key={g}
            x1={0}
            x2={W}
            y1={PLOT - PLOT * g + 8}
            y2={PLOT - PLOT * g + 8}
            stroke="var(--line)"
            strokeWidth={1}
            strokeDasharray="3 5"
            opacity={0.6}
          />
        ))}
        <line x1={0} x2={W} y1={PLOT + 8} y2={PLOT + 8} stroke="var(--line)" strokeWidth={1} />
        {buckets.map((b, i) => {
          const v = val(b);
          const h = v === 0 ? 2 : Math.max(4, (v / max) * PLOT);
          const active = hover === i;
          return (
            <g key={b.key} onMouseEnter={() => setHover(i)}>
              {/* 命中区（整列） */}
              <rect x={i * 20} y={0} width={20} height={H} fill="transparent" />
              {active && (
                <rect x={i * 20} y={0} width={20} height={PLOT + 8} fill="var(--ink)" opacity={0.05} rx={4} />
              )}
              <rect
                x={i * 20 + 4}
                y={PLOT + 8 - h}
                width={12}
                height={h}
                rx={2}
                fill={b.isNow ? "var(--orange)" : "var(--blue)"}
                opacity={v === 0 ? 0.22 : active ? 1 : 0.88}
              />
            </g>
          );
        })}
      </svg>
      {empty && <p className="chartEmpty hint">Nothing in this window yet. The cats are patient.</p>}
      {hover !== null && !empty && (
        <div
          className="tip"
          style={{
            left: `${((hover + 0.5) / buckets.length) * 100}%`,
            transform: `translateX(${hover < 2 ? "0" : hover > buckets.length - 3 ? "-100%" : "-50%"})`,
          }}
        >
          <b>{buckets[hover].label}</b>
          <span>{formatCents(buckets[hover].cents)}</span>
          <span className="hint">
            {buckets[hover].count} order{buckets[hover].count === 1 ? "" : "s"}
          </span>
        </div>
      )}
    </div>
  );
}

/* ―――――――――――――― 动态流 ―――――――――――――― */

interface FeedEntry {
  at: string;
  cls: string;
  text: string;
}

function buildFeed(
  orders: DashOrder[],
  refunds: DashRefund[],
  waitlist: DashWaitlist[],
): FeedEntry[] {
  const feed: FeedEntry[] = [];
  for (const o of orders) {
    const who = o.customer_name ?? o.email;
    feed.push({
      at: o.created_at,
      cls: "paid",
      text: `#${o.order_ref} placed · ${formatCents(o.amount_total)} · ${who}`,
    });
    if (o.shipped_at) feed.push({ at: o.shipped_at, cls: "shipped", text: `#${o.order_ref} shipped` });
    if (o.delivered_at) feed.push({ at: o.delivered_at, cls: "delivered", text: `#${o.order_ref} delivered` });
    if (o.cancelled_at) feed.push({ at: o.cancelled_at, cls: "cancelled", text: `#${o.order_ref} cancelled` });
    if (o.returned_at) feed.push({ at: o.returned_at, cls: "returned", text: `#${o.order_ref} return received` });
  }
  for (const r of refunds) {
    feed.push({
      at: r.created_at,
      cls: "cancelled",
      text: `${r.message}${r.order_ref ? ` · #${r.order_ref}` : ""}`,
    });
  }
  for (const w of waitlist) {
    feed.push({ at: w.created_at, cls: "returned", text: `${w.product_handle} waitlist · ${w.email}` });
  }
  return feed.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 12);
}

function ago(iso: string, now: number): string {
  const s = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString("en-AU", { day: "2-digit", month: "short" });
}

/* ―――――――――――――― 主组件 ―――――――――――――― */

export default function Dashboard({
  now,
  orders,
  refunds,
  waitlist,
  stock,
  images,
  artThumbs,
}: Props) {
  const router = useRouter();
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [metric, setMetric] = useState<"revenue" | "orders">("revenue");
  const [refreshing, setRefreshing] = useState(false);

  const win = useMemo(() => {
    if (period === "all") return { from: 0, to: now + 1, prevFrom: null as number | null, prevTo: 0 };
    if (period === "today") {
      const midnight = new Date(now);
      midnight.setHours(0, 0, 0, 0);
      const from = midnight.getTime();
      return { from, to: now + 1, prevFrom: from - DAY, prevTo: from };
    }
    const days = { "7d": 7, "30d": 30, "90d": 90 }[period]!;
    const from = now - days * DAY;
    return { from, to: now + 1, prevFrom: from - days * DAY, prevTo: from };
  }, [period, now]);

  const cur = useMemo(() => metricsFor(orders, win.from, win.to), [orders, win]);
  const prev = useMemo(
    () => (win.prevFrom === null ? null : metricsFor(orders, win.prevFrom, win.prevTo)),
    [orders, win],
  );
  const buckets = useMemo(() => buildBuckets(orders, period, now), [orders, period, now]);
  const feed = useMemo(() => buildFeed(orders, refunds, waitlist), [orders, refunds, waitlist]);

  // Top products（周期内，取消单剔除）
  const top = useMemo(() => {
    const m = new Map<string, { handle: string; variant?: string; title: string; units: number; cents: number }>();
    for (const o of orders) {
      if (o.status === "cancelled" || !inWin(o.created_at, win.from, win.to)) continue;
      for (const it of o.items) {
        const key = `${it.handle}·${it.variant ?? ""}`;
        const row =
          m.get(key) ??
          { handle: it.handle, variant: it.variant, title: `${it.title}${it.variant ? ` · ${it.variant}` : ""}`, units: 0, cents: 0 };
        row.units += it.qty;
        row.cents += it.unit_cents * it.qty;
        m.set(key, row);
      }
    }
    return [...m.values()].sort((a, b) => b.cents - a.cents).slice(0, 6);
  }, [orders, win]);
  const topMax = Math.max(...top.map((t) => t.cents), 1);

  // 待办
  const toShip = orders.filter((o) => o.status === "paid").length;
  const returning = orders.filter((o) => o.status === "return_requested").length;
  const oversold = stock.filter((s) => s.stock !== null && s.stock < 0);
  const soldOut = stock.filter((s) => s.stock === 0 && s.available);
  const low = stock.filter(
    (s) => s.stock !== null && s.stock > 0 && s.stock < LOW_STOCK_AT,
  );
  const allClear =
    toShip === 0 && returning === 0 && oversold.length === 0 && soldOut.length === 0 && low.length === 0;

  const byStatus = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of orders) m.set(o.status, (m.get(o.status) ?? 0) + 1);
    return m;
  }, [orders]);

  const kpis: { label: string; value: string; d: number | null; goodWhen: "up" | "down" }[] = [
    { label: "Net revenue", value: formatCents(cur.revenue), d: delta(cur.revenue, prev?.revenue ?? null), goodWhen: "up" },
    { label: "Orders", value: String(cur.orders), d: delta(cur.orders, prev?.orders ?? null), goodWhen: "up" },
    { label: "Avg order", value: cur.orders ? formatCents(cur.aov) : "·", d: delta(cur.aov, prev?.aov ?? null), goodWhen: "up" },
    { label: "Units sold", value: String(cur.units), d: delta(cur.units, prev?.units ?? null), goodWhen: "up" },
    { label: "Refunded", value: cur.refunded > 0 ? `−${formatCents(cur.refunded)}` : "AU$0", d: delta(cur.refunded, prev?.refunded ?? null), goodWhen: "down" },
    { label: "Time to ship", value: fmtHours(cur.shipHours), d: cur.shipHours !== null && prev?.shipHours != null ? delta(cur.shipHours, prev.shipHours) : null, goodWhen: "down" },
  ];

  const periodLabel = PERIODS.find((p) => p.key === period)!.label.toLowerCase();

  return (
    <>
      <div className="pageHead">
        <h1>Dashboard</h1>
        <div className="row">
          <span className="hint" suppressHydrationWarning>
            Updated{" "}
            {new Date(now).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}
          </span>
          <button
            className="ghost"
            disabled={refreshing}
            onClick={() => {
              setRefreshing(true);
              router.refresh();
              setTimeout(() => setRefreshing(false), 900);
            }}
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      <div className="chips" role="group" aria-label="Reporting period">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            className={`chip ${period === p.key ? "chipOn" : ""}`}
            onClick={() => setPeriod(p.key)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="kpis">
        {kpis.map((k) => (
          <div className="kpi" key={k.label}>
            <div className="kpiLabel">{k.label}</div>
            <div className="kpiValue">{k.value}</div>
            <div className="kpiFoot">
              <Delta value={k.d} goodWhen={k.goodWhen} />
              <span className="hint">{period === "all" ? "all time" : `vs prior ${periodLabel}`}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="chartCard" style={{ marginTop: 14 }}>
        <div className="chartHead">
          <h2 style={{ margin: 0 }}>
            {metric === "revenue" ? "Net revenue" : "Orders"} ·{" "}
            {period === "today" ? "by hour" : buckets.length > 31 ? "by month" : "by day"}
          </h2>
          <div className="chips">
            <button
              className={`chip ${metric === "revenue" ? "chipOn" : ""}`}
              onClick={() => setMetric("revenue")}
            >
              Revenue
            </button>
            <button
              className={`chip ${metric === "orders" ? "chipOn" : ""}`}
              onClick={() => setMetric("orders")}
            >
              Orders
            </button>
          </div>
        </div>
        <Chart buckets={buckets} metric={metric} />
        <div className="chartAxis hint">
          <span>{buckets[0]?.label}</span>
          <span>
            peak{" "}
            {metric === "revenue"
              ? formatCents(Math.max(...buckets.map((b) => b.cents), 0))
              : Math.max(...buckets.map((b) => b.count), 0)}
          </span>
          <span>{buckets[buckets.length - 1]?.label}</span>
        </div>
      </div>

      <div className="cols" style={{ marginTop: 20 }}>
        <div>
          <h2 style={{ marginTop: 0 }}>Needs attention</h2>
          <div className="attn">
            {allClear && (
              <p className="hint" style={{ margin: 0 }}>
                All clear. The shop runs itself today.
              </p>
            )}
            {toShip > 0 && (
              <Link className="attnRow" href="/orders?status=paid">
                <span className="badge paid">to ship</span>
                <span>
                  <b>{toShip}</b> order{toShip === 1 ? "" : "s"} waiting for a label
                </span>
                <span className="attnGo">→</span>
              </Link>
            )}
            {returning > 0 && (
              <Link className="attnRow" href="/orders?status=return_requested">
                <span className="badge return_requested">returns</span>
                <span>
                  <b>{returning}</b> return{returning === 1 ? "" : "s"} in progress
                </span>
                <span className="attnGo">→</span>
              </Link>
            )}
            {oversold.map((s) => (
              <Link className="attnRow" href="/products" key={s.id}>
                <span className="badge cancelled">oversold</span>
                <span>
                  <b>{s.label}</b> at {s.stock}. Check recent orders
                </span>
                <span className="attnGo">→</span>
              </Link>
            ))}
            {soldOut.map((s) => (
              <Link className="attnRow" href="/products" key={s.id}>
                <span className="badge cancelled">sold out</span>
                <span>
                  <b>{s.label}</b> is out of stock
                </span>
                <span className="attnGo">→</span>
              </Link>
            ))}
            {low.map((s) => (
              <Link className="attnRow" href="/products" key={s.id}>
                <span className="badge paid">low</span>
                <span>
                  <b>{s.label}</b> down to {s.stock}
                </span>
                <span className="attnGo">→</span>
              </Link>
            ))}
          </div>

          <h2>Top products</h2>
          {top.length === 0 ? (
            <p className="hint">No sales in this window. Try a longer period.</p>
          ) : (
            <div className="topList">
              {top.map((t) => {
                const thumb =
                  (t.variant && artThumbs[t.variant]) || images[t.handle] || null;
                return (
                  <div className="topRow" key={t.title}>
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumb} alt="" className="thumb" loading="lazy" />
                    ) : (
                      <span className="thumb" />
                    )}
                    <div className="topMain">
                      <span className="topTitle">{t.title}</span>
                      <span className="shareBar">
                        <span style={{ width: `${Math.max(4, (t.cents / topMax) * 100)}%` }} />
                      </span>
                    </div>
                    <span className="hint num">×{t.units}</span>
                    <b className="num">{formatCents(t.cents)}</b>
                  </div>
                );
              })}
            </div>
          )}

          <h2>Orders by status</h2>
          <p className="pills">
            {["paid", "shipped", "delivered", "return_requested", "returned", "cancelled"]
              .filter((s) => (byStatus.get(s) ?? 0) > 0)
              .map((s) => (
                <Link key={s} href={`/orders?status=${s}`} className="pillLink">
                  <span className={`badge ${s}`}>{s.replaceAll("_", " ")}</span>
                  <b>{byStatus.get(s)}</b>
                </Link>
              ))}
            {orders.length === 0 && <span className="hint">No orders yet.</span>}
          </p>
        </div>

        <div>
          <h2 style={{ marginTop: 0 }}>
            Activity <Link href="/orders" className="hint" style={{ fontWeight: 400 }}>all orders</Link>
          </h2>
          {feed.length === 0 ? (
            <p className="hint">Quiet so far. The first order rings loudest.</p>
          ) : (
            <ul className="feed">
              {feed.map((e, i) => (
                <li key={i}>
                  <span className={`feedDot ${e.cls}`} aria-hidden />
                  <span className="feedText">{e.text}</span>
                  <span className="hint num" suppressHydrationWarning>
                    {ago(e.at, now)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
