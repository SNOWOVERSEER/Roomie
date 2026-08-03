"use client";

import styles from "./SkipDial.module.css";
import PawMark from "./PawMark";

interface Props {
  /** buffering = 视频还没来（时长未知）；running = 演出进行中（时长确定） */
  mode: "buffering" | "running";
  /** running 模式下环走完一圈的毫秒数 */
  durationMs: number;
  onSkip: () => void;
}

const R = 20; // 环半径
const C = 2 * Math.PI * R; // 周长，用作 dasharray

/**
 * 首屏右下角的爪印进度环，一个控件两件事：
 *   环 = 可预测性。有终点的进度告诉用户「再等 3 秒就好」——
 *        无限转圈说的是「天知道要多久」，那是促使人划走的东西。
 *   hover = 控制权。不想等的人不必等。
 * 移动端不挂载（见 Hero.tsx）—— staticMode 本来就没有可跳过的等待。
 *
 * 底盘做成不透明的奶油圆片而不是半透明毛玻璃：它压在一张繁忙的实拍
 * 照片上，半透明会和墙面糊成一团脏，爪印直接看不见。实底 + 落地阴影
 * 读作「放在场景里的一枚小物件」，而不是浮在画面上的控件。
 */
export default function SkipDial({ mode, durationMs, onSkip }: Props) {
  return (
    <button
      type="button"
      className={styles.dial}
      onClick={onSkip}
      aria-label="Skip the intro and go straight to swapping prints"
    >
      <svg viewBox="0 0 50 50" className={styles.ring} aria-hidden>
        <circle className={styles.track} cx="25" cy="25" r={R} />
        <circle
          className={mode === "running" ? styles.arcRun : styles.arcWait}
          cx="25"
          cy="25"
          r={R}
          style={
            {
              // stroke-dasharray 交给各自的 CSS 规则（.arcRun / .arcWait）——
              // 内联样式的优先级高于任何普通规则，之前写在这里会永远盖过
              // .arcWait 的 `18 200`，buffering 态被迫渲成实心整环转圈，
              // 读出来正好是"已完成 100%"，与本意相反。
              "--dur": `${durationMs}ms`,
              "--circ": C,
            } as React.CSSProperties
          }
        />
      </svg>

      {/* 静息态：爪印 */}
      <PawMark className={styles.paw} />

      {/* hover 态：换成 Skip */}
      <span className={styles.label} aria-hidden>
        Skip
      </span>
    </button>
  );
}
