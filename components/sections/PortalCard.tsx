"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import styles from "./PortalCard.module.css";

/*
 * Landing 的产品门户卡：整卡可点，负责「勾」而不是「讲」。
 * 媒体两种活法：
 *  - cycle：进入视口后照片轮替。自动挡 = 交叉溶解 + 全帧同相位慢漂移，
 *    活动圆点是随停留时长填充的进度胶囊；手动挡 = 连续可逆拖拽——
 *    下一张随拖动进度渐显、媒体跟手位移，过阈值（或甩动够快）落定切换，
 *    不够则平滑退回，绝无"弹回再硬切"。未加载完的帧绝不切入。
 *  - video：进入视口即播、离开暂停（所有指针类型一视同仁——
 *    hover 门控对触屏用户等于永不播放，已废除）。
 * 媒体底下垫一层品牌微光，网络慢时不露白。
 */

type Media =
  | { kind: "cycle"; images: { src: string; alt: string }[] }
  | { kind: "video"; src: string; poster: string; alt: string };

/** 每帧停留 / 交叉溶解时长（进度胶囊经 CSS 变量同源取值） */
const DWELL = 4600;
const FADE = 900;

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
  const imgRefs = useRef<(HTMLImageElement | null)[]>([]);
  const loadedRef = useRef<Set<number>>(new Set());
  const settleTimer = useRef(0);
  const swipe = useRef({
    on: false,
    dragging: false,
    x0: 0,
    y0: 0,
    dx: 0,
    commitDx: 120,
    candidate: -1,
    consumed: false,
    lastX: 0,
    lastT: 0,
    vx: 0,
  });
  const [frame, setFrame] = useState(0);
  const [inView, setInView] = useState(false);
  const [hovered, setHovered] = useState(false);
  // 手动翻页后 bump，重置自动轮替计时（避免刚拖完立刻又自动跳）
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

  // 视口检测（轮替与视频共用）
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

  // 照片轮替（悬停或拖拽中暂停；手动翻页重置节拍）
  useEffect(() => {
    if (media.kind !== "cycle" || !inView || hovered) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => {
      if (swipe.current.dragging) return;
      setFrame((f) => nextLoaded(f, 1));
    }, DWELL);
    return () => clearInterval(t);
  }, [media, inView, hovered, cycleKey, nextLoaded]);

  // 视频：进入视口播放 / 离开暂停（触屏与桌面同一逻辑）
  useEffect(() => {
    if (media.kind !== "video") return;
    const v = videoRef.current;
    if (!v) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (inView) v.play().catch(() => {});
    else v.pause();
  }, [media, inView]);

  useEffect(() => () => window.clearTimeout(settleTimer.current), []);

  /* ―― 连续可逆拖拽（鼠标与触屏同一路；touch-action: pan-y 保住纵向滚动）――
     拖动中直接写 DOM（media 位移 + 候选帧透明度），不走 React 渲染，
     每一像素都跟手；松手才回到 React 状态机。 */

  const candidateImg = () =>
    swipe.current.candidate >= 0
      ? imgRefs.current[swipe.current.candidate]
      : null;

  const clearCandidateInline = () => {
    const img = candidateImg();
    if (img) {
      img.style.opacity = "";
      img.style.transition = "";
      img.style.zIndex = "";
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (media.kind !== "cycle" || !e.isPrimary) return;
    window.clearTimeout(settleTimer.current);
    const w = mediaRef.current?.clientWidth ?? 420;
    swipe.current = {
      on: true,
      dragging: false,
      x0: e.clientX,
      y0: e.clientY,
      dx: 0,
      // 提交阈值：跟卡宽走但设上限，桌面大卡不用拖半屏
      commitDx: Math.min(Math.max(w * 0.28, 64), 150),
      candidate: -1,
      consumed: false,
      lastX: e.clientX,
      lastT: e.timeStamp,
      vx: 0,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const s = swipe.current;
    if (!s.on) return;
    const dx = e.clientX - s.x0;
    const dy = e.clientY - s.y0;
    if (!s.dragging) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        s.dragging = true;
        rootRef.current?.setPointerCapture(e.pointerId);
        if (mediaRef.current) mediaRef.current.style.transition = "none";
      } else if (Math.abs(dy) > 16) {
        s.on = false; // 纵向意图：让给页面滚动
        return;
      } else {
        return;
      }
    }
    s.dx = dx;
    const dt = e.timeStamp - s.lastT;
    if (dt > 0) {
      s.vx = 0.75 * s.vx + 0.25 * ((e.clientX - s.lastX) / dt);
      s.lastX = e.clientX;
      s.lastT = e.timeStamp;
    }

    // 方向可中途反转：候选帧换人时把旧候选的内联样式清干净
    const dir: 1 | -1 = dx < 0 ? 1 : -1;
    const cand = nextLoaded(frame, dir);
    if (cand !== s.candidate) {
      clearCandidateInline();
      s.candidate = cand !== frame ? cand : -1;
      const img = candidateImg();
      if (img) {
        img.style.transition = "none";
        img.style.zIndex = "2";
      }
    }

    const progress = Math.min(1, Math.abs(dx) / s.commitDx);
    const m = mediaRef.current;
    if (m) {
      const shift =
        Math.sign(dx) * Math.min(Math.abs(dx) * 0.5, s.commitDx * 0.62);
      m.style.transform = `translateX(${shift}px)`;
    }
    const img = candidateImg();
    if (img) img.style.opacity = String(progress * 0.98);
  };

  const endSwipe = () => {
    const s = swipe.current;
    if (!s.on) return;
    s.on = false;
    if (!s.dragging) return;
    s.dragging = false;
    s.consumed = Math.abs(s.dx) > 12; // 拖过的手势不当作点击进详情页

    const m = mediaRef.current;
    if (m) {
      m.style.transition = ""; // 恢复 CSS 里的回弹过渡
      m.style.transform = "";
    }

    const progress = Math.min(1, Math.abs(s.dx) / s.commitDx);
    const flung = progress > 0.35 && Math.abs(s.vx) > 0.45;
    const img = candidateImg();
    const commit = s.candidate >= 0 && !!img && (progress >= 1 || flung || progress >= 0.62);

    if (commit && img) {
      const target = s.candidate;
      img.style.transition = "opacity 240ms cubic-bezier(0.22, 0.61, 0.21, 1)";
      img.style.opacity = "1";
      settleTimer.current = window.setTimeout(() => {
        setFrame(target);
        setCycleKey((k) => k + 1);
        // 等 React 把 frameOn 类落到候选帧上再撤内联，避免一帧闪空
        settleTimer.current = window.setTimeout(() => {
          const el = imgRefs.current[target];
          if (el) {
            el.style.opacity = "";
            el.style.transition = "";
            el.style.zIndex = "";
          }
        }, 90);
      }, 250);
    } else if (img) {
      img.style.transition = "opacity 200ms cubic-bezier(0.22, 0.61, 0.21, 1)";
      img.style.opacity = "0";
      settleTimer.current = window.setTimeout(clearCandidateInline, 230);
    }
  };

  return (
    <Link
      href={href}
      ref={rootRef}
      className={styles.card}
      style={
        { "--dwell": `${DWELL}ms`, "--fade": `${FADE}ms` } as React.CSSProperties
      }
      onPointerEnter={() => {
        // 触屏的 tap 也会触发 pointerenter，悬停暂停只给细指针
        if (window.matchMedia("(hover: hover)").matches) setHovered(true);
      }}
      onPointerLeave={() => setHovered(false)}
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
                imgRefs.current[i] = el;
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
