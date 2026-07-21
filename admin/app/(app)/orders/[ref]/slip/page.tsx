import { db } from "@/lib/db";
import { formatCents, type OrderRow } from "@/lib/types";
import PrintButton from "@/components/PrintButton";

/*
 * 装箱单（打印用）：黑白、A4 友好。
 * 店主未注册 GST（ABN 个体经营）：单据不标 GST、不称 tax invoice；
 * 注册 GST 后再恢复（届时页脚补 ABN + GST 行才可作 tax invoice）。
 */

export default async function SlipPage({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref } = await params;
  const { data, error } = await db()
    .from("orders")
    .select("*")
    .eq("order_ref", ref)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    return (
      <p className="hint" style={{ marginTop: 40 }}>
        Order #{ref} not found.
      </p>
    );
  }
  const o = data as OrderRow;
  const a = (o.shipping_address ?? {}) as {
    name?: string; line1?: string; line2?: string; city?: string;
    state?: string; postal_code?: string; country?: string;
  };
  const address = [
    a.name,
    a.line1,
    a.line2,
    [a.city, a.state, a.postal_code].filter(Boolean).join(" "),
    a.country,
  ].filter(Boolean) as string[];

  return (
    <div className="slip">
      <style>{`
        @media print {
          .side, .noPrint { display: none !important; }
          .frame { display: block !important; }
          body { background: #fff !important; }
          main { max-width: none !important; padding: 0 !important; }
          .slip { border: 0 !important; box-shadow: none !important; }
        }
        .slip {
          background: #fff;
          color: #111;
          border: 1px solid var(--line);
          border-radius: 12px;
          padding: 40px 44px;
          max-width: 720px;
          margin: 20px auto;
          font-size: 14px;
          line-height: 1.5;
        }
        .slip h1 { color: #111; font-size: 26px; margin: 0; }
        .slip table { background: transparent; border-radius: 0; }
        .slip th, .slip td { border-color: #ddd; padding: 8px 10px; }
        .slip th { color: #666; }
        .slipHead { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; }
        .slipMeta { text-align: right; color: #444; }
      `}</style>

      <div className="slipHead">
        <div>
          <h1>RoomiePaw</h1>
          <p style={{ margin: "2px 0 0", color: "#444" }}>
            Melbourne, AU · furniture you share with the cat
          </p>
        </div>
        <div className="slipMeta">
          <b>Packing slip</b>
          <br />
          Order <span className="mono">#{o.order_ref}</span>
          <br />
          {new Date(o.created_at).toLocaleDateString("en-AU", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          })}
        </div>
      </div>

      <div style={{ margin: "28px 0 18px" }}>
        <b>Ship to</b>
        <br />
        {address.length > 0
          ? address.map((l) => (
              <span key={l}>
                {l}
                <br />
              </span>
            ))
          : o.customer_name ?? o.email}
      </div>

      <table>
        <thead>
          <tr><th>Item</th><th>Variant</th><th>Qty</th><th>Unit</th><th>Line</th></tr>
        </thead>
        <tbody>
          {o.items.map((it, i) => (
            <tr key={i}>
              <td>{it.title}</td>
              <td>{it.variant ?? "·"}</td>
              <td>{it.qty}</td>
              <td>{formatCents(it.unit_cents)}</td>
              <td>{formatCents(it.unit_cents * it.qty)}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={4} style={{ color: "#666" }}>Shipping · Australia-wide</td>
            <td>{o.shipping_cents === 0 ? "Free" : formatCents(o.shipping_cents)}</td>
          </tr>
          <tr>
            <td colSpan={4}><b>Total</b></td>
            <td><b>{formatCents(o.amount_total)}</b></td>
          </tr>
        </tbody>
      </table>

      <p style={{ marginTop: 26, color: "#444" }}>
        Questions about your order? Reply to your confirmation email and a
        human answers. Thanks for giving a cat somewhere better to put
        their claws.
      </p>

      <p className="noPrint" style={{ marginTop: 18 }}>
        <PrintButton />
      </p>
    </div>
  );
}
