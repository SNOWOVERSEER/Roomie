"use client";

import Image from "next/image";
import { HERO_TIMINGS, rackGeometry } from "@/lib/heroConfig";
import type { ContentRect } from "./useVideoRect";
import styles from "./CatDelivery.module.css";

interface Props {
  rect: ContentRect; // 视频内容矩形（px，相对舞台）
  /** false → true 时播一次进场→推到位→退场，此后不再响应 */
  play: boolean;
}

/**
 * 猫把最后一张画芯推到墙边。
 *
 * 为什么在定格后才出现：视频里那只猫全程在动（走进 → 抓画 → 坐下），
 * 若插画猫同时出场，画面里会有两只黑白猫。所以货先行、猫后到 ——
 * 前 5 张自己滑进来（推手在画外，悬念更足），猫留到定格后登场，
 * 成为 payoff 而不是铺垫。
 *
 * 猫的行进与 rack 第 6 张的滑入是两条独立动画，靠同一个时长
 * (HERO_TIMINGS.catPushMs) 对齐，看起来就是猫在推它。
 */
export default function CatDelivery({ rect, play }: Props) {
  if (!play) return null;

  // 猫立在墙脚线上（与画芯架同一条地面），身宽约画面的 14%
  const catW = rect.width * 0.14;
  const { miniLeft } = rackGeometry(rect);
  // 猫的前爪在图片约 82% 宽处，把爪子送到第 6 张（index 5）的左缘上 ——
  // 第 6 张因叠压天然停在画芯架起点右侧 2.9 个画芯宽处，不是起点本身。
  const catEndX = miniLeft(5) - catW * 0.82;
  const vars = {
    "--cat-w": `${catW}px`,
    "--cat-bottom-y": `${rect.top + rect.height * 0.708}px`,
    "--cat-end-x": `${catEndX}px`,
    "--cat-dur": `${HERO_TIMINGS.catPushMs}ms`,
  } as React.CSSProperties;

  return (
    <div className={styles.cat} style={vars} aria-hidden>
      <Image
        src="/interaction/roomie-pushing-cat.png"
        alt=""
        width={720}
        height={405}
        priority={false}
      />
    </div>
  );
}
