"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import RoomieLogo from "./RoomieLogo";
import { useCart } from "./CartContext";
import styles from "./Nav.module.css";

export default function Nav() {
  const [solid, setSolid] = useState(false);
  const { count, bump } = useCart();

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > window.innerHeight * 0.7);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`${styles.nav} ${solid ? styles.solid : ""}`}>
      <Link href="/" aria-label="Roomie — home" className={styles.logo}>
        <RoomieLogo height={38} />
      </Link>
      <nav className={styles.links}>
        <Link href="/scratcher">The Scratcher</Link>
        <Link href="/house" className={styles.newLink}>
          The House
        </Link>
        <Link href="/#collection">The shelf</Link>
        <Link href="/#story">Our idea</Link>
      </nav>
      <button className={styles.cart} aria-label={`Basket, ${count} items`}>
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
