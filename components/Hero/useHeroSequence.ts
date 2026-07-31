"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { HERO_TIMINGS } from "@/lib/heroConfig";

export interface FreezeSteps {
  settled: boolean;
  cta: boolean;
  plaque: boolean;
  cue: boolean;
}

export interface HeroBeats {
  title: boolean;
  subtitle: boolean;
}

export interface HeroSequence {
  /** static = 无视频路径（reduced-motion / 移动端 / 播放失败）→ 落幅图 + 完整交互 */
  staticMode: boolean | null;
  frozen: boolean;
  beats: HeroBeats;
  steps: FreezeSteps;
  /** art 大图的放行闸：视频起播后才下，避开与视频抢首屏带宽 */
  loadArt: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** 跳过整场演出，直接进可交互的定格态 */
  skip: () => void;
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

/** 首屏剧场的时间轴状态机 —— 从 Hero.tsx 抽出，纯状态与副作用，不含渲染 */
export function useHeroSequence(): HeroSequence {
  const videoRef = useRef<HTMLVideoElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // static = 无视频路径（reduced-motion / 移动端 / 播放失败）→ 落幅图 + 完整交互
  const [staticMode, setStaticMode] = useState<boolean | null>(null);
  const [frozen, setFrozen] = useState(false);
  const [beats, setBeats] = useState<HeroBeats>({
    title: false,
    subtitle: false,
  });
  const [steps, setSteps] = useState<FreezeSteps>(NO_STEPS);
  // art 大图的放行闸：视频起播后才下，避开与视频抢首屏带宽
  const [loadArt, setLoadArt] = useState(false);
  // skip 会把视频 seek 到末尾，这会触发 ended —— 若不拦，
  // runFreezeSequence 会被 (true) 和 (false) 各跑一遍，错峰序列打架
  const skipped = useRef(false);

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

  const skip = useCallback(() => {
    if (skipped.current) return;
    skipped.current = true;
    setLoadArt(true); // 立刻要用画作了，不能再等 playing
    const v = videoRef.current;
    if (v && v.readyState >= 2) {
      // 有可播数据：停在末帧，画面与正常结束一致
      v.pause();
      try {
        v.currentTime = v.duration || 0;
      } catch {
        // duration 尚不可用时忽略，下面的静态降级会接住
      }
      runFreezeSequence(true);
    } else {
      // 视频还没来：直接走静态定格，staticMode 的 effect 会补齐其余
      setStaticMode(true);
    }
  }, [runFreezeSequence]);

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
      if (skipped.current) return;
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

  return { staticMode, frozen, beats, steps, loadArt, videoRef, skip };
}
