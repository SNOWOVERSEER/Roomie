"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ARTWORKS, FRAME_RECT, HERO_COPY } from "@/lib/heroConfig";
import type { ContentRect } from "./useVideoRect";
import styles from "./ArtworkSwitcher.module.css";

interface Props {
  rect: ContentRect; // 视频内容矩形（px，相对舞台）
  active: boolean; // 定格后才可交互
  revealed: boolean; // 吊牌/画芯架错峰浮现的时机
}

const SWAP_MS = 300;

export default function ArtworkSwitcher({ rect, active, revealed }: Props) {
  // index/prev/dir 单一原子状态，避免连点竞态与 updater 副作用
  const [pair, setPair] = useState<{
    index: number;
    prev: number | null;
    dir: 1 | -1;
  }>({ index: 0, prev: null, dir: 1 });
  const [touched, setTouched] = useState(false);
  const lock = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchX = useRef<number | null>(null);
  const { index, prev: prevIndex, dir } = pair;

  const swapTo = useCallback(
    (target: number | ((i: number) => number), d?: 1 | -1) => {
      if (lock.current) return;
      lock.current = true;
      setTouched(true);
      setPair((p) => {
        const raw = typeof target === "function" ? target(p.index) : target;
        const next = ((raw % ARTWORKS.length) + ARTWORKS.length) % ARTWORKS.length;
        if (next === p.index) return p;
        return { index: next, prev: p.index, dir: d ?? (next > p.index ? 1 : -1) };
      });
      timer.current = setTimeout(() => {
        setPair((p) => ({ ...p, prev: null }));
        lock.current = false;
      }, SWAP_MS + 40);
    },
    [],
  );

  const swapNext = useCallback(
    (d: 1 | -1) => swapTo((i) => i + d, d),
    [swapTo],
  );

  // 键盘 ← →
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA") return;
      if (window.scrollY > window.innerHeight * 0.6) return; // 离开首屏则不劫持
      if (e.key === "ArrowRight") swapNext(1);
      if (e.key === "ArrowLeft") swapNext(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, swapNext]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const px = (n: number) => `${n}px`;
  const fLeft = rect.left + (rect.width * FRAME_RECT.left) / 100;
  const fTop = rect.top + (rect.height * FRAME_RECT.top) / 100;
  const fW = (rect.width * FRAME_RECT.width) / 100;
  const fH = (rect.height * FRAME_RECT.height) / 100;

  // 画芯架：立在大画框左侧地板上（墙脚线 ≈ 内容高的 70.6%）
  const miniW = Math.max(36, rect.width * 0.034);
  const rackVars = {
    "--mini-w": px(miniW),
    "--rack-left": px(rect.left + rect.width * 0.129),
    "--rack-bottom-y": px(rect.top + rect.height * 0.708),
    "--rack-m-left": px(fLeft + 2),
    "--rack-m-top": px(fTop + fH + rect.height * 0.03),
  } as React.CSSProperties;

  const art = ARTWORKS[index];

  return (
    <>
      {/* 画框图层：始终挂载所有画作（提前解码，杜绝闪白），定格前整层隐身 */}
      <div
        className={`${styles.frame} ${active ? styles.frameActive : ""}`}
        style={{ left: px(fLeft), top: px(fTop), width: px(fW), height: px(fH) }}
        onClick={() => active && swapNext(1)}
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          touchX.current = null;
          if (Math.abs(dx) > 36) swapNext(dx < 0 ? 1 : -1);
        }}
        aria-hidden={!active}
      >
        {ARTWORKS.map((a, i) => {
          const isCurrent = i === index;
          const isPrev = i === prevIndex;
          const entering = isCurrent && prevIndex !== null;
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={a.id}
              src={a.src}
              alt={isCurrent ? a.alt : ""}
              draggable={false}
              className={[
                styles.art,
                isCurrent ? styles.artCurrent : "",
                isPrev ? styles.artPrev : "",
                entering ? (dir === 1 ? styles.artInR : styles.artInL) : "",
              ].join(" ")}
            />
          );
        })}
      </div>

      {/* 备用画芯：靠墙立在地板上，点哪张就换哪张。
          当前在框里的那张翻过去露出画布背面。 */}
      <div
        className={`${styles.rack} ${revealed ? styles.rackOn : ""}`}
        style={rackVars}
        role="radiogroup"
        aria-label="Spare prints. Pick one for the frame"
      >
        {ARTWORKS.map((a, i) => {
          const isFramed = i === index;
          return (
            <button
              key={a.id}
              className={`${styles.mini} ${isFramed ? styles.miniFramed : ""}`}
              style={{ "--i": i } as React.CSSProperties}
              onClick={() => !isFramed && swapTo(i)}
              role="radio"
              aria-checked={isFramed}
              aria-label={
                isFramed
                  ? `${a.title} — currently framed`
                  : `Put ${a.title} in the frame`
              }
              tabIndex={active ? 0 : -1}
            >
              <span className={styles.miniInner}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/hero/art/flat-0${i + 1}.png`}
                  alt=""
                  draggable={false}
                  className={styles.miniFace}
                />
                {/* 画布背面：木框十字撑条 */}
                <span className={styles.miniBack} aria-hidden>
                  <span />
                  <span />
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* 纸质吊牌：桌面端挂在画框左上角；移动端落在画框脚下右侧。
          换画时轻摆一下、联动换字 */}
      <div
        className={`${styles.tag} ${revealed ? styles.tagOn : ""}`}
        style={
          {
            "--pin-left": px(rect.left + (rect.width * FRAME_RECT.pinLeft) / 100),
            "--pin-top": px(rect.top + (rect.height * FRAME_RECT.pinTop) / 100),
            // 画芯层叠斜靠（重叠 42%）：总宽 = miniW × (1 + (N-1)×0.58)
            "--foot-left": px(
              fLeft + miniW * (1 + (ARTWORKS.length - 1) * 0.58) + 16,
            ),
            "--foot-top": px(fTop + fH + rect.height * 0.03 + 6),
          } as React.CSSProperties
        }
        aria-live="polite"
      >
        <svg className={styles.tagString} viewBox="0 0 24 26" aria-hidden>
          <path
            d="M22 2 C 14 6, 8 12, 5 24"
            fill="none"
            stroke="rgba(94,62,24,0.55)"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <circle cx="22" cy="2" r="2.4" fill="rgba(94,62,24,0.65)" />
        </svg>
        <div className={styles.tagCard} key={art.id}>
          <span className={styles.tagNo}>
            №{String(index + 1).padStart(2, "0")}
            <em> / {String(ARTWORKS.length).padStart(2, "0")}</em>
          </span>
          <span className={styles.tagTitle}>{art.title}</span>
          <span className={styles.tagCaption}>
            {touched ? art.caption : HERO_COPY.tagHint}
          </span>
        </div>
      </div>
    </>
  );
}
