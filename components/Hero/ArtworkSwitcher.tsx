"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ARTWORKS,
  CAT_GEOM,
  FRAME_RECT,
  HERO_COPY,
  HERO_TIMINGS,
  rackGeometry,
} from "@/lib/heroConfig";
import type { ContentRect } from "./useVideoRect";
import styles from "./ArtworkSwitcher.module.css";

interface Props {
  rect: ContentRect; // 视频内容矩形（px，相对舞台）
  active: boolean; // 定格后才可交互
  revealed: boolean; // 吊牌/画芯架错峰浮现的时机
  /** 大图与画芯缩略图共用的放行闸：视频路径在起播(playing)时才 true；
   *  静态路径（staticMode）没有视频可等，挂载时就立即 true。 */
  loadArt: boolean;
  /** 送货中：画芯已在场但还没落定 —— 去饱和、不可点 */
  delivering: boolean;
  /** 猫正在推第 6 张进场（只在视频路径 + 猫存在时为 true，见 Hero.tsx
   *  catRuns）—— 由 Hero 派生传入而非本组件内部算，否则 staticMode
   *  走到静态定格的分支（自动播放被拒/视频出错/8s 兜底/来不及加载就
   *  被跳过）也会播这段推入动画，而那些分支根本没有猫。 */
  pushing: boolean;
}

const SWAP_MS = 300;

export default function ArtworkSwitcher({
  rect,
  active,
  revealed,
  loadArt,
  delivering,
  pushing,
}: Props) {
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
  const { miniW, rackLeft, miniLeft } = rackGeometry(rect);
  // 第 6 张的起跑点必须落在猫前爪的起跑点上，否则画会跑在猫前面
  // （开发中真出过：画在 +44px 起跑、爪子在 −97px，一路追不上）。
  // 用 CatDelivery 算爪子终点同一套 CAT_GEOM，两边不再各算各的。
  const catW = rect.width * CAT_GEOM.widthRatio;
  const pushFromX = (CAT_GEOM.startX + CAT_GEOM.pawX) * catW - miniLeft(5);
  const rackVars = {
    "--mini-w": px(miniW),
    "--rack-left": px(rackLeft),
    "--rack-bottom-y": px(rect.top + rect.height * 0.708),
    "--rack-m-left": px(fLeft + 2),
    "--rack-m-top": px(fTop + fH + rect.height * 0.03),
    // 第 6 张由猫推进来，时长必须与 CatDelivery 一致 —— 单一来源
    "--push-dur": `${HERO_TIMINGS.catPushMs}ms`,
    "--push-from-x": px(pushFromX),
  } as React.CSSProperties;

  const art = ARTWORKS[index];

  return (
    <>
      {/* 画框图层：loadArt 放行后挂载全部画作（提前解码，杜绝闪白），定格前整层隐身 */}
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
        {loadArt &&
          ARTWORKS.map((a, i) => {
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

      {/* 送货中的小转圈，叠在那排还没落定的画芯上。
          只活到猫出现为止：猫一到就该由猫来说明「最后一张在路上」，
          再留着转圈等于两个东西在说同一件事。语言与右下角的进度环
          同源（奶油实底 + 橙色弧），只是这里时长未知，所以是不定长
          转圈而不是有终点的进度。 */}
      {delivering && !revealed && !pushing && (
        <div
          className={styles.rackSpinner}
          style={
            {
              // 居中于「此刻在场的那 5 张」——第 6 张要等猫送来，
              // 把它算进跨度会让转圈整体右移 0.29 个画芯宽。
              left: px((rackLeft + miniLeft(4) + miniW) / 2),
              // 画芯高 = miniW × 10/7，架顶在 rack-bottom-y − 1.46×miniW，
              // 所以竖直中心在 rack-bottom-y − 0.746×miniW
              top: px(rect.top + rect.height * 0.708 - miniW * 0.746),
              // 和那 5 张一起从舞台左缘滑进来：起点对齐它们的起点
              // （−1.4×miniW，见 miniSlideIn），扣掉自身居中的半宽
              "--spin-from-x": px(
                -1.4 * miniW - ((rackLeft + miniLeft(4) + miniW) / 2 - 15),
              ),
            } as React.CSSProperties
          }
          aria-hidden
        >
          <svg viewBox="0 0 30 30">
            <circle className={styles.spinTrack} cx="15" cy="15" r="11" />
            <circle className={styles.spinArc} cx="15" cy="15" r="11" />
          </svg>
        </div>
      )}

      {/* 备用画芯：靠墙立在地板上，点哪张就换哪张。
          当前在框里的那张翻过去露出画布背面。 */}
      <div
        className={[
          styles.rack,
          delivering && !revealed ? styles.rackDelivering : "",
          revealed ? styles.rackOn : "",
          pushing ? styles.rackPushing : "",
        ].join(" ")}
        style={rackVars}
        role="radiogroup"
        aria-label="Spare prints. Pick one for the frame"
      >
        {loadArt &&
          ARTWORKS.map((a, i) => {
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
                    src={`/hero/art/flat-0${i + 1}-s.jpg`}
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
