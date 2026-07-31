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
import { useCallback, useEffect, useRef, useState } from "react";
import { COVER_FOCUS, HERO_TIMINGS } from "@/lib/heroConfig";
import { useVideoRect } from "./useVideoRect";
import HeroCopy from "./HeroCopy";
import ArtworkSwitcher from "./ArtworkSwitcher";
import styles from "./Hero.module.css";

export interface FreezeSteps {
  settled: boolean;
  cta: boolean;
  plaque: boolean;
  cue: boolean;
}

const NO_STEPS: FreezeSteps = {
  settled: false,
  cta: false,
  plaque: false,
  cue: false,
};
const ALL_STEPS: FreezeSteps = {
  settled: true,
  cta: true,
  plaque: true,
  cue: true,
};

const objectPosition = `${COVER_FOCUS.x * 100}% ${COVER_FOCUS.y * 100}%`;

export default function Hero({
  priceText,
}: {
  /** 流式节点，晚于本组件到达 —— 不能是 string，否则 Hero 得等价格 */
  priceText: React.ReactNode;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const rect = useVideoRect(stageRef);

  // static = 无视频路径（reduced-motion / 移动端 / 播放失败）→ 落幅图 + 完整交互
  const [staticMode, setStaticMode] = useState<boolean | null>(null);
  const [frozen, setFrozen] = useState(false);
  const [beats, setBeats] = useState({ title: false, subtitle: false });
  const [steps, setSteps] = useState<FreezeSteps>(NO_STEPS);
  // art 大图的放行闸：视频起播后才下，避开与视频抢首屏带宽
  const [loadArt, setLoadArt] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const small = window.matchMedia("(max-width: 760px)");
    setStaticMode(reduced.matches || small.matches);
  }, []);

  const runFreezeSequence = useCallback((instant: boolean) => {
    setFrozen(true);
    setBeats({ title: true, subtitle: true });
    if (instant) {
      setSteps(ALL_STEPS);
      return;
    }
    const t = HERO_TIMINGS.freeze;
    const plan: [number, keyof FreezeSteps][] = [
      [t.settle, "settled"],
      [t.cta, "cta"],
      [t.plaque, "plaque"],
      [t.scrollCue, "cue"],
    ];
    for (const [delay, key] of plan) {
      timers.current.push(
        setTimeout(() => setSteps((s) => ({ ...s, [key]: true })), delay),
      );
    }
  }, []);

  // 视频模式：起播 + 与叙事咬合的文字节拍
  useEffect(() => {
    if (staticMode !== false) return;
    const v = videoRef.current;
    if (!v) return;

    const tryPlay = () => {
      const p = v.play();
      if (p) p.catch(() => setStaticMode(true)); // autoplay 被拒 → 静态降级
    };
    if (v.readyState >= 2) tryPlay();

    // 弱网兜底：迟迟拿不到可播数据就放弃视频，让用户至少拿到完整的静态首屏
    const loadGuard = setTimeout(() => {
      if (v.readyState < 2) setStaticMode(true);
    }, HERO_TIMINGS.loadTimeout);

    const onTime = () => {
      const t = v.currentTime;
      setBeats((b) => {
        const title = b.title || t >= HERO_TIMINGS.title;
        const subtitle = b.subtitle || t >= HERO_TIMINGS.subtitle;
        return title === b.title && subtitle === b.subtitle
          ? b
          : { title, subtitle };
      });
    };
    const onEnded = () => {
      v.pause(); // 定格最后一帧
      runFreezeSequence(false);
    };
    const onError = () => setStaticMode(true);
    const onPlaying = () => setLoadArt(true);

    v.addEventListener("canplay", tryPlay, { once: true });
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("ended", onEnded);
    v.addEventListener("error", onError);
    v.addEventListener("playing", onPlaying, { once: true });
    return () => {
      clearTimeout(loadGuard);
      v.removeEventListener("canplay", tryPlay);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("ended", onEnded);
      v.removeEventListener("error", onError);
      v.removeEventListener("playing", onPlaying);
    };
  }, [staticMode, runFreezeSequence]);

  // 文案的页面时钟兜底 —— beats 平时由视频时间驱动，但视频不起播时
  // currentTime 恒为 0，首屏会一个字都没有。两条轨先到者生效。
  useEffect(() => {
    if (staticMode !== false) return;
    const f = HERO_TIMINGS.fallback;
    timers.current.push(
      setTimeout(
        () => setBeats((b) => (b.title ? b : { ...b, title: true })),
        f.title,
      ),
      setTimeout(
        () => setBeats((b) => (b.subtitle ? b : { ...b, subtitle: true })),
        f.subtitle,
      ),
    );
  }, [staticMode]);

  // 静态模式：reduced-motion 全量直呈；小屏走一遍快速错峰
  useEffect(() => {
    if (staticMode !== true) return;
    setLoadArt(true); // 无视频可等，画作 350ms 后就要用
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced) {
      runFreezeSequence(true);
    } else {
      setBeats((b) => ({ ...b, title: true }));
      timers.current.push(setTimeout(() => runFreezeSequence(false), 350));
    }
  }, [staticMode, runFreezeSequence]);

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
    },
    [],
  );

  return (
    <section className={styles.hero} id="top" aria-label="The Canvas Scratcher">
      <div className={styles.stage} ref={stageRef}>
        {staticMode === false && (
          <video
            ref={videoRef}
            className={styles.media}
            style={{ objectPosition }}
            poster="/hero/poster-first.jpg"
            muted
            playsInline
            preload="auto"
            aria-label="A cat walks into a sunny living room, scratches a framed canvas leaning on the wall, then sits beside it"
          >
            {/* VP9 优先，H.264 兜底 —— Safari 不吃 VP9 会自动落到下一条 */}
            <source src="/hero/cat-scratcher-10s.webm" type="video/webm" />
            <source src="/hero/cat-scratcher-10s.mp4" type="video/mp4" />
          </video>
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
