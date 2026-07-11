"use client";

import { useEffect, useRef, useState } from "react";
import { useCart } from "@/components/CartContext";
import pdp from "./pdp.module.css";
import styles from "./HouseShop.module.css";

/*
 * 猫屋详情页主舞台（夜幕）：产品影片循环 + 编号预订面板。
 * 首批 10 席编号预售 —— 选号是这页的记忆点交互；claimed 来自
 * lib/shopify.ts 的 mock（TODO(Shopify)：接 №01–№10 变体库存）。
 * TODO 文案：AU$189 与预订政策为占位，待用户确认。
 * 视频已抹除供应商 logo（含 logo 的镜头整段替换为干净镜头 + 静态补丁）。
 */

export default function HouseShop({
  total,
  claimed,
}: {
  total: number;
  claimed: number[];
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [reduced, setReduced] = useState<boolean | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const { add } = useCart();

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

  const nn = (n: number) => String(n).padStart(2, "0");

  const reserve = () => {
    if (picked == null) return;
    add("canvas-house", `The Canvas House · № ${nn(picked)}`, {
      line: "— your number is held",
      note: "first run of ten · nothing charged until it ships",
    });
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
                alt="The Canvas House — a pine A-frame wearing a framed wave canvas, with a round doorway"
              />
            )}
          </div>
          <figcaption className={styles.filmTag}>
            straight off the set — no actors, just residents
          </figcaption>
        </figure>

        {/* ——— 预订面板 ——— */}
        <div className={pdp.panelCol}>
          <div className={pdp.panel}>
            <p className={pdp.panelKicker}>Limited pre-release</p>
            <h1 className={pdp.panelTitle}>The Canvas House</h1>
            <p className={pdp.panelTagline}>
              The canvas, folded into a den. Two full scratch-paintings make
              the roof, a porthole makes the door — and inside is the quietest
              room in the house.
            </p>

            <p className={pdp.panelLabel}>
              Pick your number — we build in order
            </p>
            <div
              className={styles.numbers}
              role="radiogroup"
              aria-label={`Choose one of ${total} numbered pieces`}
            >
              {Array.from({ length: total }, (_, i) => i + 1).map((n) => {
                const gone = claimed.includes(n);
                return (
                  <button
                    key={n}
                    role="radio"
                    aria-checked={picked === n}
                    disabled={gone}
                    className={`${styles.numTag} ${picked === n ? styles.numOn : ""}`}
                    onClick={() => setPicked(n)}
                    aria-label={
                      gone ? `Number ${nn(n)}, taken` : `Number ${nn(n)}`
                    }
                  >
                    {nn(n)}
                  </button>
                );
              })}
            </div>
            <p className={styles.numHint} key={picked ?? "none"}>
              {picked == null
                ? `All ${total - claimed.length} of ${total} still on the shelf.`
                : `№ ${nn(picked)} — built ${picked === 1 ? "first" : `${nn(picked)} in line`}, stamped on the frame.`}
            </p>

            <div className={pdp.buyRow}>
              <span className={pdp.price}>
                AU$189 <em>nothing charged until it ships</em>
              </span>
              <button
                className="btnPrimary"
                onClick={reserve}
                disabled={picked == null}
                style={picked == null ? { opacity: 0.55 } : undefined}
              >
                {picked == null ? "Pick a number" : `Reserve № ${nn(picked)}`}
              </button>
            </div>

            <ul className={pdp.panelNotes}>
              <li>Ten pieces in the first run, each numbered on the frame.</li>
              <li>Two swap-able scratch walls — same canvases as the Scratcher.</li>
              <li>We email your number the same day, and build in order.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* ——— 移动端粘性预订条 ——— */}
      <div className={pdp.stickyBar}>
        <span className={pdp.stickyInfo}>
          <span className={pdp.stickyName}>
            {picked == null ? "The Canvas House" : `House · № ${nn(picked)}`}
          </span>
          <span className={pdp.stickyPrice}>AU$189 · run of {total}</span>
        </span>
        <button
          className={pdp.stickyBtn}
          onClick={reserve}
          disabled={picked == null}
          style={picked == null ? { opacity: 0.55 } : undefined}
        >
          {picked == null ? "Pick a number" : "Reserve it"}
        </button>
      </div>
    </section>
  );
}
