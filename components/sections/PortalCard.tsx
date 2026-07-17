"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import styles from "./PortalCard.module.css";

/*
 * Landing 的产品门户卡：整卡可点，负责「勾」而不是「讲」。
 * 媒体两种活法：
 *  - cycle：进入视口后照片轮替。自动挡 = 交叉溶解 + 全帧同相位慢漂移，
 *    活动圆点是随停留时长填充的进度胶囊；手动挡 = 连续可逆拖拽——
 *    当前帧与候选帧首尾相接并 1:1 跟手，过阈值（或甩动够快）落定切换，
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
    settling: false,
    x0: 0,
    y0: 0,
    dx: 0,
    width: 420,
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

  // 每次重新进入视口都从一枚全新的时间胶囊开始，和自动切图计时同相位。
  useEffect(() => {
    if (inView) setCycleKey((key) => key + 1);
  }, [inView]);

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
     拖动中直接写 DOM，让当前帧与候选帧首尾相接、同步位移，不走 React 渲染；
     每一像素都跟手，松手后两帧一起落定或一起回位。 */

  const imageAt = useCallback(
    (index: number) => (index >= 0 ? imgRefs.current[index] : null),
    [],
  );

  const clearImageInline = useCallback((img: HTMLImageElement | null) => {
    if (!img) return;
    img.style.opacity = "";
    img.style.transition = "";
    img.style.transform = "";
    img.style.zIndex = "";
    img.style.willChange = "";
    img.style.animation = "";
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (
      media.kind !== "cycle" ||
      !e.isPrimary ||
      swipe.current.settling
    )
      return;
    window.clearTimeout(settleTimer.current);
    const w = mediaRef.current?.clientWidth ?? 420;
    swipe.current = {
      on: true,
      dragging: false,
      settling: false,
      x0: e.clientX,
      y0: e.clientY,
      dx: 0,
      width: w,
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
      } else if (Math.abs(dy) > 16) {
        s.on = false; // 纵向意图：让给页面滚动
        return;
      } else {
        return;
      }
    }
    e.preventDefault();
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
      clearImageInline(imageAt(s.candidate));
      s.candidate = cand !== frame ? cand : -1;
      const img = imageAt(s.candidate);
      if (img) {
        img.style.transition = "none";
        img.style.opacity = "1";
        img.style.zIndex = "3";
        img.style.willChange = "transform";
        img.style.animation = "none";
      }
    }

    const current = imageAt(frame);
    const img = imageAt(s.candidate);
    if (!current || !img) return;

    current.style.transition = "none";
    current.style.zIndex = "2";
    current.style.willChange = "transform";
    current.style.animation = "none";

    // 图片与指针 1:1 跟手；拖过一整张后才加入轻微阻尼，避免露出空白。
    const distance = Math.abs(dx);
    const shift =
      distance <= s.width
        ? dx
        : Math.sign(dx) * (s.width + (distance - s.width) * 0.14);
    const candidateOffset = dir === 1 ? s.width : -s.width;
    current.style.transform = `translate3d(${shift}px, 0, 0)`;
    img.style.transform = `translate3d(${shift + candidateOffset}px, 0, 0)`;
  };

  const endSwipe = (allowCommit: boolean) => {
    const s = swipe.current;
    if (!s.on) return;
    s.on = false;
    if (!s.dragging) return;
    s.dragging = false;
    s.consumed = Math.abs(s.dx) > 12;

    const current = imageAt(frame);
    const img = imageAt(s.candidate);
    if (!current || !img) {
      clearImageInline(current);
      clearImageInline(img);
      return;
    }

    const progress = Math.min(1, Math.abs(s.dx) / s.width);
    const flung = Math.abs(s.dx) > 24 && Math.abs(s.vx) > 0.42;
    const commit = allowCommit && (progress >= 0.24 || flung);
    const dir: 1 | -1 = s.dx < 0 ? 1 : -1;
    const candidateOffset = dir === 1 ? s.width : -s.width;
    const duration = commit ? 360 : 300;
    const transition = `transform ${duration}ms cubic-bezier(0.22, 0.72, 0.2, 1)`;

    s.settling = true;
    current.style.transition = transition;
    img.style.transition = transition;

    if (commit) {
      const target = s.candidate;
      const exitX = dir === 1 ? -s.width : s.width;
      window.requestAnimationFrame(() => {
        current.style.transform = `translate3d(${exitX}px, 0, 0)`;
        img.style.transform = "translate3d(0, 0, 0)";
      });
      settleTimer.current = window.setTimeout(() => {
        setFrame(target);
        setCycleKey((k) => k + 1);
        settleTimer.current = window.setTimeout(() => {
          clearImageInline(current);
          clearImageInline(imageAt(target));
          s.candidate = -1;
          s.settling = false;
        }, 70);
      }, duration + 30);
    } else {
      window.requestAnimationFrame(() => {
        current.style.transform = "translate3d(0, 0, 0)";
        img.style.transform = `translate3d(${candidateOffset}px, 0, 0)`;
      });
      settleTimer.current = window.setTimeout(() => {
        clearImageInline(current);
        clearImageInline(img);
        s.candidate = -1;
        s.settling = false;
      }, duration + 30);
    }
  };

  // 时间胶囊走满后也走同一条双帧滑轨，不再只切 React 索引。
  useEffect(() => {
    if (media.kind !== "cycle" || !inView || hovered) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = window.setTimeout(() => {
      const s = swipe.current;
      if (s.dragging || s.settling) return;

      const target = nextLoaded(frame, 1);
      if (target === frame) {
        setCycleKey((key) => key + 1);
        return;
      }

      const current = imageAt(frame);
      const incoming = imageAt(target);
      if (!current || !incoming) return;

      const width = mediaRef.current?.clientWidth ?? 420;
      const duration = 680;
      const transition = `transform ${duration}ms cubic-bezier(0.22, 0.72, 0.2, 1)`;

      s.settling = true;
      s.candidate = target;
      s.width = width;

      current.style.animation = "none";
      current.style.transition = "none";
      current.style.transform = "translate3d(0, 0, 0)";
      current.style.zIndex = "2";
      current.style.willChange = "transform";

      incoming.style.animation = "none";
      incoming.style.transition = "none";
      incoming.style.transform = `translate3d(${width}px, 0, 0)`;
      incoming.style.opacity = "1";
      incoming.style.zIndex = "3";
      incoming.style.willChange = "transform";

      // 先提交首尾相接的起点，再在下一帧启动完整滑入。
      void incoming.offsetWidth;
      current.style.transition = transition;
      incoming.style.transition = transition;
      window.requestAnimationFrame(() => {
        current.style.transform = `translate3d(${-width}px, 0, 0)`;
        incoming.style.transform = "translate3d(0, 0, 0)";
      });

      settleTimer.current = window.setTimeout(() => {
        setFrame(target);
        setCycleKey((key) => key + 1);
        settleTimer.current = window.setTimeout(() => {
          clearImageInline(current);
          clearImageInline(imageAt(target));
          s.candidate = -1;
          s.settling = false;
        }, 70);
      }, duration + 30);
    }, DWELL);

    return () => window.clearTimeout(timer);
  }, [
    clearImageInline,
    cycleKey,
    frame,
    hovered,
    imageAt,
    inView,
    media.kind,
    nextLoaded,
  ]);

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
      onPointerLeave={() => {
        if (!window.matchMedia("(hover: hover)").matches) return;
        setHovered(false);
        setCycleKey((key) => key + 1);
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={() => endSwipe(true)}
      onPointerCancel={() => endSwipe(false)}
      onDragStart={(e) => e.preventDefault()}
      onClickCapture={(e) => {
        if (swipe.current.consumed) {
          e.preventDefault();
          e.stopPropagation();
          swipe.current.consumed = false;
        }
      }}
    >
      <div
        className={`${styles.media} ${
          media.kind === "cycle" ? styles.cycleMedia : ""
        }`}
        ref={mediaRef}
      >
        {media.kind === "cycle" ? (
          media.images.map((im, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={im.src}
              src={im.src}
              alt={i === frame ? im.alt : ""}
              aria-hidden={i !== frame}
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
            className={`${styles.dots} ${
              hovered || !inView ? styles.dotsPaused : ""
            }`}
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
