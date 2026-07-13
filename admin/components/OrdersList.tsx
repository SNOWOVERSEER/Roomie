"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatCents, type OrderRow } from "@/lib/types";
import { markDelivered, shipOrder } from "@/lib/orderActions";

/*
 * 订单三组视图：To ship（paid，置顶）/ Shipped / Delivered。
 * 发货 = 填运单号 → 生产 API 更新 + 给客户发邮件 → 本地刷新。
 */

const GROUPS = [
  { status: "paid" as const, title: "To ship" },
  { status: "shipped" as const, title: "Shipped" },
  { status: "delivered" as const, title: "Delivered" },
];

export default function OrdersList({ orders }: { orders: OrderRow[] }) {
  return (
    <>
      {GROUPS.map((g) => {
        const list = orders.filter((o) => o.status === g.status);
        return (
          <section key={g.status}>
            <h2>
              {g.title}{" "}
              <span className={`badge ${g.status}`}>{list.length}</span>
            </h2>
            {list.length === 0 ? (
              <p className="hint">none</p>
            ) : (
              list.map((o) => <Order key={o.id} o={o} />)
            )}
          </section>
        );
      })}
    </>
  );
}

function addressLines(o: OrderRow): string[] {
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

function Order({ o }: { o: OrderRow }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [tracking, setTracking] = useState("");
  const [carrier, setCarrier] = useState("auspost");
  const [pending, startTransition] = useTransition();

  const itemsSummary = o.items
    .map((it) => `${it.title}${it.variant ? ` (${it.variant})` : ""} ×${it.qty}`)
    .join(", ");

  return (
    <details>
      <summary>
        <b className="mono">#{o.order_ref}</b>
        <span>{new Date(o.created_at).toLocaleDateString("en-AU")}</span>
        <span>{o.customer_name ?? o.email}</span>
        <span className="hint" style={{ flex: 1 }}>{itemsSummary}</span>
        <b>{formatCents(o.amount_total)}</b>
        <span className={`badge ${o.status}`}>{o.status}</span>
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
          </tbody>
        </table>
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

        {o.status === "paid" && (
          <div className="row">
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
              onClick={() =>
                startTransition(async () => {
                  const r = await shipOrder(o.order_ref, tracking, carrier);
                  if ("error" in r) setErr(r.error);
                  else { setErr(null); router.refresh(); }
                })
              }
            >
              {pending ? "Shipping…" : "Ship"}
            </button>
            <span className="hint">Sends the shipping email to the customer.</span>
          </div>
        )}

        {o.status === "shipped" && (
          <div className="row">
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
              onClick={() =>
                startTransition(async () => {
                  const r = await markDelivered(o.order_ref);
                  if ("error" in r) setErr(r.error);
                  else { setErr(null); router.refresh(); }
                })
              }
            >
              {pending ? "Saving…" : "Mark delivered"}
            </button>
          </div>
        )}

        {err && <div className="errbar">{err}</div>}
      </div>
    </details>
  );
}
