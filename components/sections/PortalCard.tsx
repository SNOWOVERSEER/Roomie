"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import styles from "./PortalCard.module.css";

/*
 * Landing 的产品门户卡：整卡可点，负责「勾」而不是「讲」。
 * 媒体两种活法：
 *  - cycle：进入视口后照片轮替。交叉溶解 + 全帧同相位慢漂移（切换读作
 *    一次呼吸而非跳变）；悬停暂停；横滑（鼠标/触屏同路）手动翻页，
 *    活动圆点是随停留时长填充的进度胶囊。未加载完的帧绝不切入 ——
 *    宁可多停一拍，也不溶解到空白上。
 *  - video：细指针悬停播放 / 触屏进入视口播放（猫屋宣传片试看）
 * 媒体底下垫一层品牌微光，网络慢时不露白。
 */

type Media =
  | { kind: "cycle"; images: { src: string; alt: string }[] }
  | { kind: "video"; src: string; poster: string; alt: string };

/** 每帧停留 / 交叉溶解时长（进度胶囊经 CSS 变量同源取值） */
const DWELL = 4600;
const FADE = 900;
/** 判定为横滑的位移阈值（px） */
const SWIPE = 44;

export default function PortalCard({
  href,
  kicker,
  title,
  blurb,
  cta,
  tag,
  media,
}: {
  href: string;
  kicker: string;
  title: string;
  blurb: string;
  cta: string;
  tag?: string;
  media: Media;
}) {
  const rootRef = useRef<HTMLAnchorElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const loadedRef = useRef<Set<number>>(new Set());
  const swipe = useRef({
    on: false,
    x0: 0,
    y0: 0,
    dx: 0,
    swiping: false,
    consumed: false,
  });
  const [frame, setFrame] = useState(0);
  const [inView, setInView] = useState(false);
  const [hovered, setHovered] = useState(false);
  // 手动翻页后 bump，重置自动轮替计时（避免刚滑完立刻又自动跳）
  const [cycleKey, setCycleKey] = useState(0);

  const count = media.kind === "cycle" ? media.images.length : 0;

  /** 从 from 出发找下一个已加载的帧（dir=±1）；都没加载就原地停 */
  const nextLoaded = useCallback(
    (from: number, dir: 1 | -1) => {
      for (let s = 1; s < count; s++) {
        const c = (((from + dir * s) % count) + count) % count;
        if (loadedRef.current.has(c)) return c;
      }
      return from;
    },
    [count],
  );

  // 视口检测（轮替与触屏视频共用）
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // 照片轮替（悬停暂停；手动翻页重置节拍）
  useEffect(() => {
    if (media.kind !== "cycle" || !inView || hovered) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setFrame((f) => nextLoaded(f, 1)), DWELL);
    return () => clearInterval(t);
  }, [media, inView, hovered, cycleKey, nextLoaded]);

  // 视频：hover 播放（细指针）/ 视口播放（触屏）
  useEffect(() => {
    if (media.kind !== "video") return;
    const v = videoRef.current;
    if (!v) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const fine = window.matchMedia("(hover: hover)").matches;
    if (fine) return; // 细指针交给 onPointerEnter/Leave
    if (inView) v.play().catch(() => {});
    else v.pause();
  }, [media, inView]);

  const hoverPlay = (on: boolean) => {
    if (media.kind !== "video") return;
    if (!window.matchMedia("(hover: hover)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const v = videoRef.current;
    if (!v) return;
    if (on) v.play().catch(() => {});
    else v.pause();
  };

  const jump = (dir: 1 | -1) => {
    setFrame((f) => nextLoaded(f, dir));
    setCycleKey((k) => k + 1);
  };

  /* ―― 横滑翻页：鼠标与触屏同一路（touch-action: pan-y 保住纵向滚动）―― */
  const onPointerDown = (e: React.PointerEvent) => {
    if (media.kind !== "cycle" || !e.isPrimary) return;
    swipe.current = {
      on: true,
      x0: e.clientX,
      y0: e.clientY,
      dx: 0,
      swiping: false,
      consumed: false,
    };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const s = swipe.current;
    if (!s.on) return;
    const dx = e.clientX - s.x0;
    const dy = e.clientY - s.y0;
    if (!s.swiping) {
      if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        s.swiping = true;
        rootRef.current?.setPointerCapture(e.pointerId);
        // 拖动期间关掉回弹过渡，位移必须跟手
        if (mediaRef.current) mediaRef.current.style.transition = "none";
      } else if (Math.abs(dy) > 16) {
        s.on = false; // 纵向意图：让给页面滚动
        return;
      }
    }
    if (s.swiping) {
      s.dx = dx;
      // 跟手的少量位移反馈（阻尼 + 封顶），松手回弹
      const m = mediaRef.current;
      if (m) {
        const shift = Math.max(-26, Math.min(26, dx * 0.18));
        m.style.transform = `translateX(${shift}px)`;
      }
    }
  };
  const endSwipe = () => {
    const s = swipe.current;
    if (!s.on) return;
    s.on = false;
    const m = mediaRef.current;
    if (m) {
      m.style.transition = "";
      m.style.transform = "";
    }
    if (!s.swiping) return;
    if (s.dx <= -SWIPE) jump(1);
    else if (s.dx >= SWIPE) jump(-1);
    // 滑过判定阈的手势不当作点击进详情页
    s.consumed = Math.abs(s.dx) > 12;
    s.swiping = false;
  };

  return (
    <Link
      href={href}
      ref={rootRef}
      className={styles.card}
      style={{ "--dwell": `${DWELL}ms`, "--fade": `${FADE}ms` } as React.CSSProperties}
      onPointerEnter={() => {
        hoverPlay(true);
        // 触屏的 tap 也会触发 pointerenter，悬停暂停只给细指针
        if (window.matchMedia("(hover: hover)").matches) setHovered(true);
      }}
      onPointerLeave={() => {
        hoverPlay(false);
        setHovered(false);
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endSwipe}
      onPointerCancel={endSwipe}
      onDragStart={(e) => e.preventDefault()}
      onClickCapture={(e) => {
        if (swipe.current.consumed) {
          e.preventDefault();
          e.stopPropagation();
          swipe.current.consumed = false;
        }
      }}
    >
      <div className={styles.media} ref={mediaRef}>
        {media.kind === "cycle" ? (
          media.images.map((im, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={im.src}
              src={im.src}
              alt={i === 0 ? im.alt : ""}
              aria-hidden={i !== 0}
              loading="lazy"
              decoding="async"
              draggable={false}
              ref={(el) => {
                if (el && el.complete && el.naturalWidth > 0)
                  loadedRef.current.add(i);
              }}
              onLoad={() => loadedRef.current.add(i)}
              className={i === frame ? styles.frameOn : styles.frameOff}
            />
          ))
        ) : (
          <video
            ref={videoRef}
            src={media.src}
            poster={media.poster}
            muted
            loop
            playsInline
            preload="none"
            aria-label={media.alt}
          />
        )}
        {tag && <span className={styles.tag}>{tag}</span>}
        {media.kind === "cycle" && (
          <span
            className={`${styles.dots} ${hovered ? styles.dotsPaused : ""}`}
            aria-hidden
          >
            {media.images.map((im, i) => (
              <i
                key={i === frame ? `on-${frame}-${cycleKey}` : `off-${im.src}`}
                className={i === frame ? styles.dotOn : ""}
              />
            ))}
          </span>
        )}
      </div>

      <div className={styles.body}>
        <p className={styles.kicker}>{kicker}</p>
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.blurb}>{blurb}</p>
        <span className={styles.cta}>
          {cta}
          <svg viewBox="0 0 20 20" width="16" aria-hidden>
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
      </div>
    </Link>
  );
}
