"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePromo } from "./PromoProvider";
import PawTokenBurst from "./PawTokenBurst";
import styles from "./PromoBar.module.css";

type Emitter = {
  active: boolean;
  x: number;
  y: number;
};

/*
 * 活动栏位：细窄一条，坐在固定导航栈的最上沿。
 * - 只在页面顶部露脸：一滚动就向上收起（与 Nav 变实底同一阈值），
 *   回到顶部再出现 —— 信息给到，但不长期占屏
 * - 结算动线（/cart /checkout）不打扰
 * - 关闭：先播收起动画，再让 Provider 写 7 天 cookie
 * - 高度动画用 grid-rows 0fr/1fr，内容自然高度、无 magic number；
 *   导航在同一个 flex 栈里，跟着一起顺滑上移，页面内容零位移
 */
export default function PromoBar() {
  const { campaign, dismiss, openSubscribe } = usePromo();
  const pathname = usePathname();
  const [tucked, setTucked] = useState(false);
  const [closing, setClosing] = useState(false);
  const [emitter, setEmitter] = useState<Emitter>({
    active: false,
    x: 0,
    y: 0,
  });

  useEffect(() => {
    const onScroll = () => setTucked(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!tucked && !closing) return;
    setEmitter((current) =>
      current.active ? { ...current, active: false } : current,
    );
  }, [closing, tucked]);

  if (!campaign) return null;
  if (pathname === "/cart" || pathname.startsWith("/checkout")) return null;

  const collapsed = tucked || closing;

  const close = () => {
    setClosing(true);
    window.setTimeout(dismiss, 440);
  };

  const startEmitter = (target: HTMLElement) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const rect = target.getBoundingClientRect();
    setEmitter({
      active: true,
      x: rect.left + rect.width / 2,
      y: rect.bottom - 2,
    });
  };

  const stopEmitter = () => {
    setEmitter((current) =>
      current.active ? { ...current, active: false } : current,
    );
  };

  const openPromoSubscribe = () => {
    stopEmitter();
    openSubscribe("promo-bar");
  };

  const ctaContent = <span className={styles.ctaText}>{campaign.cta}</span>;

  return (
    <div
      className={`${styles.wrap} ${collapsed ? styles.tuckedWrap : ""}`}
      inert={collapsed || undefined}
    >
      <div className={styles.clip}>
        <div className={styles.bar}>
          <p className={styles.msg}>{campaign.message}</p>
          {campaign.kind === "subscribe" ? (
            <button
              type="button"
              className={styles.cta}
              onClick={openPromoSubscribe}
              onMouseEnter={(event) => startEmitter(event.currentTarget)}
              onMouseLeave={stopEmitter}
            >
              {ctaContent}
            </button>
          ) : (
            <Link
              className={styles.cta}
              href={campaign.href ?? "/"}
              onClick={stopEmitter}
              onMouseEnter={(event) => startEmitter(event.currentTarget)}
              onMouseLeave={stopEmitter}
            >
              {ctaContent}
            </Link>
          )}
          <button
            type="button"
            className={styles.x}
            onClick={close}
            aria-label="Hide this offer"
          >
            <svg viewBox="0 0 20 20" width="14" aria-hidden>
              <path
                d="m5 5 10 10M15 5 5 15"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>
      <PawTokenBurst active={emitter.active} x={emitter.x} y={emitter.y} />
    </div>
  );
}
