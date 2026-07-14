"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  formatCents,
  type OrderEventRow,
  type OrderStatus,
  type OrderWithEvents,
} from "@/lib/types";
import {
  cancelOrder,
  cancelReturn,
  emailCustomer,
  markDelivered,
  markReturned,
  refundOrder,
  requestReturn,
  resendConfirmation,
  resendShippingEmail,
  saveNote,
  shipOrder,
} from "@/lib/orderActions";

/*
 * 订单工作台：搜索（ref/邮箱/姓名/运单/商品）+ 状态 chips 过滤 + 分组视图。
 * 每单可展开：明细/地址/支付（Stripe 链接+退款）/时间线/内部备注/按状态动作。
 * 危险动作（取消/退款/收退货）走内联两步确认面板，restock 开关就地可见。
 */

type Result = { ok: true } | { error: string };

const GROUPS: { status: OrderStatus; title: string }[] = [
  { status: "paid", title: "To ship" },
  { status: "return_requested", title: "Returns in progress" },
  { status: "shipped", title: "Shipped" },
  { status: "delivered", title: "Delivered" },
  { status: "returned", title: "Returned" },
  { status: "cancelled", title: "Cancelled" },
];

const STATUS_LABEL: Record<OrderStatus, string> = {
  paid: "to ship",
  shipped: "shipped",
  delivered: "delivered",
  return_requested: "return requested",
  returned: "returned",
  cancelled: "cancelled",
};

export default function OrdersList({
  orders,
  mode,
}: {
  orders: OrderWithEvents[];
  mode: "test" | "live" | "unknown";
}) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<OrderStatus | "all">("all");

  const counts = useMemo(() => {
    const c = new Map<OrderStatus, number>();
    for (const o of orders) c.set(o.status, (c.get(o.status) ?? 0) + 1);
    return c;
  }, [orders]);

  const needle = q.trim().toLowerCase();
  const matches = (o: OrderWithEvents) =>
    !needle ||
    o.order_ref.includes(needle) ||
    o.email.toLowerCase().includes(needle) ||
    (o.customer_name ?? "").toLowerCase().includes(needle) ||
    (o.tracking_number ?? "").toLowerCase().includes(needle) ||
    o.items.some(
      (it) =>
        it.title.toLowerCase().includes(needle) ||
        (it.variant ?? "").toLowerCase().includes(needle),
    );

  const filtering = needle !== "" || filter !== "all";
  const flat = orders.filter(
    (o) => matches(o) && (filter === "all" || o.status === filter),
  );

  return (
    <>
      <div className="toolbar">
        <input
          type="search"
          placeholder="Search ref, email, name, tracking, item…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search orders"
          style={{ minWidth: 280 }}
        />
        <div className="chips" role="group" aria-label="Filter by status">
          <button
            className={`chip ${filter === "all" ? "chipOn" : ""}`}
            onClick={() => setFilter("all")}
          >
            All {orders.length}
          </button>
          {GROUPS.map((g) => (
            <button
              key={g.status}
              className={`chip ${filter === g.status ? "chipOn" : ""}`}
              onClick={() =>
                setFilter(filter === g.status ? "all" : g.status)
              }
            >
              {g.title} {counts.get(g.status) ?? 0}
            </button>
          ))}
        </div>
        <a href="/orders/export" className="hint" style={{ marginLeft: "auto" }}>
          Export CSV
        </a>
      </div>

      {filtering ? (
        <section>
          <h2>
            Results <span className="badge">{flat.length}</span>
          </h2>
          {flat.length === 0 ? (
            <p className="hint">Nothing matches.</p>
          ) : (
            flat.map((o) => <Order key={o.id} o={o} mode={mode} />)
          )}
        </section>
      ) : (
        GROUPS.map((g) => {
          const list = orders.filter((o) => o.status === g.status);
          if (list.length === 0 && g.status !== "paid") return null;
          return (
            <section key={g.status}>
              <h2>
                {g.title}{" "}
                <span className={`badge ${g.status}`}>{list.length}</span>
              </h2>
              {list.length === 0 ? (
                <p className="hint">none</p>
              ) : (
                list.map((o) => <Order key={o.id} o={o} mode={mode} />)
              )}
            </section>
          );
        })
      )}
    </>
  );
}

function addressLines(o: OrderWithEvents): string[] {
  const a = (o.shipping_address ?? {}) as {
    name?: string; line1?: string; line2?: string; city?: string;
    state?: string; postal_code?: string; country?: string;
  };
  return [
    a.name,
    a.line1,
    a.line2,
    [a.city, a.state, a.postal_code].filter(Boolean).join(" "),
    a.country,
  ].filter((s): s is string => !!s);
}

/** 时间线 = 里程碑（orders 列派生）+ order_events 流水，按时间升序 */
function timeline(o: OrderWithEvents): { at: string; text: string }[] {
  const t = [
    { at: o.created_at, text: `Order placed · ${formatCents(o.amount_total)}` },
  ];
  if (o.shipped_at)
    t.push({
      at: o.shipped_at,
      text: `Shipped${o.carrier ? ` · ${o.carrier}` : ""}${o.tracking_number ? ` · ${o.tracking_number}` : ""}`,
    });
  if (o.delivered_at) t.push({ at: o.delivered_at, text: "Delivered" });
  if (o.return_requested_at)
    t.push({
      at: o.return_requested_at,
      text: `Return requested${o.return_reason ? ` · ${o.return_reason}` : ""}`,
    });
  if (o.returned_at) t.push({ at: o.returned_at, text: "Return received" });
  if (o.cancelled_at) t.push({ at: o.cancelled_at, text: "Cancelled" });
  for (const e of (o.order_events ?? []) as OrderEventRow[]) {
    t.push({ at: e.created_at, text: e.message });
  }
  return t.sort((a, b) => a.at.localeCompare(b.at));
}

const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString("en-AU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

type Panel = null | "cancel" | "refund" | "return" | "returned" | "email";

function Order({
  o,
  mode,
}: {
  o: OrderWithEvents;
  mode: "test" | "live" | "unknown";
}) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<Result>) =>
    startTransition(async () => {
      const r = await fn();
      if ("error" in r) setErr(r.error);
      else {
        setErr(null);
        setPanel(null);
        router.refresh();
      }
    });

  const remaining = o.amount_total - o.refunded_cents;
  const canRefund = remaining > 0 && !!o.stripe_payment_intent_id;
  const refundBadge =
    o.refunded_cents <= 0
      ? null
      : o.refunded_cents >= o.amount_total
        ? "refunded"
        : "partly refunded";

  const itemsSummary = o.items
    .map((it) => `${it.title}${it.variant ? ` (${it.variant})` : ""} ×${it.qty}`)
    .join(", ");

  const toggle = (p: Panel) => {
    setErr(null);
    setPanel(panel === p ? null : p);
  };

  return (
    <details>
      <summary>
        <b className="mono">#{o.order_ref}</b>
        <span>{new Date(o.created_at).toLocaleDateString("en-AU")}</span>
        <span>{o.customer_name ?? o.email}</span>
        <span className="hint" style={{ flex: 1 }}>{itemsSummary}</span>
        <b>{formatCents(o.amount_total)}</b>
        {refundBadge && <span className="badge refund">{refundBadge}</span>}
        <span className={`badge ${o.status}`}>{STATUS_LABEL[o.status]}</span>
      </summary>
      <div className="body">
        <table style={{ margin: "8px 0" }}>
          <thead>
            <tr><th>Item</th><th>Variant</th><th>Qty</th><th>Unit</th></tr>
          </thead>
          <tbody>
            {o.items.map((it, i) => (
              <tr key={i}>
                <td>{it.title}</td>
                <td>{it.variant ?? "·"}</td>
                <td>{it.qty}</td>
                <td>{formatCents(it.unit_cents)}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={3} className="hint">Shipping</td>
              <td>{o.shipping_cents === 0 ? "Free" : formatCents(o.shipping_cents)}</td>
            </tr>
            {o.refunded_cents > 0 && (
              <tr>
                <td colSpan={3} className="hint">Refunded</td>
                <td className="warn">−{formatCents(o.refunded_cents)}</td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="cols">
          <p>
            <b>{o.email}</b>
            <br />
            {addressLines(o).map((l) => (
              <span key={l}>
                {l}
                <br />
              </span>
            ))}
          </p>
          <div>
            <p className="hint" style={{ margin: "0 0 4px" }}>
              Payment{" "}
              {o.stripe_payment_intent_id ? (
                <a
                  className="mono"
                  target="_blank"
                  rel="noreferrer"
                  href={`https://dashboard.stripe.com/${mode === "live" ? "" : "test/"}payments/${o.stripe_payment_intent_id}`}
                >
                  {o.stripe_payment_intent_id}
                </a>
              ) : (
                <span className="mono">no payment intent on file</span>
              )}
            </p>
            <ul className="timeline">
              {timeline(o).map((e, i) => (
                <li key={i}>
                  <span className="mono hint">{fmtWhen(e.at)}</span> {e.text}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <NoteBox o={o} />

        {/* ―― 状态动作 ―― */}
        {o.status === "paid" && (
          <ShipRow o={o} run={run} pending={pending} />
        )}
        {o.status === "shipped" && (
          <div className="row" style={{ marginTop: 10 }}>
            <span>
              Tracking:{" "}
              {o.tracking_url ? (
                <a href={o.tracking_url} target="_blank" rel="noreferrer" className="mono">
                  {o.tracking_number}
                </a>
              ) : (
                <span className="mono">{o.tracking_number}</span>
              )}
            </span>
            <button
              className="ghost"
              disabled={pending}
              onClick={() => run(() => markDelivered(o.order_ref))}
            >
              {pending ? "Saving…" : "Mark delivered"}
            </button>
          </div>
        )}

        <div className="row" style={{ marginTop: 10 }}>
          {o.status === "paid" && (
            <button className="danger" onClick={() => toggle("cancel")}>
              Cancel order…
            </button>
          )}
          {(o.status === "shipped" || o.status === "delivered") && (
            <button className="ghost" onClick={() => toggle("return")}>
              Start return…
            </button>
          )}
          {o.status === "return_requested" && (
            <>
              <button onClick={() => toggle("returned")}>Mark returned…</button>
              <button
                className="ghost"
                disabled={pending}
                onClick={() => run(() => cancelReturn(o.order_ref))}
              >
                Cancel return
              </button>
            </>
          )}
          {canRefund && o.status !== "paid" && (
            <button className="ghost" onClick={() => toggle("refund")}>
              Refund…
            </button>
          )}
          <button className="ghost" onClick={() => toggle("email")}>
            Email customer…
          </button>
          {o.status === "paid" && (
            <button
              className="ghost"
              disabled={pending}
              onClick={() => run(() => resendConfirmation(o.order_ref))}
            >
              Resend confirmation
            </button>
          )}
          {o.tracking_number &&
            (o.status === "shipped" || o.status === "delivered") && (
              <button
                className="ghost"
                disabled={pending}
                onClick={() => run(() => resendShippingEmail(o.order_ref))}
              >
                Resend shipping email
              </button>
            )}
          <a
            href={`/orders/${o.order_ref}/slip`}
            target="_blank"
            rel="noreferrer"
          >
            Packing slip ↗
          </a>
        </div>

        {panel === "cancel" && (
          <CancelPanel o={o} remaining={remaining} run={run} pending={pending} />
        )}
        {panel === "refund" && (
          <RefundPanel o={o} remaining={remaining} run={run} pending={pending} />
        )}
        {panel === "return" && (
          <ReturnPanel o={o} run={run} pending={pending} />
        )}
        {panel === "returned" && (
          <ReturnedPanel o={o} remaining={remaining} run={run} pending={pending} />
        )}
        {panel === "email" && (
          <EmailPanel o={o} run={run} pending={pending} />
        )}

        {err && <div className="errbar">{err}</div>}
      </div>
    </details>
  );
}

function ShipRow({
  o,
  run,
  pending,
}: {
  o: OrderWithEvents;
  run: (fn: () => Promise<Result>) => void;
  pending: boolean;
}) {
  const [tracking, setTracking] = useState("");
  const [carrier, setCarrier] = useState("auspost");
  return (
    <div className="row" style={{ marginTop: 10 }}>
      <input
        placeholder="tracking number"
        value={tracking}
        onChange={(e) => setTracking(e.target.value)}
        aria-label={`Tracking number for ${o.order_ref}`}
      />
      <select value={carrier} onChange={(e) => setCarrier(e.target.value)} aria-label="Carrier">
        <option value="auspost">Australia Post</option>
        <option value="sendle">Sendle</option>
        <option value="">Other</option>
      </select>
      <button
        disabled={pending}
        onClick={() => run(() => shipOrder(o.order_ref, tracking, carrier))}
      >
        {pending ? "Shipping…" : "Ship"}
      </button>
      <span className="hint">Sends the shipping email to the customer.</span>
    </div>
  );
}

function NoteBox({ o }: { o: OrderWithEvents }) {
  const router = useRouter();
  const [note, setNote] = useState(o.admin_note ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const dirty = note.trim() !== (o.admin_note ?? "");
  return (
    <div className="row" style={{ marginTop: 10, alignItems: "flex-start" }}>
      <textarea
        placeholder="Internal note (only you see this)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={note ? 2 : 1}
        style={{ flex: 1, minWidth: 260 }}
        aria-label={`Internal note for ${o.order_ref}`}
      />
      {dirty && (
        <button
          className="ghost"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await saveNote(o.order_ref, note);
              if ("error" in r) setErr(r.error);
              else {
                setErr(null);
                router.refresh();
              }
            })
          }
        >
          {pending ? "Saving…" : "Save note"}
        </button>
      )}
      {err && <span className="warn">{err}</span>}
    </div>
  );
}

/** 金额输入（AU$，字符串态）→ 分；非法返回 null */
function parseDollars(s: string): number | null {
  const n = Number.parseFloat(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

function CancelPanel({
  o,
  remaining,
  run,
  pending,
}: {
  o: OrderWithEvents;
  remaining: number;
  run: (fn: () => Promise<Result>) => void;
  pending: boolean;
}) {
  const [restock, setRestock] = useState(true);
  return (
    <div className="panel">
      <p style={{ margin: "0 0 8px" }}>
        Cancels the order,{" "}
        {remaining > 0
          ? `refunds ${formatCents(remaining)} to the customer`
          : "no refund left to issue"}
        , and emails them. This can't be undone.
      </p>
      <label className="row">
        <input
          type="checkbox"
          checked={restock}
          onChange={(e) => setRestock(e.target.checked)}
        />
        Put the stock back (tracked units only)
      </label>
      <div className="row" style={{ marginTop: 8 }}>
        <button
          className="dangerSolid"
          disabled={pending}
          onClick={() => run(() => cancelOrder(o.order_ref, restock))}
        >
          {pending ? "Cancelling…" : `Cancel order ${remaining > 0 ? `· refund ${formatCents(remaining)}` : ""}`}
        </button>
      </div>
    </div>
  );
}

function RefundPanel({
  o,
  remaining,
  run,
  pending,
}: {
  o: OrderWithEvents;
  remaining: number;
  run: (fn: () => Promise<Result>) => void;
  pending: boolean;
}) {
  const [amount, setAmount] = useState((remaining / 100).toFixed(2));
  const [reason, setReason] = useState("requested_by_customer");
  const cents = parseDollars(amount);
  return (
    <div className="panel">
      <p style={{ margin: "0 0 8px" }}>
        Up to {formatCents(remaining)} left to refund. The customer gets a
        refund email.
      </p>
      <div className="row">
        <label>
          AU${" "}
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{ width: 100 }}
            inputMode="decimal"
            aria-label="Refund amount in dollars"
          />
        </label>
        <select value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Refund reason">
          <option value="requested_by_customer">requested by customer</option>
          <option value="duplicate">duplicate</option>
          <option value="fraudulent">fraudulent</option>
        </select>
        <button
          disabled={pending || cents === null || cents > remaining}
          onClick={() => run(() => refundOrder(o.order_ref, cents!, reason))}
        >
          {pending ? "Refunding…" : `Refund ${cents !== null ? formatCents(cents) : ""}`}
        </button>
      </div>
    </div>
  );
}

function ReturnPanel({
  o,
  run,
  pending,
}: {
  o: OrderWithEvents;
  run: (fn: () => Promise<Result>) => void;
  pending: boolean;
}) {
  const [reason, setReason] = useState("");
  const [sendMail, setSendMail] = useState(true);
  const [note, setNote] = useState("");
  return (
    <div className="panel">
      <p style={{ margin: "0 0 8px" }}>
        Marks the order as return in progress. Refund and restock happen later,
        when you mark it returned.
      </p>
      <div className="row">
        <input
          placeholder="reason (optional, e.g. changed mind)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          style={{ minWidth: 260 }}
        />
      </div>
      <label className="row" style={{ marginTop: 6 }}>
        <input
          type="checkbox"
          checked={sendMail}
          onChange={(e) => setSendMail(e.target.checked)}
        />
        Email return instructions to the customer
      </label>
      {sendMail && (
        <textarea
          placeholder="Extra line for the email (optional): return address, what to do…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          style={{ width: "100%", marginTop: 6 }}
        />
      )}
      <div className="row" style={{ marginTop: 8 }}>
        <button
          disabled={pending}
          onClick={() => run(() => requestReturn(o.order_ref, reason, sendMail, note))}
        >
          {pending ? "Starting…" : "Start return"}
        </button>
      </div>
    </div>
  );
}

function ReturnedPanel({
  o,
  remaining,
  run,
  pending,
}: {
  o: OrderWithEvents;
  remaining: number;
  run: (fn: () => Promise<Result>) => void;
  pending: boolean;
}) {
  const [refund, setRefund] = useState(remaining > 0 && !!o.stripe_payment_intent_id);
  const [amount, setAmount] = useState((remaining / 100).toFixed(2));
  const [restock, setRestock] = useState(true);
  const cents = parseDollars(amount);
  return (
    <div className="panel">
      <p style={{ margin: "0 0 8px" }}>The parcel is back. Close out the return:</p>
      <label className="row">
        <input
          type="checkbox"
          checked={refund}
          disabled={remaining <= 0 || !o.stripe_payment_intent_id}
          onChange={(e) => setRefund(e.target.checked)}
        />
        Refund
        {refund && (
          <>
            {" "}AU${" "}
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{ width: 100 }}
              inputMode="decimal"
              aria-label="Refund amount in dollars"
            />
            <span className="hint">of {formatCents(remaining)} left</span>
          </>
        )}
      </label>
      <label className="row" style={{ marginTop: 6 }}>
        <input
          type="checkbox"
          checked={restock}
          onChange={(e) => setRestock(e.target.checked)}
        />
        Put the stock back (tracked units only)
      </label>
      <div className="row" style={{ marginTop: 8 }}>
        <button
          disabled={pending || (refund && (cents === null || cents > remaining))}
          onClick={() =>
            run(() => markReturned(o.order_ref, refund ? cents : null, restock))
          }
        >
          {pending
            ? "Saving…"
            : `Mark returned${refund && cents !== null ? ` · refund ${formatCents(cents)}` : ""}`}
        </button>
      </div>
    </div>
  );
}

function EmailPanel({
  o,
  run,
  pending,
}: {
  o: OrderWithEvents;
  run: (fn: () => Promise<Result>) => void;
  pending: boolean;
}) {
  const [subject, setSubject] = useState(`About your order ${o.order_ref}`);
  const [message, setMessage] = useState("");
  return (
    <div className="panel">
      <p style={{ margin: "0 0 8px" }}>
        Sends a branded email to <b>{o.email}</b>. They can reply directly.
      </p>
      <input
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        style={{ width: "100%" }}
        aria-label="Email subject"
      />
      <textarea
        placeholder="Write the message. Blank line starts a new paragraph."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={4}
        style={{ width: "100%", marginTop: 6 }}
        aria-label="Email message"
      />
      <div className="row" style={{ marginTop: 8 }}>
        <button
          disabled={pending || message.trim().length < 2}
          onClick={() => run(() => emailCustomer(o.order_ref, subject, message))}
        >
          {pending ? "Sending…" : "Send email"}
        </button>
      </div>
    </div>
  );
}
