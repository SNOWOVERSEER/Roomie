"use client";

import { useState } from "react";
import styles from "./TheShelf.module.css";

/** 未来系列的候补按钮 —— 本地态即可，不进购物篮语义。TODO(Shopify): 接邮件订阅 */
export default function WaitlistButton({ title }: { title: string }) {
  const [joined, setJoined] = useState(false);

  return (
    <button
      type="button"
      className={`${styles.wait} ${joined ? styles.waitDone : ""}`}
      onClick={() => setJoined(true)}
      disabled={joined}
      aria-label={
        joined ? `On the waitlist for ${title}` : `Join waitlist for ${title}`
      }
    >
      <span aria-live="polite">
        {joined ? "You're on it ✓" : "Join waitlist"}
      </span>
    </button>
  );
}
