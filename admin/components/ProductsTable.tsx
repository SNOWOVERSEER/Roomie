"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatCents, type ProductRow } from "@/lib/types";
import {
  createProduct,
  deleteProduct,
  ensureStripe,
  toggleAvailable,
  updateCopy,
  updatePrice,
  updateStock,
  type Result,
} from "@/lib/actions";

/*
 * 商品管理表：改价（Stripe 建新归档旧）、库存三态（∞/数字/售罄）、
 * 上下架、文案行内编辑、新增/删除。所有变更即时生效于生产站点。
 */

const SITE = "https://roomiepaw.vercel.app";

export default function ProductsTable({ products }: { products: ProductRow[] }) {
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
      {err && <div className="errbar">{err}</div>}
      <p className="hint">
        Prices on the live site update within seconds. Stripe checkout uses the
        new price immediately.
      </p>
      <table style={{ marginTop: 10, opacity: pending ? 0.6 : 1 }}>
        <thead>
          <tr>
            <th></th>
            <th>Product</th>
            <th>Price</th>
            <th>Stock</th>
            <th>On sale</th>
            <th>Stripe</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <Row key={p.handle} p={p} run={run} />
          ))}
        </tbody>
      </table>
      <AddForm run={run} />
    </>
  );
}

function Row({
  p,
  run,
}: {
  p: ProductRow;
  run: (fn: () => Promise<Result>) => void;
}) {
  const [editPrice, setEditPrice] = useState(false);
  const [priceAud, setPriceAud] = useState((p.price_cents / 100).toString());
  const [editCopy, setEditCopy] = useState(false);
  const [title, setTitle] = useState(p.title);
  const [tagline, setTagline] = useState(p.tagline);
  const [stockDraft, setStockDraft] = useState(p.stock?.toString() ?? "");

  const stockCell =
    p.stock === null ? (
      <span className="row">
        <span className="hint">∞ untracked</span>
        <button className="ghost" onClick={() => run(() => updateStock(p.handle, 0))}>
          track
        </button>
      </span>
    ) : (
      <span className="row">
        <input
          type="number"
          min={0}
          value={stockDraft}
          onChange={(e) => setStockDraft(e.target.value)}
          style={{ width: 72 }}
          aria-label={`Stock for ${p.title}`}
        />
        <button
          className="ghost"
          onClick={() => run(() => updateStock(p.handle, Math.max(0, Math.round(Number(stockDraft) || 0))))}
        >
          save
        </button>
        <button className="ghost" onClick={() => run(() => updateStock(p.handle, null))}>
          untrack
        </button>
        {p.stock <= 0 && (
          <b className="warn">{p.stock < 0 ? `OVERSOLD ${p.stock}` : "SOLD OUT"}</b>
        )}
        {p.stock > 0 && p.stock <= 2 && <b className="warn">low</b>}
      </span>
    );

  return (
    <tr>
      <td>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="thumb" src={`${SITE}${p.image}`} alt="" />
      </td>
      <td style={{ maxWidth: 320 }}>
        {editCopy ? (
          <span style={{ display: "grid", gap: 6 }}>
            <span className="mono hint">{p.handle}</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Title" />
            <input value={tagline} onChange={(e) => setTagline(e.target.value)} aria-label="Tagline" />
            <span className="row">
              <button
                onClick={() => {
                  run(() => updateCopy(p.handle, title, tagline));
                  setEditCopy(false);
                }}
              >
                Save copy
              </button>
              <button className="ghost" onClick={() => setEditCopy(false)}>
                cancel
              </button>
            </span>
          </span>
        ) : (
          <span>
            <b>{p.title}</b>{" "}
            <button
              className="ghost"
              onClick={() => setEditCopy(true)}
              aria-label={`Edit copy for ${p.title}`}
            >
              edit
            </button>
            <br />
            <span className="hint">{p.tagline}</span>
            <br />
            <span className="mono hint">{p.handle}</span>
          </span>
        )}
      </td>
      <td>
        {editPrice ? (
          <span className="row">
            <input
              type="number"
              step="0.01"
              min={1}
              value={priceAud}
              onChange={(e) => setPriceAud(e.target.value)}
              style={{ width: 90 }}
              aria-label={`New price for ${p.title} in AUD`}
            />
            <button
              onClick={() => {
                run(() => updatePrice(p.handle, Math.round(Number(priceAud) * 100)));
                setEditPrice(false);
              }}
            >
              Save
            </button>
            <button className="ghost" onClick={() => setEditPrice(false)}>
              cancel
            </button>
          </span>
        ) : (
          <span className="row">
            <b>{formatCents(p.price_cents)}</b>
            <button
              className="ghost"
              onClick={() => setEditPrice(true)}
              aria-label={`Edit price for ${p.title}`}
            >
              edit
            </button>
          </span>
        )}
      </td>
      <td>{stockCell}</td>
      <td>
        {p.available ? (
          <span className="row">
            <b className="ok">on sale</b>
            <button
              className="ghost"
              onClick={() => run(() => toggleAvailable(p.handle, false))}
              aria-label={`Take ${p.title} off sale`}
            >
              take off
            </button>
          </span>
        ) : p.sellable ? (
          <span className="row">
            <span className="hint">off sale</span>
            <button
              className="ghost"
              onClick={() => run(() => toggleAvailable(p.handle, true))}
              aria-label={`Put ${p.title} on sale`}
            >
              put on
            </button>
          </span>
        ) : (
          <span
            className="hint"
            title="No purchase flow on the site yet (needs a page + buy panel before it can go on sale)"
          >
            not ready to sell
          </span>
        )}
      </td>
      <td>
        {p.stripe_price_id ? (
          <span className="mono hint" title={p.stripe_price_id}>
            …{p.stripe_price_id.slice(-6)}
          </span>
        ) : (
          <button className="ghost" onClick={() => run(() => ensureStripe(p.handle))}>
            Create in Stripe
          </button>
        )}
      </td>
      <td>
        <button
          className="danger"
          onClick={() => {
            if (confirm(`Delete ${p.handle}? This cannot be undone.`)) {
              run(() => deleteProduct(p.handle));
            }
          }}
        >
          delete
        </button>
      </td>
    </tr>
  );
}

function AddForm({ run }: { run: (fn: () => Promise<Result>) => void }) {
  const [handle, setHandle] = useState("");
  const [title, setTitle] = useState("");
  const [tagline, setTagline] = useState("");
  const [price, setPrice] = useState("");
  const [image, setImage] = useState("");

  return (
    <details style={{ marginTop: 18 }}>
      <summary>
        <b>Add a product</b>
      </summary>
      <div className="body" style={{ display: "grid", gap: 8, maxWidth: 480 }}>
        <input placeholder="handle (e.g. wave-mat)" value={handle} onChange={(e) => setHandle(e.target.value)} />
        <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input placeholder="Tagline" value={tagline} onChange={(e) => setTagline(e.target.value)} />
        <input type="number" step="0.01" placeholder="Price (AUD)" value={price} onChange={(e) => setPrice(e.target.value)} />
        <input placeholder="/c01/image.webp (must exist in repo public/)" value={image} onChange={(e) => setImage(e.target.value)} />
        <p className="hint">
          New products start off sale with no Stripe price. Image files still go
          through the repo pipeline (de-logo etc.) before you reference them here.
        </p>
        <button
          onClick={() => {
            run(() =>
              createProduct({
                handle: handle.trim(),
                title,
                tagline,
                priceCents: Math.round(Number(price) * 100),
                image: image.trim(),
              }),
            );
            setHandle(""); setTitle(""); setTagline(""); setPrice(""); setImage("");
          }}
        >
          Create
        </button>
      </div>
    </details>
  );
}
