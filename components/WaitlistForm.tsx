"use client";

import { useRef, useState } from "react";
import styles from "./WaitlistForm.module.css";

/*
 * 候补登记（全站共用）：问邮箱 → 简单格式校验 → POST /api/waitlist。
 * 两种形态：
 *   compact —— What's next 卡片：先是一颗小按钮，点开才展开输入行（渐进披露）
 *   常开    —— 猫屋面板：输入行直接可见
 * 重复提交后端幂等，回 already → 文案区分「已在名单上」。
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type WaitlistFormHandle = { focus: () => void };

export default function WaitlistForm({
  handle,
  title,
  compact = false,
  cta = "Join the waitlist",
  inputRef,
}: {
  handle: string;
  title: string;
  compact?: boolean;
  cta?: string;
  /** 外部聚焦用（如移动端粘性条按钮滚到表单后 focus） */
  inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  const [opened, setOpened] = useState(!compact);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<null | "new" | "already">(null);
  const localRef = useRef<HTMLInputElement | null>(null);
  const ref = inputRef ?? localRef;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      setErr("That email doesn't look right. Mind checking it?");
      ref.current?.focus();
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value, handle }),
      });
      const data = (await res.json()) as { ok?: boolean; already?: boolean };
      if (!res.ok || !data.ok) throw new Error("failed");
      setDone(data.already ? "already" : "new");
    } catch {
      setErr("Couldn't save that just now. Try again in a moment.");
      setBusy(false);
    }
  };

  if (done) {
    return (
      <p className={styles.done} role="status">
        <span aria-hidden>✓</span>
        {done === "new"
          ? "You're on the list. First word goes to your inbox."
          : "Already on it. You're set."}
      </p>
    );
  }

  if (compact && !opened) {
    return (
      <button
        type="button"
        className={styles.opener}
        onClick={() => {
          setOpened(true);
          // 展开后聚焦输入
          setTimeout(() => ref.current?.focus(), 30);
        }}
        aria-label={`Join waitlist for ${title}`}
      >
        {cta}
      </button>
    );
  }

  return (
    <form
      className={`${styles.form} ${compact ? styles.formCompact : ""}`}
      onSubmit={submit}
      noValidate
    >
      <label className="srOnly" htmlFor={`wl-${handle}`}>
        Email for the {title} waitlist
      </label>
      <div className={styles.row}>
        <input
          id={`wl-${handle}`}
          ref={ref}
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
          {busy ? "Adding…" : cta}
        </button>
      </div>
      {err && (
        <p className={styles.err} role="alert">
          {err}
        </p>
      )}
    </form>
  );
}
