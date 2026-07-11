"use client";

import { useEffect, useState } from "react";
import { ARTWORKS } from "@/lib/heroConfig";
import { useCart } from "@/components/CartContext";
import pdp from "./pdp.module.css";
import styles from "./ScratcherShop.module.css";

/*
 * 抓板详情页主舞台：左图库（主图 + 缩略）+ 右粘性购买面板。
 *
 * 联动是单向的（用户明确要求）：右侧选画芯 → 主图跳到该画芯的
 * 白底框内预览（图库前 6 张，索引与 ARTWORKS 对齐）；左侧手动
 * 翻图只改 photo，不回写画芯选择。
 *
 * 规格两档：整件（框+画）/ 单画芯（换画补充装，单独购买）。
 * landing 的「Swap-in prints」入口带 #prints，直达单画芯规格。
 */

const PRINT_PHOTOS = ARTWORKS.map((a, i) => ({
  src: `/c01/print-0${i + 1}.webp`,
  alt: `The ${a.title} print in the pine frame, on white`,
}));

const LIFE_PHOTOS = [
  {
    src: "/c01/scratcher-solo.webp",
    alt: "The Canvas Scratcher leaning against a wall on a herringbone floor",
  },
  {
    src: "/c01/gallery-scratch.webp",
    alt: "An orange cat stretched tall, scratching the framed canvas",
  },
  {
    src: "/c01/gallery-swap.webp",
    alt: "Spare canvases lying flat on a rug beside the framed scratcher",
  },
  {
    src: "/c01/gallery-window.webp",
    alt: "The scratcher leaning by a window, cat resting beside it",
  },
  {
    src: "/c01/gallery-moonlit.webp",
    alt: "A white cat inspecting the Wave Light print",
  },
  {
    src: "/c01/gallery-kitchen.webp",
    alt: "The scratcher at home in a busy kitchen",
  },
];

const PHOTOS = [...PRINT_PHOTOS, ...LIFE_PHOTOS];

type Format = "full" | "print";

/* TODO(Shopify): 单画芯 AU$35 为占位价，待用户确认 */
const PRICE: Record<Format, string> = { full: "AU$89", print: "AU$35" };

const NOTES: Record<Format, string[]> = {
  full: [
    "Solid pine frame, weighted easel — leans, never topples.",
    "Loop-pile canvas: satisfying shred, zero confetti.",
    "Prints swap in minutes — new drops each season.",
  ],
  print: [
    "The print alone — your frame stays on the wall.",
    "Same loop-pile weave, fresh territory.",
    "Fits every Canvas Series frame, Scratcher and House.",
  ],
};

export default function ScratcherShop() {
  const [photo, setPhoto] = useState(0);
  const [pick, setPick] = useState(0);
  const [format, setFormat] = useState<Format>("full");
  const { add } = useCart();
  const art = ARTWORKS[pick];

  useEffect(() => {
    const apply = () => {
      if (window.location.hash === "#prints") setFormat("print");
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);

  const choosePrint = (i: number) => {
    setPick(i);
    setPhoto(i); // 单向联动：主图跟到该画芯的框内预览
  };

  const addToBasket = () =>
    format === "full"
      ? add("canvas-scratcher", `Canvas Scratcher · ${art.title}`)
      : add("canvas-print", `Swap-in Print · ${art.title}`, {
          note: "print only — your frame stays on the wall",
        });

  return (
    <section className={pdp.stage}>
      <div className={`shell ${pdp.stageGrid}`}>
        {/* ——— 图库 ——— */}
        <div className={styles.gallery}>
          <div className={styles.main}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={photo}
              src={PHOTOS[photo].src}
              alt={PHOTOS[photo].alt}
            />
            <span className={styles.counterTag} aria-hidden>
              {String(photo + 1).padStart(2, "0")} /{" "}
              {String(PHOTOS.length).padStart(2, "0")}
            </span>
          </div>
          <div
            className={styles.thumbs}
            role="tablist"
            aria-label="Product photos"
          >
            {PHOTOS.map((p, i) => (
              <button
                key={p.src}
                role="tab"
                aria-selected={photo === i}
                aria-label={`Photo ${i + 1}`}
                className={photo === i ? styles.thumbOn : ""}
                onClick={() => setPhoto(i)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.src} alt="" loading="lazy" />
              </button>
            ))}
          </div>
        </div>

        {/* ——— 购买面板 ——— */}
        <div className={pdp.panelCol}>
          <div className={pdp.panel}>
            <p className={pdp.panelKicker}>Shipping now · free AU shipping</p>
            <h1 className={pdp.panelTitle}>The Canvas Scratcher</h1>
            <p className={pdp.panelTagline}>
              Looks like a print. Scratches like a post. Leans on any wall the
              living happens against.
            </p>

            <p className={pdp.panelLabel} id="prints">
              Format
            </p>
            <div
              className={styles.formats}
              role="radiogroup"
              aria-label="Choose a format"
            >
              <button
                role="radio"
                aria-checked={format === "full"}
                className={`${styles.format} ${format === "full" ? styles.formatOn : ""}`}
                onClick={() => setFormat("full")}
              >
                <strong>Frame + print</strong>
                <span>the full piece, ready to lean</span>
                <em>AU$89</em>
              </button>
              <button
                role="radio"
                aria-checked={format === "print"}
                className={`${styles.format} ${format === "print" ? styles.formatOn : ""}`}
                onClick={() => setFormat("print")}
              >
                <strong>Print only</strong>
                <span>a fresh canvas for your frame</span>
                <em>AU$35</em>
              </button>
            </div>

            <p className={pdp.panelLabel}>
              {format === "full" ? "Arrives wearing" : "Choose your print"}
            </p>
            <div
              className={styles.picks}
              role="radiogroup"
              aria-label="Choose a print"
            >
              {ARTWORKS.map((a, i) => (
                <button
                  key={a.id}
                  role="radio"
                  aria-checked={pick === i}
                  className={`${styles.pick} ${pick === i ? styles.picked : ""}`}
                  onClick={() => choosePrint(i)}
                  title={a.title}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/hero/art/flat-0${i + 1}.png`} alt={a.title} />
                </button>
              ))}
            </div>
            <p className={styles.pickName} key={`n-${art.id}`}>
              {art.title}
            </p>
            <p className={styles.pickCaption} key={`c-${art.id}`}>
              {art.caption}
            </p>

            <div className={pdp.buyRow}>
              <span className={pdp.price}>
                {PRICE[format]} <em>free AU shipping</em>
              </span>
              <button className="btnPrimary" onClick={addToBasket}>
                Add to basket
              </button>
            </div>

            <ul className={pdp.panelNotes}>
              {NOTES[format].map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* ——— 移动端粘性购买条 ——— */}
      <div className={pdp.stickyBar}>
        <span className={pdp.stickyInfo}>
          <span className={pdp.stickyName}>
            {format === "full" ? "Scratcher" : "Print"} · {art.title}
          </span>
          <span className={pdp.stickyPrice}>
            {PRICE[format]} · free shipping
          </span>
        </span>
        <button className={pdp.stickyBtn} onClick={addToBasket}>
          Add to basket
        </button>
      </div>
    </section>
  );
}
