"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import styles from "./PortalCard.module.css";

/*
 * Landing 的产品门户卡：整卡可点，负责「勾」而不是「讲」。
 * 媒体两种活法：
 *  - cycle：进入视口后照片轮替交叉溶解（默默演示产品的多面）
 *  - video：细指针悬停播放 / 触屏进入视口播放（猫屋宣传片试看）
 */

type Media =
  | { kind: "cycle"; images: { src: string; alt: string }[] }
  | { kind: "video"; src: string; poster: string; alt: string };

export default function PortalCard({
  href,
  kicker,
  title,
  blurb,
  cta,
  tag,
  media,
}: {
  href: string;
  kicker: string;
  title: string;
  blurb: string;
  cta: string;
  tag?: string;
  media: Media;
}) {
  const rootRef = useRef<HTMLAnchorElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [frame, setFrame] = useState(0);
  const [inView, setInView] = useState(false);

  // 视口检测（轮替与触屏视频共用）
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // 照片轮替
  useEffect(() => {
    if (media.kind !== "cycle" || !inView) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(
      () => setFrame((f) => (f + 1) % media.images.length),
      2800,
    );
    return () => clearInterval(t);
  }, [media, inView]);

  // 视频：hover 播放（细指针）/ 视口播放（触屏）
  useEffect(() => {
    if (media.kind !== "video") return;
    const v = videoRef.current;
    if (!v) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const fine = window.matchMedia("(hover: hover)").matches;
    if (fine) return; // 细指针交给 onPointerEnter/Leave
    if (inView) v.play().catch(() => {});
    else v.pause();
  }, [media, inView]);

  const hoverPlay = (on: boolean) => {
    if (media.kind !== "video") return;
    if (!window.matchMedia("(hover: hover)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const v = videoRef.current;
    if (!v) return;
    if (on) v.play().catch(() => {});
    else v.pause();
  };

  return (
    <Link
      href={href}
      ref={rootRef}
      className={styles.card}
      onPointerEnter={() => hoverPlay(true)}
      onPointerLeave={() => hoverPlay(false)}
    >
      <div className={styles.media}>
        {media.kind === "cycle" ? (
          media.images.map((im, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={im.src}
              src={im.src}
              alt={i === 0 ? im.alt : ""}
              aria-hidden={i !== 0}
              loading="lazy"
              className={i === frame ? styles.frameOn : styles.frameOff}
            />
          ))
        ) : (
          <video
            ref={videoRef}
            src={media.src}
            poster={media.poster}
            muted
            loop
            playsInline
            preload="none"
            aria-label={media.alt}
          />
        )}
        {tag && <span className={styles.tag}>{tag}</span>}
        {media.kind === "cycle" && (
          <span className={styles.dots} aria-hidden>
            {media.images.map((im, i) => (
              <i key={im.src} className={i === frame ? styles.dotOn : ""} />
            ))}
          </span>
        )}
      </div>

      <div className={styles.body}>
        <p className={styles.kicker}>{kicker}</p>
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.blurb}>{blurb}</p>
        <span className={styles.cta}>
          {cta}
          <svg viewBox="0 0 20 20" width="16" aria-hidden>
            <path
              d="M4 10h11m-4.5-4.5L15 10l-4.5 4.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>
    </Link>
  );
}
