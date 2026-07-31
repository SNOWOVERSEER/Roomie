"use client";

/*
 * Hero 备忘（2026-07-11 v2，随店铺定位更新）——
 * 当前 Hero 是主打产品线（The Canvas Series）的独占剧场。
 * 等第二条产品线上架时，把本组件升级为整屏横向滑动的 HeroCarousel，
 * 而不是替换内容：
 *   1. 每条产品线一屏（各自的视频/落幅静帧 + 文案 + CTA），
 *      scroll-snap-x mandatory + 拖拽 + 键盘左右键 + 屏角点状导航；
 *   2. 数据源：lib/ 里加一个 heroSlides 配置数组——每条线一份自己的
 *      heroConfig（视频、FRAME_RECT、时间轴各自独立）；
 *   3. 本文件现有实现整体保留，作为 Carousel 的第 1 屏直接复用
 *      （视频剧场 + 换画交互不动，只是外面多一层滑轨）。
 */
import { useRef } from "react";
import { COVER_FOCUS } from "@/lib/heroConfig";
import { useVideoRect } from "./useVideoRect";
import { useHeroSequence } from "./useHeroSequence";
import HeroCopy from "./HeroCopy";
import ArtworkSwitcher from "./ArtworkSwitcher";
import styles from "./Hero.module.css";

export type { FreezeSteps } from "./useHeroSequence";

const objectPosition = `${COVER_FOCUS.x * 100}% ${COVER_FOCUS.y * 100}%`;

export default function Hero({
  priceText,
}: {
  /** 流式节点，晚于本组件到达 —— 不能是 string，否则 Hero 得等价格 */
  priceText: React.ReactNode;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const rect = useVideoRect(stageRef);
  const { staticMode, frozen, beats, steps, loadArt, videoRef } =
    useHeroSequence();

  return (
    <section className={styles.hero} id="top" aria-label="The Canvas Scratcher">
      <div className={styles.stage} ref={stageRef}>
        {staticMode === false && (
          <video
            ref={videoRef}
            className={styles.media}
            style={{ objectPosition }}
            src="/hero/cat-scratcher-10s.mp4"
            poster="/hero/poster-first.jpg"
            muted
            playsInline
            preload="auto"
            aria-label="A cat walks into a sunny living room, scratches a framed canvas leaning on the wall, then sits beside it"
          />
        )}
        {staticMode === true && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className={styles.media}
            style={{ objectPosition }}
            src="/hero/still-last.jpg"
            alt="A cat sits beside a framed canvas scratcher in a sunny living room"
          />
        )}

        {/* 活着的静止：定格后极缓的光斑呼吸 */}
        <div
          className={`${styles.breath} ${frozen ? styles.breathOn : ""}`}
          aria-hidden
        />

        {/* 极淡暖色径向蒙版，托住桌面端文字（随标题一起淡入） */}
        <div
          className={`${styles.textGlow} ${beats.title ? styles.glowOn : ""}`}
          aria-hidden
        />

        {rect && (
          <ArtworkSwitcher
            rect={rect}
            active={frozen}
            revealed={steps.plaque}
            loadArt={loadArt}
          />
        )}

        {/* 滚动提示：一对爪印轮替走路，最后最轻地出现 */}
        <div
          className={`${styles.cue} ${steps.cue ? styles.cueOn : ""}`}
          aria-hidden
        >
          <svg viewBox="0 0 26 30" width="18">
            <g className={styles.pawA} fill="currentColor">
              <ellipse cx="8" cy="8" rx="4" ry="3.4" />
              <ellipse cx="3.4" cy="3.8" rx="1.7" ry="2.1" />
              <ellipse cx="8" cy="2.2" rx="1.7" ry="2.1" />
              <ellipse cx="12.6" cy="3.8" rx="1.7" ry="2.1" />
            </g>
            <g className={styles.pawB} fill="currentColor">
              <ellipse cx="18" cy="24" rx="4" ry="3.4" />
              <ellipse cx="13.4" cy="19.8" rx="1.7" ry="2.1" />
              <ellipse cx="18" cy="18.2" rx="1.7" ry="2.1" />
              <ellipse cx="22.6" cy="19.8" rx="1.7" ry="2.1" />
            </g>
          </svg>
        </div>
      </div>

      <HeroCopy beats={beats} steps={steps} priceText={priceText} />
    </section>
  );
}
