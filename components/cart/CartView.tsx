"use client";

import Link from "next/link";
import { useCart } from "@/components/CartContext";
import { formatCents, SHIPPING, shippingCentsFor } from "@/lib/catalog";
import { useCheckout } from "./useCheckout";
import { lineDisplay } from "./lineDisplay";
import styles from "./CartView.module.css";

/*
 * 购物篮整页（Nav 走抽屉，这页负责深链/Stripe cancel_url 回退）。
 * 「Checkout securely」→ POST /api/checkout（服务端按 products 表定价
 * 建 Stripe Checkout Session）→ 跳 Stripe 托管结算页。
 */

export default function CartView() {
  const { lines, count, subtotalCents, catalog, catalogUnknown, setQty, remove } =
    useCart();
  const { busy, err, checkout } = useCheckout(lines);
  const shipCents = shippingCentsFor(subtotalCents);
  const totalCents = subtotalCents + shipCents;

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
              const d = lineDisplay(l, catalog[l.handle]);
              return (
                <li className={styles.line} key={l.key}>
                  <div className={styles.thumb}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {d.image && <img src={d.image} alt="" loading="lazy" />}
                  </div>

                  <div className={styles.lineBody}>
                    <p className={styles.lineTitle}>{d.title}</p>
                    {l.variant && (
                      <p className={styles.lineVariant}>{l.variant}</p>
                    )}
                    {d.priceCents !== null && (
                      <p className={styles.lineUnit}>
                        {formatCents(d.priceCents)} each
                      </p>
                    )}
                  </div>

                  <div className={styles.lineEnd}>
                    {d.numbered ? (
                      <span className={styles.oneOfTen}>one of ten</span>
                    ) : (
                      <span
                        className={styles.stepper}
                        role="group"
                        aria-label={`Quantity of ${d.title}${l.variant ? ` ${l.variant}` : ""}`}
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
                    {d.priceCents !== null && (
                      <span className={styles.lineTotal}>
                        {formatCents(d.priceCents * l.qty)}
                      </span>
                    )}
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
              {/* 目录快照缺失时金额全是 0（见 lib/degrade.ts）：隐去金额并
                  挡住结算，别让用户对着 AU$0 按下去 */}
              {catalogUnknown ? (
                <p className={styles.taxNote}>
                  Prices are updating — give it a moment and refresh. Your
                  basket is safe.
                </p>
              ) : (
                <>
                  <dl className={styles.rows}>
                    <div>
                      <dt>Subtotal</dt>
                      <dd>{formatCents(subtotalCents)}</dd>
                    </div>
                    <div>
                      <dt>Shipping · AU only</dt>
                      <dd>
                        {shipCents === 0 ? "Free" : formatCents(shipCents)}
                      </dd>
                    </div>
                  </dl>
                  {shipCents > 0 && (
                    <p className={styles.freeHint}>
                      {formatCents(SHIPPING.freeOverCents - subtotalCents)} more
                      and shipping is on us.
                    </p>
                  )}
                  <p className={styles.taxNote}>
                    Cards &amp; Afterpay at checkout.
                  </p>
                  <div className={styles.totalRow}>
                    <span>Total</span>
                    <strong>{formatCents(totalCents)}</strong>
                  </div>
                </>
              )}
              <button
                className={`btnPrimary ${styles.checkoutBtn}`}
                onClick={checkout}
                disabled={busy || catalogUnknown}
              >
                {busy ? "Opening secure checkout…" : "Checkout securely →"}
              </button>
              {err && <p className={styles.err}>{err}</p>}
              <p className={styles.secureNote}>
                Payments handled by Stripe — card details never touch our
                servers.
              </p>
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
