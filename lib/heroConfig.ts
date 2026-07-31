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

/**
 * 画芯架的几何。CatDelivery 要知道第 6 张停在哪才能把猫送到位，
 * ArtworkSwitcher 要按同一套数摆放它们 —— 两边各算各的就会像
 * 之前那样猫推空。叠压步长 0.58 来自 .mini + .mini 的 -42% margin。
 */
export function rackGeometry(rect: { left: number; width: number }) {
  const miniW = Math.max(36, rect.width * 0.034);
  const rackLeft = rect.left + rect.width * 0.129;
  return {
    miniW,
    rackLeft,
    /** 第 i 张画芯的左缘（相对舞台，px） */
    miniLeft: (i: number) => rackLeft + i * 0.58 * miniW,
  };
}

export interface Artwork {
  id: string;
  src: string;
  title: string;
  alt: string;
  caption: string;
}

/**
 * ARTWORKS[0] 必须与视频落幅帧画框内的画一致（当前为《晴野》Sunny Field）。
 * 每张图都是「末帧画框区域的完整合成图」：透视、光照、画布纹理
 * 已离线烘焙（tools/make_artworks.py），浏览器端只做交叉溶解。
 * 平面稿 flat-0X 由 tools/extract_flats.py 从产品图提取（真实画作）。
 * 上新画作 = 放入源图 → 两个脚本各跑一次 → 跑 tools/compress_hero_media.sh
 * 转 JPEG → 在这里加一项。
 */
export const ARTWORKS: Artwork[] = [
  {
    id: "art-01",
    src: "/hero/art/art-01.jpg",
    title: "Sunny Field",
    alt: "A little white house under a red sun, deep blue sky over a golden field",
    caption: "The one it arrives with: a little house, a big noon.",
  },
  {
    id: "art-02",
    src: "/hero/art/art-02.jpg",
    title: "Wave Light",
    alt: "Sun glitter scattered across blue afternoon waves",
    caption: "The sea, mid-sparkle.",
  },
  {
    id: "art-03",
    src: "/hero/art/art-03.jpg",
    title: "Leaf Boat",
    alt: "A tiny boat adrift on a deep indigo sea, seen from above",
    caption: "One small boat, a very big blue.",
  },
  {
    id: "art-04",
    src: "/hero/art/art-04.jpg",
    title: "Forest Light",
    alt: "Sunlight pooling through green summer leaves",
    caption: "Sun through the canopy, for the wild ones.",
  },
  {
    id: "art-05",
    src: "/hero/art/art-05.jpg",
    title: "Window Glow",
    alt: "Late-afternoon window light and palm shadows in warm orange",
    caption: "Golden hour, no window required.",
  },
  {
    id: "art-06",
    src: "/hero/art/art-06.jpg",
    title: "Red Fruit",
    alt: "A deck chair perched on an apple the size of a hill",
    caption: "Summer, on a very big apple.",
  },
];

/** 文字与视频叙事咬合的时间轴（秒）。onEnded 后的编排见 freeze 部分（毫秒） */
export const HERO_TIMINGS = {
  title: 0.6, // 空镜稳定后，标题淡入
  subtitle: 2.6, // 猫走进画面时，副标题跟进
  /**
   * 画芯开始从舞台左缘滑入（视频秒）。定格前 3 秒就让用户看见
   * 「有东西正在被推进来」—— 换画 feature 原先要到第 11.5 秒才露面，
   * 这中间没有任何理由让人留下。
   */
  delivery: 7.0,
  /**
   * 页面时钟兜底（毫秒）——— 与上面两拍是「先到者生效」的关系。
   * beats 原本只绑 video.currentTime，视频不起播就恒为 0，
   * 于是加载期间首屏连标题都没有。这两个值保证文案不等视频。
   */
  fallback: { title: 400, subtitle: 2000 },
  /** 迟迟不 canplay 就放弃视频走静态定格（毫秒），否则弱网永远卡在 poster */
  loadTimeout: 8000,
  /**
   * SkipDial 进度环的长度（毫秒）。环必须在 SkipDial 卸载前走完，
   * 而卸载发生在 steps.plaque = 视频时长(实测 10017ms) + freeze.plaque。
   * 取 10800 而不是刚好 11017：宁可环满了停一瞬再落定，也不能被砍断 ——
   * 一个走不到终点的进度环否定了它自己存在的理由。
   * 改 freeze.plaque 时这里要跟着改，并保住这个余量。
   */
  dialMs: 10800,
  // 定格后的错峰浮现（相对 onEnded 的毫秒数）
  freeze: {
    settle: 0, // 文字轻轻上移收拢
    cta: 550, // CTA 上浮 —— 与猫推货并行，不排队
    plaque: 1000, // 猫推到位 → 画芯落定 + 铭牌浮现 + 可交互
    scrollCue: 1500, // 页脚滚动提示，最轻的一笔
  },
  /** 猫从画外推到位的时长（毫秒）。必须与 freeze.plaque 对齐 ——
   *  猫推到的那一刻正是画芯落定的那一刻。 */
  catPushMs: 1000,
};

export const HERO_COPY = {
  title: ["The art your cat", "can scratch"],
  subtitle:
    "A framed canvas for your wall that's secretly a scratcher. Pet things that feel like part of home.",
  cta: "Shop the Canvas Scratcher", // TODO 最终文案待定
  /** 价格由页面以流式节点单独送达（见 app/page.tsx ScratcherPriceNote），
   *  未到 / DB 不可达时整段价格连同分隔点一起缺席（绝不显示 AU$0）。 */
  ctaNoteSuffix: "swappable prints · ships AU-wide",
  tagHint: "spare prints by the wall, tap one to swap",
};
