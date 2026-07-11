"use client";

import Link from "next/link";
import { HERO_COPY } from "@/lib/heroConfig";
import type { FreezeSteps } from "./Hero";
import styles from "./Hero.module.css";

interface Props {
  beats: { title: boolean; subtitle: boolean };
  steps: FreezeSteps;
}

/**
 * 首屏文案层。桌面端悬浮于画面右上墙面；移动端落回图像下方的奶油底。
 * 入场节拍由视频叙事驱动（beats），定格后由错峰序列驱动（steps）。
 */
export default function HeroCopy({ beats, steps }: Props) {
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
          <Link className="btnPrimary" href="/scratcher">
            {HERO_COPY.cta}
            <svg viewBox="0 0 20 20" width="17" height="17" aria-hidden>
              <path
                d="M4 10h11m-4.5-4.5L15 10l-4.5 4.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
          <span className={styles.ctaNote}>{HERO_COPY.ctaNote}</span>
        </div>
      </div>
    </div>
  );
}
