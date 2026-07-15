"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./SubscribeDialog.module.css";

/*
 * Roomie letter 订阅弹层：桌面居中纸卡 / 移动端底部抽屉。
 * 成功即在纸吊牌式票券里亮出个人 10% 码（复制按钮 + 已同步发邮箱），
 * 不做"去邮箱查收"的断头路。开合惯例与 CartDrawer 一致：
 * Esc / 点背景关闭、body 滚动锁、焦点进出还原、Tab 圈闭。
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function SubscribeDialog({
  open,
  source,
  onClose,
  onSubscribed,
}: {
  open: boolean;
  source: string;
  onClose: () => void;
  onSubscribed: () => void;
}) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<null | {
    code: string | null;
    already: boolean;
  }>(null);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  // 滚动锁 + 焦点进出（同 CartDrawer 惯例）
  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = window.setTimeout(
      () => inputRef.current?.focus({ preventScroll: true }),
      80,
    );
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
      restoreRef.current?.focus?.({ preventScroll: true });
    };
  }, [open, onClose]);

  if (!open) return null;

  // 轻量 Tab 圈闭：焦点只在卡片内循环
  const trapTab = (e: React.KeyboardEvent) => {
    if (e.key !== "Tab") return;
    const root = cardRef.current;
    if (!root) return;
    const focusables = root.querySelectorAll<HTMLElement>(
      'button, [href], input:not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])',
    );
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      setErr("That email doesn't look right. Mind checking it?");
      inputRef.current?.focus();
      return;
    }
    // 蜜罐值在 await 之前取（React 合成事件的 currentTarget 之后会失效）
    const company =
      (new FormData(e.currentTarget).get("company") as string) ?? "";
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value, source, company }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        code?: string | null;
        already?: boolean;
      };
      if (!res.ok || !data.ok) throw new Error("failed");
      setDone({ code: data.code ?? null, already: !!data.already });
      onSubscribed();
    } catch {
      setErr("Couldn't sign you up just now. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!done?.code) return;
    try {
      await navigator.clipboard.writeText(done.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* 剪贴板被拒：码本身可选中，手动复制仍可行 */
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        ref={cardRef}
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-labelledby="letter-heading"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={trapTab}
      >
        <button
          type="button"
          className={styles.x}
          onClick={onClose}
          aria-label="Close"
        >
          <svg viewBox="0 0 20 20" width="16" aria-hidden>
            <path
              d="m5 5 10 10M15 5 5 15"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          </svg>
        </button>

        {done ? (
          <div>
            <p className={styles.kicker}>
              {done.already ? "Welcome back" : "You're in"}
            </p>
            <h2 className={styles.heading} id="letter-heading">
              {done.code
                ? "Here's your ten percent."
                : "You're on the letter."}
            </h2>
            {done.code ? (
              <>
                <div className={styles.ticket}>
                  <span className={styles.ticketLabel}>
                    10% off your first piece
                  </span>
                  <span className={styles.ticketCode}>{done.code}</span>
                </div>
                <div className={styles.ticketRow}>
                  <button
                    type="button"
                    className={styles.copy}
                    onClick={copy}
                    aria-live="polite"
                  >
                    {copied ? "Copied" : "Copy code"}
                  </button>
                  <span className={styles.fine}>
                    Also in your inbox · one use · paste it at checkout
                  </span>
                </div>
              </>
            ) : (
              <p className={styles.sub}>
                Your code is on its way to your inbox.
              </p>
            )}
            <button
              type="button"
              className={`btnPrimary ${styles.doneBtn}`}
              onClick={onClose}
            >
              Keep browsing
            </button>
          </div>
        ) : (
          <div>
            <p className={styles.kicker}>The Roomie letter</p>
            <h2 className={styles.heading} id="letter-heading">
              Ten percent, for the first piece.
            </h2>
            <p className={styles.sub}>
              First look at new pieces and restocks, plus the occasional treat
              for the ones on four legs. A couple of emails a month, no noise.
            </p>
            <form className={styles.form} onSubmit={submit} noValidate>
              {/* 蜜罐：真人不可见不可达，脚本填了就被后端静默丢弃 */}
              <input
                type="text"
                name="company"
                className={styles.hp}
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
              />
              <div className={styles.row}>
                <label className="srOnly" htmlFor="letter-email">
                  Email for the Roomie letter
                </label>
                <input
                  id="letter-email"
                  ref={inputRef}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@somewhere.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (err) setErr(null);
                  }}
                  aria-invalid={!!err}
                  disabled={busy}
                />
                <button type="submit" className={styles.join} disabled={busy}>
                  {busy ? "Sending…" : "Send my code"}
                </button>
              </div>
              {err && (
                <p className={styles.err} role="alert">
                  {err}
                </p>
              )}
              <p className={styles.legal}>
                10% off your first order · one use · unsubscribe any time.
              </p>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
