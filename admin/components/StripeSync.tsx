"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  checkStripeSync,
  repairStripeSync,
  type SyncReport,
  type Result,
} from "@/lib/actions";

/*
 * Stripe 同步面板：只读体检 + 按行修复。口径 = DB 为准，Stripe 跟随
 * （详见 actions.ts 的同步段注释；07-26 切账户遗留事故后加装）。
 */
export default function StripeSync() {
  const router = useRouter();
  const [report, setReport] = useState<SyncReport | null>(null);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const refresh = async (): Promise<void> => {
    const r = await checkStripeSync();
    if ("error" in r) {
      setErr(r.error);
      return;
    }
    setErr(null);
    setReport(r);
    setCheckedAt(
      new Date().toLocaleTimeString("en-AU", { hour12: false }),
    );
  };

  const check = () => startTransition(refresh);

  const repair = (handle: string) =>
    startTransition(async () => {
      const r: Result = await repairStripeSync(handle);
      if ("error" in r) {
        setErr(r.error);
        return;
      }
      router.refresh(); // 商品表的 Stripe 列可能已变
      await refresh(); // 修完立刻复检，让结果自己证明
    });

  const bad = report ? report.rows.filter((x) => !x.ok) : [];

  return (
    <section style={{ marginTop: 28 }}>
      <h2>Stripe sync</h2>
      <p className="hint">
        Verifies each product against Stripe: price exists and is active, amount
        matches the database, and the stored product id is the one the price
        really belongs to. The database is the source of truth, so Repair makes
        Stripe follow it. Checking is read-only.
      </p>
      {err && <div className="errbar">{err}</div>}
      <p className="row" style={{ alignItems: "center", gap: 10 }}>
        <button onClick={check} disabled={pending}>
          {pending ? "Working…" : report ? "Check again" : "Check sync"}
        </button>
        {report && checkedAt && (
          <span className="hint">
            {report.mode} keys · checked {checkedAt} ·{" "}
            {bad.length === 0 ? (
              <b className="ok">everything in sync</b>
            ) : (
              <b className="warn">
                {bad.length} product{bad.length > 1 ? "s" : ""} out of sync
              </b>
            )}
          </span>
        )}
      </p>
      {report && bad.length > 0 && (
        <table style={{ marginTop: 8, opacity: pending ? 0.6 : 1 }}>
          <thead>
            <tr>
              <th>Product</th>
              <th>What is off</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {bad.map((x) => (
              <tr key={x.handle}>
                <td>
                  <b>{x.title}</b>
                  <br />
                  <span className="mono hint">{x.handle}</span>
                </td>
                <td>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {x.issues.map((m, i) => (
                      <li key={i} className="warn" style={{ fontWeight: 400 }}>
                        {m}
                      </li>
                    ))}
                  </ul>
                </td>
                <td>
                  <button
                    className="ghost"
                    disabled={pending}
                    onClick={() => repair(x.handle)}
                    aria-label={`Repair Stripe sync for ${x.title}`}
                  >
                    Repair
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
