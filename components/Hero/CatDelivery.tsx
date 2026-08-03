"use client";

import Image from "next/image";
import { CAT_GEOM, HERO_TIMINGS, rackGeometry } from "@/lib/heroConfig";
import type { ContentRect } from "./useVideoRect";
import styles from "./CatDelivery.module.css";

interface Props {
  rect: ContentRect; // 视频内容矩形（px，相对舞台）
  /** 送货拍（beats.delivery）就为 true —— 早早挂载只为了给 148KB 的图片
   *  留出解码时间，此时不播动画、也不可见。 */
  mounted: boolean;
  /** false → true 时播一次进场→推到位→退场，此后不再响应 */
  play: boolean;
}

/**
 * 猫把最后一张画芯推到墙边。
 *
 * 为什么在定格后才播放：视频里那只猫全程在动（走进 → 抓画 → 坐下），
 * 若插画猫同时出场，画面里会有两只黑白猫。所以货先行、猫后到 ——
 * 前 5 张自己滑进来（推手在画外，悬念更足），猫留到定格后登场，
 * 成为 payoff 而不是铺垫。但图片本身提前挂载（见 mounted）：
 * 这是全分支里唯一没有铺垫时间的资产，不能等到播放那一刻才发首个请求。
 *
 * 猫的行进与 rack 第 6 张的滑入是两条独立动画，靠同一份几何
 * (CAT_GEOM，heroConfig 单一来源) 与同一个时长 (HERO_TIMINGS.catPushMs)
 * 对齐，看起来就是猫在推它。
 */
export default function CatDelivery({ rect, mounted, play }: Props) {
  if (!mounted) return null;

  // 猫立在墙脚线上（与画芯架同一条地面）
  const catW = rect.width * CAT_GEOM.widthRatio;
  const { miniLeft } = rackGeometry(rect);
  // 猫的前爪在图片里的位置，把爪子送到第 6 张（index 5）的左缘上 ——
  // 第 6 张因叠压天然停在画芯架起点右侧 2.9 个画芯宽处，不是起点本身。
  const catEndX = miniLeft(5) - catW * CAT_GEOM.pawX;
  // 入场起点：与 ArtworkSwitcher 算第 6 张画芯起跑点用的是同一个
  // CAT_GEOM.startX，两边才不会各算各的（见 heroConfig.ts 顶部注释）。
  const catStartX = catW * CAT_GEOM.startX;
  const vars = {
    "--cat-w": `${catW}px`,
    "--cat-bottom-y": `${rect.top + rect.height * 0.708}px`,
    "--cat-end-x": `${catEndX}px`,
    "--cat-start-x": `${catStartX}px`,
    "--cat-dur": `${HERO_TIMINGS.catPushMs}ms`,
  } as React.CSSProperties;

  return (
    <div
      className={`${styles.cat} ${play ? styles.catPlay : styles.catIdle}`}
      style={vars}
      aria-hidden
    >
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
