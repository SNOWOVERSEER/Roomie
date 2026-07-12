"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCart } from "@/components/CartContext";
import { formatCents } from "@/lib/catalog";
import styles from "./SuccessView.module.css";

/*
 * 付款成功页：Stripe 重定向回站（?session_id=cs_xxx）。
 * 轮询 /api/order 等 webhook 落库（本地/生产通常 1-2 秒）；
 * 超时不吓用户 —— 付款既成，订单号走邮件兜底。
 * 回站即清空购物车（支付已完成，篮子使命结束）。
 */

interface OrderSummary {
  order_number: number;
  email: string;
  items: { handle: string; title: string; variant?: string; qty: number; unit_cents: number }[];
  amount_total: number;
  status: string;
}

const POLL_MS = 1300;
const MAX_POLLS = 9;

export default function SuccessView() {
  const sessionId = useSearchParams().get("session_id") ?? "";
  const { clear } = useCart();
  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [payStatus, setPayStatus] = useState<string | null>(null);
  const [gaveUp, setGaveUp] = useState(false);
  const cleared = useRef(false);

  useEffect(() => {
    if (!cleared.current && sessionId) {
      clear();
      cleared.current = true;
    }
  }, [clear, sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    let polls = 0;
    let stop = false;
    const tick = async () => {
      polls += 1;
      try {
        const res = await fetch(
          `/api/order?session_id=${encodeURIComponent(sessionId)}`,
        );
        if (res.ok) {
          const data = (await res.json()) as {
            order?: OrderSummary;
            pending?: boolean;
            payment_status?: string;
          };
          if (data.order) {
            setOrder(data.order);
            return;
          }
          if (data.payment_status) setPayStatus(data.payment_status);
        }
      } catch {
        /* 网络抖动继续轮询 */
      }
      if (!stop && polls < MAX_POLLS) setTimeout(tick, POLL_MS);
      else setGaveUp(true);
    };
    tick();
    return () => {
      stop = true;
    };
  }, [sessionId]);

  if (!sessionId) {
    return (
      <section className={styles.wrap}>
        <div className={`shell ${styles.card}`}>
          <h1 className={styles.heading}>Nothing to see here.</h1>
          <p className={styles.lede}>
            This page only appears after a checkout.
          </p>
          <Link className="btnPrimary" href="/">
            Back to the room
          </Link>
        </div>
      </section>
    );
  }

  const processing = payStatus === "unpaid"; // Afterpay 等异步支付还在路上

  return (
    <section className={styles.wrap}>
      <div className={`shell ${styles.card}`}>
        <p className={styles.kicker}>
          {order
            ? `Order № ${order.order_number} · confirmed`
            : processing
              ? "Payment processing"
              : "Payment received"}
        </p>
        <h1 className={styles.heading}>
          {processing ? "Almost theirs." : "It's theirs now."}
        </h1>
        <p className={styles.lede}>
          {order
            ? `A confirmation is on its way to ${order.email}. Clear a patch of wall — someone has plans for it.`
            : processing
              ? "Your payment provider is finishing up. We'll email your order number the moment it lands."
              : gaveUp
                ? "Payment confirmed with Stripe. Your order number is coming by email — you can safely close this page."
                : "Payment confirmed — fetching your order number…"}
        </p>

        {order && (
          <div className={styles.summary}>
            <ul className={styles.items}>
              {order.items.map((it, i) => (
                <li key={i}>
                  <span>
                    {it.title}
                    {it.variant ? ` · ${it.variant}` : ""}
                    <em> × {it.qty}</em>
                  </span>
                  <b>{formatCents(it.unit_cents * it.qty)}</b>
                </li>
              ))}
            </ul>
            <div className={styles.totalRow}>
              <span>Total · free AU shipping</span>
              <strong>{formatCents(order.amount_total)}</strong>
            </div>
            {order.items.some((it) => it.handle === "canvas-house") && (
              <p className={styles.houseNote}>
                Your House number is stamped on the frame — we build the run
                in order and email you when yours hits the bench.
              </p>
            )}
          </div>
        )}

        <ol className={styles.steps}>
          <li>
            <h3>Confirmation email</h3>
            <p>Order number and receipt — arriving about now.</p>
          </li>
          <li>
            <h3>Built &amp; packed</h3>
            <p>Checked, wrapped, and boxed flat for the trip.</p>
          </li>
          <li>
            <h3>On the way</h3>
            <p>Tracking lands in your inbox the day it ships.</p>
          </li>
        </ol>

        <div className={styles.ctas}>
          <Link className="btnPrimary" href="/">
            Back to the room
          </Link>
          <Link className={styles.ghostLink} href="/scratcher#prints">
            add a spare print for later →
          </Link>
        </div>
      </div>
    </section>
  );
}
