"use client";

import { useEffect, useRef, useState } from "react";
import { formatCents } from "@/lib/catalog";
import WaitlistForm from "@/components/WaitlistForm";
import pdp from "./pdp.module.css";
import styles from "./HouseShop.module.css";

/*
 * 猫屋详情页主舞台（夜幕）：产品影片循环 + 候补面板。
 * 首批 10 件编号仍是产品叙事，但不再选号/预售（用户决策 2026-07-12）——
 * 统一走 waitlist：留邮箱，开售时候补名单优先。
 * 视频已抹除供应商 logo（含 logo 的镜头整段替换为干净镜头 + 静态补丁）。
 */

export default function HouseShop({ priceCents }: { priceCents: number }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const emailRef = useRef<HTMLInputElement | null>(null);
  const [reduced, setReduced] = useState<boolean | null>(null);

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  // 进入视口才播放；滚走暂停
  useEffect(() => {
    if (reduced !== false) return;
    const v = videoRef.current;
    if (!v) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) v.play().catch(() => {});
        else v.pause();
      },
      { threshold: 0.3 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, [reduced]);

  const jumpToForm = () => {
    emailRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => emailRef.current?.focus({ preventScroll: true }), 450);
  };

  return (
    <section className={`${pdp.stage} ${pdp.stageNight}`}>
      <div className={`shell ${pdp.stageGrid}`}>
        {/* ——— 宣传片 ——— */}
        <figure className={styles.mediaCol}>
          <div className={styles.screen}>
            {reduced === false ? (
              <video
                ref={videoRef}
                src="/c01/house-loop.mp4"
                poster="/c01/house-poster.jpg"
                muted
                loop
                playsInline
                preload="none"
                aria-label="The Canvas House at home: a cat slips through the porthole, naps inside, and lounges on top"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src="/c01/house-poster.jpg"
                alt="The Canvas House, a pine A-frame wearing a framed wave canvas, with a round doorway"
              />
            )}
          </div>
          <figcaption className={styles.filmTag}>
            straight off the set: no actors, just residents
          </figcaption>
        </figure>

        {/* ——— 候补面板 ——— */}
        <div className={pdp.panelCol}>
          <div className={pdp.panel}>
            <p className={pdp.panelKicker}>First run of ten · coming soon</p>
            <h1 className={pdp.panelTitle}>The Canvas House</h1>
            <p className={pdp.panelTagline}>
              The canvas, folded into a den. Two full scratch-paintings make
              the roof, a porthole makes the door, and inside is the quietest
              room in the house.
            </p>

            <p className={pdp.panelLabel}>The run</p>
            <p className={styles.runBlurb}>
              Ten numbered houses, built one at a time on our Melbourne bench.
              When the run opens, the waitlist hears first and gets first
              pick of the numbers.
            </p>

            <div className={pdp.buyRow}>
              <span className={pdp.price}>
                {formatCents(priceCents)} <em>expected · no charge to join</em>
              </span>
            </div>

            <p className={pdp.panelLabel}>Get first pick</p>
            <WaitlistForm
              handle="canvas-house"
              title="The Canvas House"
              inputRef={emailRef}
            />

            <ul className={pdp.panelNotes}>
              <li>Ten pieces in the first run, each numbered on the frame.</li>
              <li>
                Two swap-able scratch walls, same prints as the Scratcher.
              </li>
              <li>Waitlist is first in line when the run opens. That's all.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* ——— 移动端粘性候补条 ——— */}
      <div className={pdp.stickyBar}>
        <span className={pdp.stickyInfo}>
          <span className={pdp.stickyName}>The Canvas House</span>
          <span className={pdp.stickyPrice}>run of ten · coming soon</span>
        </span>
        <button className={pdp.stickyBtn} onClick={jumpToForm}>
          Join the waitlist
        </button>
      </div>
    </section>
  );
}
