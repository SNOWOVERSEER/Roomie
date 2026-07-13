"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import type {
  CartLine,
  ClientCatalogItem,
} from "@/components/CartContext";
import { formatCents, SHIPPING, shippingCentsFor } from "@/lib/catalog";
import { useCheckout } from "./useCheckout";
import { lineImage } from "./lineImage";
import styles from "./CartDrawer.module.css";

/*
 * 购物篮抽屉：Nav 篮子点开，右侧滑入（--ease-soft），不打断浏览。
 * 深链/回退场景仍有 /cart 整页（抽屉页脚有入口，也是 Stripe cancel_url）。
 * props 驱动（不直接 useCart），避免与 CartProvider 循环引用。
 */

export default function CartDrawer({
  open,
  onClose,
  lines,
  count,
  subtotalCents,
  catalog,
  setQty,
  remove,
}: {
  open: boolean;
  onClose: () => void;
  lines: CartLine[];
  count: number;
  subtotalCents: number;
  catalog: Record<string, ClientCatalogItem>;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const { busy, err, checkout } = useCheckout(lines);
  const shipCents = shippingCentsFor(subtotalCents);

  // Esc 关闭
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // 开启时锁页面滚动 + 聚焦面板
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div
      className={`${styles.root} ${open ? styles.rootOpen : ""}`}
      aria-hidden={!open}
    >
      <div className={styles.backdrop} onClick={onClose} aria-hidden />
      <aside
        ref={panelRef}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-label="Your basket"
        tabIndex={-1}
      >
        <header className={styles.head}>
          <p className={styles.title}>
            Your basket
            {count > 0 && <span className={styles.countChip}>{count}</span>}
          </p>
          <button
            className={styles.close}
            onClick={onClose}
            aria-label="Close basket"
          >
            ×
          </button>
        </header>

        {lines.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyHeading}>Nothing in here yet.</p>
            <p className={styles.emptyLede}>
              The wall is still bare — and somebody has claws.
            </p>
            <Link className="btnPrimary" href="/scratcher" onClick={onClose}>
              Shop the Canvas Scratcher
            </Link>
          </div>
        ) : (
          <>
            <ul className={styles.lines}>
              {lines.map((l) => {
                const item = catalog[l.handle];
                if (!item) return null;
                return (
                  <li key={l.key} className={styles.line}>
                    <div className={styles.thumb}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={lineImage(l, item.image)} alt="" loading="lazy" />
                    </div>
                    <div className={styles.body}>
                      <p className={styles.name}>{item.title}</p>
                      {l.variant && (
                        <p className={styles.variant}>{l.variant}</p>
                      )}
                      <div className={styles.rowEnd}>
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
                        <span className={styles.price}>
                          {formatCents(item.priceCents * l.qty)}
                        </span>
                      </div>
                    </div>
                    <button
                      className={styles.remove}
                      onClick={() => remove(l.key)}
                      aria-label={`Remove ${item.title}${l.variant ? ` ${l.variant}` : ""}`}
                    >
                      ×
                    </button>
                  </li>
                );
              })}
            </ul>

            <footer className={styles.foot}>
              <div className={styles.shipRow}>
                <span>Shipping · AU only</span>
                <b>{shipCents === 0 ? "Free" : formatCents(shipCents)}</b>
              </div>
              <div className={styles.subRow}>
                <span>Total</span>
                <strong>{formatCents(subtotalCents + shipCents)}</strong>
              </div>
              {shipCents > 0 && (
                <p className={styles.freeHint}>
                  {formatCents(SHIPPING.freeOverCents - subtotalCents)} more
                  and shipping is on us.
                </p>
              )}
              <p className={styles.finePrint}>
                Free shipping over {formatCents(SHIPPING.freeOverCents)} · GST
                included · cards &amp; Afterpay
              </p>
              <button
                className={`btnPrimary ${styles.checkoutBtn}`}
                onClick={checkout}
                disabled={busy}
              >
                {busy ? "Opening secure checkout…" : "Checkout securely →"}
              </button>
              {err && <p className={styles.err}>{err}</p>}
              <Link className={styles.fullLink} href="/cart" onClick={onClose}>
                see the full basket page →
              </Link>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}
