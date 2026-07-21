"use client";

import Image from "next/image";
import Link from "next/link";
import { HERO_COPY } from "@/lib/heroConfig";
import type { FreezeSteps } from "./Hero";
import styles from "./Hero.module.css";

interface Props {
  beats: { title: boolean; subtitle: boolean };
  steps: FreezeSteps;
  /** 抓板现价（服务端 formatCents 结果），来自 products 表 */
  priceText: string;
}

/**
 * 首屏文案层。桌面端悬浮于画面右上墙面；移动端落回图像下方的奶油底。
 * 入场节拍由视频叙事驱动（beats），定格后由错峰序列驱动（steps）。
 */
export default function HeroCopy({ beats, steps, priceText }: Props) {
  return (
    <div className={styles.copyLayer}>
      <div
        className={`${styles.copy} ${steps.settled ? styles.copySettled : ""}`}
      >
        <h1 className={`${styles.title} ${beats.title ? styles.on : ""}`}>
          {HERO_COPY.title[0]}
          <br />
          {HERO_COPY.title[1]}
        </h1>
        <p className={`${styles.subtitle} ${beats.subtitle ? styles.on : ""}`}>
          {HERO_COPY.subtitle}
        </p>

        <div className={`${styles.ctaRow} ${steps.cta ? styles.on : ""}`}>
          {/* 引流进详情页（下单在 /scratcher），不再直接加购 */}
          <Link
            className={`btnPrimary ${styles.heroCta}`}
            href="/scratcher"
            aria-label={HERO_COPY.cta}
          >
            <span className={styles.ctaMover} aria-hidden>
              <span className={styles.ctaCat}>
                <Image
                  src="/interaction/roomie-pushing-cat.png"
                  alt=""
                  width={240}
                  height={135}
                  priority
                />
              </span>
              <span className={styles.ctaMiniFrame}>
                <Image
                  src="/hero/art/flat-01-s.jpg"
                  alt=""
                  width={70}
                  height={100}
                  priority
                />
              </span>
            </span>

            <span className={styles.ctaLabel} aria-hidden>
              <span className={styles.ctaLong}>{HERO_COPY.cta}</span>
              <span className={styles.ctaShort}>Shop the Scratcher</span>
              <svg
                className={styles.ctaArrow}
                viewBox="0 0 20 20"
                width="17"
                height="17"
              >
                <path
                  d="M4 10h11m-4.5-4.5L15 10l-4.5 4.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </Link>
          <span className={styles.ctaNote}>{HERO_COPY.ctaNote(priceText)}</span>
        </div>
      </div>
    </div>
  );
}
