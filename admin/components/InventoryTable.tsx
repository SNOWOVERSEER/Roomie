"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LOW_STOCK_AT, type StockItemRow } from "@/lib/types";
import {
  toggleItemAvailable,
  updateItemStock,
  type Result,
} from "@/lib/actions";

/*
 * 库存单元（备货粒度）：画框 ×1 + 画芯 ×6。
 * 商品可售性由这里推导：Frame+print·画X = 画框可买 ∧ 画X 可买；
 * Print only·画X = 画X 可买。画芯可退役（seasonal drop 下场）。
 */

export default function InventoryTable({ items }: { items: StockItemRow[] }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<Result>) =>
    startTransition(async () => {
      const r = await fn();
      if ("error" in r) {
        setErr(r.error);
      } else {
        setErr(null);
        router.refresh();
      }
    });

  return (
    <>
      <h2>Inventory · stock units</h2>
      <p className="hint">
        Stock lives here, per unit: the frame and each print. Frame out of
        stock = every Frame + print option reads sold out; a print out of
        stock = that print unbuyable in both formats. Retiring a print removes
        it from the shop entirely (seasonal drops). Low stock alert under{" "}
        {LOW_STOCK_AT}.
      </p>
      {err && <div className="errbar">{err}</div>}
      <table style={{ marginTop: 10, opacity: pending ? 0.6 : 1, maxWidth: 720 }}>
        <thead>
          <tr>
            <th>Unit</th>
            <th>Stock</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <UnitRow key={i.id} unit={i} run={run} />
          ))}
        </tbody>
      </table>
    </>
  );
}

function UnitRow({
  unit,
  run,
}: {
  unit: StockItemRow;
  run: (fn: () => Promise<Result>) => void;
}) {
  const [draft, setDraft] = useState(unit.stock?.toString() ?? "");
  const isPrint = unit.id !== "frame";

  return (
    <tr style={{ opacity: unit.available ? 1 : 0.55 }}>
      <td>
        <b>{unit.label}</b>
        <br />
        <span className="mono hint">{unit.id}</span>
      </td>
      <td>
        {unit.stock === null ? (
          <span className="row">
            <span className="hint">∞ untracked</span>
            <button
              className="ghost"
              onClick={() => run(() => updateItemStock(unit.id, 0))}
            >
              track
            </button>
          </span>
        ) : (
          <span className="row">
            <input
              type="number"
              min={0}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              style={{ width: 76 }}
              aria-label={`Stock for ${unit.label}`}
            />
            <button
              className="ghost"
              onClick={() =>
                run(() =>
                  updateItemStock(
                    unit.id,
                    Math.max(0, Math.round(Number(draft) || 0)),
                  ),
                )
              }
            >
              save
            </button>
            <button
              className="ghost"
              onClick={() => run(() => updateItemStock(unit.id, null))}
            >
              untrack
            </button>
            {unit.stock <= 0 && (
              <b className="warn">
                {unit.stock < 0 ? `OVERSOLD ${unit.stock}` : "SOLD OUT"}
              </b>
            )}
            {unit.stock > 0 && unit.stock < LOW_STOCK_AT && (
              <b className="warn">low stock</b>
            )}
          </span>
        )}
      </td>
      <td>
        {isPrint ? (
          unit.available ? (
            <span className="row">
              <b className="ok">in lineup</b>
              <button
                className="ghost"
                onClick={() => run(() => toggleItemAvailable(unit.id, false))}
                aria-label={`Retire ${unit.label}`}
              >
                retire
              </button>
            </span>
          ) : (
            <span className="row">
              <span className="hint">retired</span>
              <button
                className="ghost"
                onClick={() => run(() => toggleItemAvailable(unit.id, true))}
                aria-label={`Bring back ${unit.label}`}
              >
                bring back
              </button>
            </span>
          )
        ) : (
          <span className="hint">always in lineup</span>
        )}
      </td>
    </tr>
  );
}
