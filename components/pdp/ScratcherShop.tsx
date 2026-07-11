"use client";

import { useState } from "react";
import { ARTWORKS } from "@/lib/heroConfig";
import { useCart } from "@/components/CartContext";
import pdp from "./pdp.module.css";
import styles from "./ScratcherShop.module.css";

/*
 * 抓板详情页主舞台：左图库（主图 + 缩略）+ 右粘性购买面板（画芯选择）。
 * 移动端追加底部粘性购买条，与面板共享同一份选中态。
 */

const PHOTOS = [
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

export default function ScratcherShop() {
  const [photo, setPhoto] = useState(0);
  const [pick, setPick] = useState(0);
  const { add } = useCart();
  const art = ARTWORKS[pick];

  const addToBasket = () =>
    add("canvas-scratcher", `Canvas Scratcher · ${art.title}`);

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
              Arrives wearing
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
                  onClick={() => setPick(i)}
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
                AU$89 <em>free AU shipping</em>
              </span>
              <button className="btnPrimary" onClick={addToBasket}>
                Add to basket
              </button>
            </div>

            <ul className={pdp.panelNotes}>
              <li>Solid pine frame, weighted easel — leans, never topples.</li>
              <li>Loop-pile canvas: satisfying shred, zero confetti.</li>
              <li>Prints swap in minutes — new drops each season.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* ——— 移动端粘性购买条 ——— */}
      <div className={pdp.stickyBar}>
        <span className={pdp.stickyInfo}>
          <span className={pdp.stickyName}>Scratcher · {art.title}</span>
          <span className={pdp.stickyPrice}>AU$89 · free shipping</span>
        </span>
        <button className={pdp.stickyBtn} onClick={addToBasket}>
          Add to basket
        </button>
      </div>
    </section>
  );
}
