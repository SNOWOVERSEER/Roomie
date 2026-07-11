/*
 * 首屏剧场的全部可调参数集中在这里（画框坐标 / 画作 / 时间轴 / 文案）。
 * 调整体验不需要碰组件逻辑。
 */

/** 视频原始尺寸 — object-fit:cover 的内容矩形按此换算 */
export const VIDEO_DIMS = { width: 1664, height: 1248 };

/**
 * cover 裁切的焦点（object-position）。x=0.38 保证窄视口横向裁切时
 * 画框 + 猫始终在画面内。改这里时 CSS 与坐标换算会一起变。
 */
export const COVER_FOCUS = { x: 0.38, y: 0.5 };

/**
 * 画框内画作区域在落幅帧中的外接矩形（相对视频画面的百分比）。
 * 由 tools/make_artworks.py 用颜色键蒙版自动测量并写入 frame-rect.json，
 * 重跑脚本即自动同步，无需手改。
 */
import frameRect from "./frame-rect.json";

export const FRAME_RECT = frameRect as {
  left: number;
  top: number;
  width: number;
  height: number;
  /** 吊牌钉点：木框左上角木条上（管线自动测量导出） */
  pinLeft: number;
  pinTop: number;
};

export interface Artwork {
  id: string;
  src: string;
  title: string;
  alt: string;
  caption: string;
}

/**
 * ARTWORKS[0] 必须与视频落幅帧画框内的画一致（当前为《晴野》）。
 * 每张图都是「末帧画框区域的完整合成图」：透视、光照、画布纹理
 * 已离线烘焙（脚本：scratchpad/make_artworks.py），浏览器端只做交叉溶解。
 * 上新画作 = 跑一次脚本 + 在这里加一项。
 */
export const ARTWORKS: Artwork[] = [
  {
    id: "art-01",
    src: "/hero/art/art-01.png",
    title: "Sunny Field",
    alt: "Naive painting of a little white house under a red sun, deep blue sky over a golden field",
    caption: "The one it arrives with — a little house, a big noon.",
  },
  {
    id: "art-02",
    src: "/hero/art/art-02.png",
    title: "Moonlit Night",
    alt: "Naive painting of an orange cat watching a full moon beside a tiny lit house",
    caption: "For quiet evenings and 3am zoomies.",
  },
  {
    id: "art-03",
    src: "/hero/art/art-03.png",
    title: "Wave Light",
    alt: "Naive painting of a little boat on a deep blue sea under a red sun",
    caption: "A small boat on a big nap-time sea.",
  },
  {
    id: "art-04",
    src: "/hero/art/art-04.png",
    title: "Forest Light",
    alt: "Naive painting of navy pine trees and a tiny white house against a sunset-orange sky",
    caption: "Sunset pines, for the wild ones.",
  },
];

/** 文字与视频叙事咬合的时间轴（秒）。onEnded 后的编排见 freeze 部分（毫秒） */
export const HERO_TIMINGS = {
  title: 0.6, // 空镜稳定后，标题淡入
  subtitle: 2.6, // 猫走进画面时，副标题跟进
  // 定格后的错峰浮现（相对 onEnded 的毫秒数）
  freeze: {
    settle: 0, // 文字轻轻上移收拢
    cta: 680, // 停一拍 → CTA 上浮
    plaque: 1500, // 再停一拍 → 换画铭牌最后浮现
    scrollCue: 2300, // 页脚滚动提示，最轻的一笔
  },
};

export const HERO_COPY = {
  title: ["The art your cat", "can scratch"],
  subtitle:
    "A framed canvas for your wall that's secretly a scratcher — pet things that feel like part of home.",
  cta: "Shop the Canvas Scratcher", // TODO 最终文案待定
  ctaNote: "AU$89 · free AU shipping · swappable prints", // TODO 价格占位
  tagHint: "spare prints by the wall — tap one to swap",
};
