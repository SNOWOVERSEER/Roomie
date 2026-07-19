"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./Reveal.module.css";

interface Props {
  children: React.ReactNode;
  /** 错峰延迟（ms），同组元素相差 80–120ms */
  delay?: number;
  className?: string;
  as?: "div" | "section" | "li" | "figure" | "p";
}

/** 滚动进入视口时柔和上浮浮现（一次性）。reduced-motion 下直接呈现。 */
export default function Reveal({
  children,
  delay = 0,
  className = "",
  as: Tag = "div",
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      /* 视口下方 10% 就预热触发：快滑（fling）停下时内容已在浮现途中，
         大间距 + 未进场内容叠出"整屏空白"的窗口才不会出现 */
      { threshold: 0.06, rootMargin: "0px 0px 10% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as React.Ref<never>}
      className={`${styles.reveal} ${seen ? styles.in : ""} ${className}`}
      style={{ transitionDelay: seen ? `${delay}ms` : "0ms" }}
    >
      {children}
    </Tag>
  );
}
