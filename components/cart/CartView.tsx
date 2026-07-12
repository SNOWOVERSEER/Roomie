"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart, type CartLine } from "@/components/CartContext";
import { CATALOG, formatCents } from "@/lib/catalog";
import { ARTWORKS } from "@/lib/heroConfig";
import styles from "./CartView.module.css";

/*
 * 购物篮页：行卡片 + 粘性结算面板。
 * 「Checkout securely」→ POST /api/checkout（服务端按 CATALOG 定价
 * 建 Stripe Checkout Session）→ 跳 Stripe 托管结算页。
 */

/** 画芯类行用对应画作平面稿当缩略图；编号件用产品图 */
function lineImage(line: CartLine): string {
  const item = CATALOG[line.handle];
  if (line.handle === "canvas-house" || !line.variant) return item.image;
  const i = ARTWORKS.findIndex((a) => a.title === line.variant);
  return i >= 0 ? `/hero/art/flat-0${i + 1}.png` : item.image;
}

export default function CartView() {
  const { lines, count, subtotalCents, setQty, remove } = useCart();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const checkout = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: lines.map((l) => ({
            handle: l.handle,
            variant: l.variant,
            qty: l.qty,
          })),
        }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "no url");
      window.location.assign(data.url);
    } catch {
      setErr("Couldn't open the checkout — give it another go in a moment.");
      setBusy(false);
    }
  };

  const hasHouse = lines.some((l) => l.handle === "canvas-house");

  if (lines.length === 0) {
    return (
      <section className={styles.wrap}>
        <div className={`shell ${styles.emptyBox}`}>
          <p className={styles.eyebrow}>Your basket</p>
          <h1 className={styles.emptyHeading}>Nothing in here yet.</h1>
          <p className={styles.emptyLede}>
            The wall is still bare, and somebody has claws. Start with the
            piece the whole room is built around.
          </p>
          <div className={styles.emptyCtas}>
            <Link className="btnPrimary" href="/scratcher">
              Shop the Canvas Scratcher
            </Link>
            <Link className={styles.ghostLink} href="/house">
              or meet the House →
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.wrap}>
      <div className="shell">
        <p className={styles.eyebrow}>Your basket</p>
        <h1 className={styles.heading}>
          {count} {count === 1 ? "piece" : "pieces"}, ready when you are.
        </h1>

        <div className={styles.grid}>
          {/* ——— 行列表 ——— */}
          <ul className={styles.lines}>
            {lines.map((l) => {
              const item = CATALOG[l.handle];
              return (
                <li className={styles.line} key={l.key}>
                  <div className={styles.thumb}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={lineImage(l)} alt="" loading="lazy" />
                  </div>

                  <div className={styles.lineBody}>
                    <p className={styles.lineTitle}>{item.title}</p>
                    {l.variant && (
                      <p className={styles.lineVariant}>{l.variant}</p>
                    )}
                    <p className={styles.lineUnit}>
                      {formatCents(item.priceCents)} each
                    </p>
                  </div>

                  <div className={styles.lineEnd}>
                    {item.numbered ? (
                      <span className={styles.oneOfTen}>one of ten</span>
                    ) : (
                      <span
                        className={styles.stepper}
                        role="group"
                        aria-label={`Quantity of ${item.title}${l.variant ? ` ${l.variant}` : ""}`}
                      >
                        <button
                          aria-label="One fewer"
                          disabled={l.qty <= 1}
                          onClick={() => setQty(l.key, l.qty - 1)}
                        >
                          −
                        </button>
                        <b>{l.qty}</b>
                        <button
                          aria-label="One more"
                          disabled={l.qty >= 9}
                          onClick={() => setQty(l.key, l.qty + 1)}
                        >
                          +
                        </button>
                      </span>
                    )}
                    <span className={styles.lineTotal}>
                      {formatCents(item.priceCents * l.qty)}
                    </span>
                    <button
                      className={styles.remove}
                      onClick={() => remove(l.key)}
                    >
                      take it out
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* ——— 结算面板 ——— */}
          <aside className={styles.summaryCol}>
            <div className={styles.summary}>
              <p className={styles.summaryLabel}>Order summary</p>
              <dl className={styles.rows}>
                <div>
                  <dt>Subtotal</dt>
                  <dd>{formatCents(subtotalCents)}</dd>
                </div>
                <div>
                  <dt>Shipping</dt>
                  <dd>Free · AU</dd>
                </div>
              </dl>
              <p className={styles.taxNote}>
                GST included. Cards &amp; Afterpay at checkout.
              </p>
              <div className={styles.totalRow}>
                <span>Total</span>
                <strong>{formatCents(subtotalCents)}</strong>
              </div>
              <button
                className={`btnPrimary ${styles.checkoutBtn}`}
                onClick={checkout}
                disabled={busy}
              >
                {busy ? "Opening secure checkout…" : "Checkout securely →"}
              </button>
              {err && <p className={styles.err}>{err}</p>}
              <p className={styles.secureNote}>
                Payments handled by Stripe — card details never touch our
                servers.
              </p>
              {hasHouse && (
                <p className={styles.houseNote}>
                  Your House number is held in the basket and stamped on the
                  frame once paid — we build the run in order.
                </p>
              )}
            </div>
            <Link className={styles.keepLink} href="/#canvas">
              ← keep browsing
            </Link>
          </aside>
        </div>
      </div>
    </section>
  );
}
