"use client";

import { useCallback, useState } from "react";
import styles from "./SmartImg.module.css";

/*
 * 图片加载 UX：占位微光垫底，解码完成后淡入落定。
 * 关键取舍 —— 不加包装层，渲染出来仍是一枚 <img>：
 *   - 既有的后代选择器（.featuredCard img 等）与布局完全不受影响；
 *   - 微光是 img 自身的 background，盒子由调用方的 aspect-ratio/height 撑起，
 *     像素未到时背景可见，到位后被照片盖住；
 *   - 无 JS / 水合前：opacity 始终为 1，图片按浏览器原生行为渐进呈现，
 *     不会出现"永远空着"的骨架。
 * 缓存命中（complete）跳过动画，回头页不闪。
 * 注意：调用方若自己给 img 加 animation 会与淡入互斥 —— 轮播类组件
 * （PortalCard/Filmstrip 交叉溶解）自管加载态，不要用这个组件。
 */
export default function SmartImg({
  className = "",
  onLoad,
  onError,
  alt = "",
  ...rest
}: React.ImgHTMLAttributes<HTMLImageElement>) {
  const [phase, setPhase] = useState<"wait" | "in" | "instant">("wait");

  // ref callback 在 commit 时机执行：水合前就已完成的图（load 事件错过了）
  // 用 complete 补判，直接呈现
  const attach = useCallback((el: HTMLImageElement | null) => {
    if (el && el.complete && el.naturalWidth > 0) {
      setPhase((p) => (p === "wait" ? "instant" : p));
    }
  }, []);

  const phaseClass =
    phase === "in" ? styles.in : phase === "instant" ? styles.instant : "";

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={attach}
      alt={alt}
      decoding="async"
      {...rest}
      className={`${styles.img} ${phaseClass} ${className}`}
      onLoad={(e) => {
        setPhase((p) => (p === "wait" ? "in" : p));
        onLoad?.(e);
      }}
      onError={(e) => {
        setPhase("instant");
        onError?.(e);
      }}
    />
  );
}
