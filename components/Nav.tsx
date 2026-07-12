"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import RoomieLogo from "./RoomieLogo";
import { useCart } from "./CartContext";
import styles from "./Nav.module.css";

export default function Nav() {
  const [solid, setSolid] = useState(false);
  const { count, bump, openDrawer } = useCart();

  useEffect(() => {
    // 一开始滚动就上底色 —— 内页内容从页顶就开始，阈值晚了
    // 文字会钻到透明导航底下（旧值 0.7vh 只对满屏 hero 的首页成立）
    const onScroll = () => setSolid(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`${styles.nav} ${solid ? styles.solid : ""}`}>
      <Link href="/" aria-label="RoomiePaw home" className={styles.logo}>
        <RoomieLogo height={38} />
      </Link>
      <nav className={styles.links}>
        <Link href="/scratcher">The Scratcher</Link>
        <Link href="/house" className={styles.newLink}>
          The House
        </Link>
        <Link href="/#coming-next">What&rsquo;s next</Link>
        <Link href="/#story">Our idea</Link>
      </nav>
      <button
        type="button"
        className={styles.cart}
        onClick={openDrawer}
        aria-label={`Basket, ${count} items`}
        aria-haspopup="dialog"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
          <path
            d="M4 9h16l-1.4 9.2a2.4 2.4 0 0 1-2.4 2H7.8a2.4 2.4 0 0 1-2.4-2L4 9Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M8.6 9c0-4.4 6.8-4.4 6.8 0"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        <span className={styles.count} key={bump}>
          {count}
        </span>
      </button>
    </header>
  );
}
