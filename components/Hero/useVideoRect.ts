"use client";

import { useEffect, useState, type RefObject } from "react";
import { COVER_FOCUS, VIDEO_DIMS } from "@/lib/heroConfig";

export interface ContentRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * object-fit: cover 下，视频实际内容矩形会溢出舞台容器。
 * 画框覆盖层必须定位在「视频内容坐标系」里，而不是容器坐标系，
 * 否则视口比例一变就错位。这里复算 cover 的数学，随容器尺寸更新。
 */
export function useVideoRect(
  stageRef: RefObject<HTMLElement | null>,
): ContentRect | null {
  const [rect, setRect] = useState<ContentRect | null>(null);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const update = () => {
      const cw = el.clientWidth;
      const ch = el.clientHeight;
      const scale = Math.max(cw / VIDEO_DIMS.width, ch / VIDEO_DIMS.height);
      const w = VIDEO_DIMS.width * scale;
      const h = VIDEO_DIMS.height * scale;
      // 必须与媒体元素的 object-position（COVER_FOCUS）一致，否则窄视口错位
      setRect({
        left: (cw - w) * COVER_FOCUS.x,
        top: (ch - h) * COVER_FOCUS.y,
        width: w,
        height: h,
      });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [stageRef]);

  return rect;
}
