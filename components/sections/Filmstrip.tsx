"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import SmartImg from "@/components/SmartImg";
import styles from "./Filmstrip.module.css";

export interface Slide {
  src: string;
  alt: string;
  caption: string;
  /** 原图宽高 —— 用 aspect-ratio 定宽，滚动条不跳动 */
  w: number;
  h: number;
}

/**
 * 横向胶片画廊：原生滚动 + snap，鼠标可拖拽，两端有渐隐与箭头。
 * 供应商实拍素材的展示容器 —— 图不定宽（保持各自比例），像一条接触印样。
 */
export default function Filmstrip({
  slides,
  ariaLabel,
}: {
  slides: Slide[];
  ariaLabel: string;
}) {
  const trackRef = useRef<HTMLUListElement>(null);
  const raf = useRef(0);
  const glide = useRef(0);
  const drag = useRef({
    on: false,
    startX: 0,
    startLeft: 0,
    moved: false,
    // 惯性滑行用：最近一次位移的瞬时速度（px/ms，指数平滑）
    lastX: 0,
    lastT: 0,
    vx: 0,
  });

  const cancelGlide = useCallback(() => {
    cancelAnimationFrame(glide.current);
  }, []);

  /* 松手后的自由惯性：摩擦衰减，停在任意位置（不吸附整张）——
     手感对齐触屏原生动量滚动 */
  const startGlide = useCallback((v0: number) => {
    cancelAnimationFrame(glide.current);
    let v = v0; // px/ms，正 = 手往右挥（内容回退）
    let last = performance.now();
    const step = (t: number) => {
      const el = trackRef.current;
      if (!el) return;
      const dt = Math.min(t - last, 48);
      last = t;
      el.scrollLeft -= v * dt;
      v *= Math.pow(0.94, dt / 16.7);
      const max = el.scrollWidth - el.clientWidth;
      const atEdge =
        (el.scrollLeft <= 0 && v > 0) || (el.scrollLeft >= max && v < 0);
      if (!atEdge && Math.abs(v) > 0.02) {
        glide.current = requestAnimationFrame(step);
      }
    };
    glide.current = requestAnimationFrame(step);
  }, []);
  const [index, setIndex] = useState(0);
  const [ends, setEnds] = useState({ start: true, end: false });

  const measure = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const x = el.scrollLeft;
    const max = el.scrollWidth - el.clientWidth;
    const kids = Array.from(el.children) as HTMLElement[];
    // offsetLeft 含轨道左侧 gutter；snap 对齐点 = offsetLeft - gutter，
    // 全部换算成相对第一张的坐标，索引与 scrollTo 才互相一致
    const base = kids[0]?.offsetLeft ?? 0;
    let i = 0;
    for (let k = 0; k < kids.length; k++) {
      if (kids[k].offsetLeft - base <= x + 40) i = k;
    }
    setIndex(i);
    setEnds({ start: x < 8, end: x >= max - 8 });
  }, []);

  useEffect(() => {
    measure();
    const el = trackRef.current;
    if (!el) return;
    const onScroll = () => {
      cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(measure);
    };
    // 用户直接滚动（触屏/滚轮）时中断惯性，避免两股力打架
    const onUserScroll = () => cancelGlide();
    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("wheel", onUserScroll, { passive: true });
    el.addEventListener("touchstart", onUserScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("wheel", onUserScroll);
      el.removeEventListener("touchstart", onUserScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf.current);
      cancelAnimationFrame(glide.current);
    };
  }, [measure, cancelGlide]);

  const goTo = (i: number) => {
    const el = trackRef.current;
    if (!el) return;
    cancelGlide();
    const kids = Array.from(el.children) as HTMLElement[];
    const k = Math.min(Math.max(i, 0), kids.length - 1);
    const base = kids[0]?.offsetLeft ?? 0;
    el.scrollTo({ left: kids[k].offsetLeft - base, behavior: "smooth" });
  };

  /* 鼠标拖拽（触屏走原生滚动）。拖过阈值后吞掉点击。 */
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    const el = trackRef.current;
    if (!el) return;
    cancelGlide(); // 滑行中再抓住 = 即停（真实胶片手感）
    drag.current = {
      on: true,
      startX: e.clientX,
      startLeft: el.scrollLeft,
      moved: false,
      lastX: e.clientX,
      lastT: e.timeStamp,
      vx: 0,
    };
    el.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const el = trackRef.current;
    if (!el || !drag.current.on) return;
    const d = drag.current;
    const dx = e.clientX - d.startX;
    if (Math.abs(dx) > 6) d.moved = true;
    el.scrollLeft = d.startLeft - dx;
    const dt = e.timeStamp - d.lastT;
    if (dt > 0) {
      // 指数平滑的瞬时速度，松手时用它决定滑行距离
      d.vx = 0.75 * d.vx + 0.25 * ((e.clientX - d.lastX) / dt);
      d.lastX = e.clientX;
      d.lastT = e.timeStamp;
    }
  };
  const endDrag = (e: React.PointerEvent) => {
    if (!drag.current.on) return;
    drag.current.on = false;
    trackRef.current?.releasePointerCapture(e.pointerId);
    // 松手不死停也不吸附：带出速度就自由滑行、摩擦收尾（像拨动实物胶片）
    if (drag.current.moved && Math.abs(drag.current.vx) > 0.05) {
      startGlide(drag.current.vx);
    }
  };
  const onClickCapture = (e: React.MouseEvent) => {
    if (drag.current.moved) {
      e.preventDefault();
      e.stopPropagation();
      drag.current.moved = false;
    }
  };

  return (
    <div
      className={styles.wrap}
      role="group"
      aria-roledescription="carousel"
      aria-label={ariaLabel}
    >
      <ul
        ref={trackRef}
        className={styles.track}
        tabIndex={0}
        aria-label={`${ariaLabel}. Use the arrow keys to browse.`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={onClickCapture}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") {
            e.preventDefault();
            goTo(index + 1);
          } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            goTo(index - 1);
          } else if (e.key === "Home") {
            e.preventDefault();
            goTo(0);
          } else if (e.key === "End") {
            e.preventDefault();
            goTo(slides.length - 1);
          }
        }}
      >
        {slides.map((s, i) => (
          <li
            key={s.src}
            className={styles.slide}
            aria-label={`${i + 1} of ${slides.length}`}
          >
            <figure>
              <SmartImg
                src={s.src}
                alt={s.alt}
                loading={i === 0 ? "eager" : "lazy"}
                draggable={false}
                style={{ aspectRatio: `${s.w} / ${s.h}` }}
              />
              <figcaption>
                <span className={styles.slideNo}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                {s.caption}
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>

      <div className={styles.rail}>
        <span className={styles.counter} aria-hidden>
          {String(index + 1).padStart(2, "0")}
          <em> / {String(slides.length).padStart(2, "0")}</em>
        </span>
        <div className={styles.arrows}>
          <button
            type="button"
            onClick={() => goTo(index - 1)}
            disabled={ends.start}
            aria-label="Previous photo"
          >
            <svg viewBox="0 0 20 20" width="17" aria-hidden>
              <path
                d="M12.5 4 6.5 10l6 6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => goTo(index + 1)}
            disabled={ends.end}
            aria-label="Next photo"
          >
            <svg viewBox="0 0 20 20" width="17" aria-hidden>
              <path
                d="m7.5 4 6 6-6 6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
