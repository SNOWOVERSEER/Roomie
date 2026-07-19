"use client";

import { useEffect, useMemo, useState } from "react";
import { ARTWORKS } from "@/lib/heroConfig";
import { formatCents } from "@/lib/catalog";
import { useCart } from "@/components/CartContext";
import PartnerMark from "@/components/PartnerMark";
import WaitlistForm from "@/components/WaitlistForm";
import pdp from "./pdp.module.css";
import styles from "./ScratcherShop.module.css";

/*
 * 抓板详情页主舞台：左图库（主图 + 缩略）+ 右粘性购买面板。
 *
 * 联动是单向的（用户明确要求）：右侧选画芯 → 主图跳到该画芯的
 * 白底框内预览；左侧手动翻图只改 photo，不回写画芯选择。
 *
 * 库存/在售状态（R1，全部来自服务端查表）：
 *   - 退役画（seasonal drop 下场）：选择器与框内预览彻底不渲染
 *   - 售罄画：显示但角标 out，不可加购
 *   - 低库存（<10）：角标 low
 *   - 画框售罄：Frame+print 规格整体禁用（Print only 不受影响）
 *   - 商品下架：对应规格禁用；两规格全下架 → 面板换候补表单
 */

/** 每幅画的状态（ARTWORKS 序，服务端查 stock_items 算好传入） */
export interface PrintState {
  retired: boolean;
  soldOut: boolean;
  low: boolean;
}

export interface ShopState {
  fullPriceCents: number;
  printPriceCents: number;
  /** products.available=false（商品级下架） */
  fullOffSale: boolean;
  printOffSale: boolean;
  frameSoldOut: boolean;
  frameLow: boolean;
  prints: PrintState[];
}

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

type Format = "full" | "print";

export default function ScratcherShop({ state }: { state: ShopState }) {
  const { add } = useCart();

  /* 退役画从购买动线消失：可见画列表（保留原始 ARTWORKS 索引） */
  const visible = useMemo(
    () =>
      ARTWORKS.map((art, i) => ({ art, i, st: state.prints[i] })).filter(
        (p) => p.st && !p.st.retired,
      ),
    [state.prints],
  );

  /* 图库 = 可见画的框内预览 + 生活方式实拍（photo 索引基于此数组） */
  const photos = useMemo(
    () => [
      ...visible.map((p) => ({
        src: `/c01/print-0${p.i + 1}.webp`,
        alt: `The ${p.art.title} print in the pine frame, on white`,
      })),
      ...LIFE_PHOTOS,
    ],
    [visible],
  );

  const anyPrintBuyable = visible.some((p) => !p.st.soldOut);
  const fullBuyable = !state.fullOffSale && !state.frameSoldOut && anyPrintBuyable;
  const printBuyable = !state.printOffSale && anyPrintBuyable;
  /* 两个规格都下架 = 主动收摊 → 候补表单（售罄但在售 ≠ 下架，不收邮箱） */
  const offSaleEntirely = state.fullOffSale && state.printOffSale;

  const [pick, setPick] = useState(() => {
    const first = visible.find((p) => !p.st.soldOut) ?? visible[0];
    return first ? first.i : 0;
  });
  const [photo, setPhoto] = useState(() =>
    Math.max(0, visible.findIndex((p) => p.i === pick)),
  );
  const [format, setFormat] = useState<Format>(() =>
    fullBuyable || !printBuyable ? "full" : "print",
  );

  useEffect(() => {
    const apply = () => {
      if (window.location.hash === "#prints" && !state.printOffSale) {
        setFormat("print");
      }
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, [state.printOffSale]);

  const art = ARTWORKS[pick];
  const pickState = state.prints[pick];
  const price = (f: Format) =>
    formatCents(f === "full" ? state.fullPriceCents : state.printPriceCents);

  const formatDisabled: Record<Format, boolean> = {
    full: state.fullOffSale || state.frameSoldOut || !anyPrintBuyable,
    print: state.printOffSale || !anyPrintBuyable,
  };
  const cantAdd =
    formatDisabled[format] || !pickState || pickState.soldOut;

  /* 低库存交给角标表达（与画芯选择器同一套视觉语言），副文案只解释禁用 */
  const fullNote = state.fullOffSale
    ? "not available right now"
    : state.frameSoldOut
      ? "frames are out of stock"
      : "the full piece, ready to lean";
  const printNote = state.printOffSale
    ? "not sold on its own right now"
    : "a fresh canvas for your frame";

  const choosePrint = (artIdx: number) => {
    setPick(artIdx);
    const vi = visible.findIndex((p) => p.i === artIdx);
    if (vi >= 0) setPhoto(vi); // 单向联动：主图跟到该画芯的框内预览
  };

  const addToBasket = () => {
    if (cantAdd) return;
    if (format === "full") add("canvas-scratcher", art.title);
    else
      add("canvas-print", art.title, {
        note: "print only, your frame stays on the wall",
      });
  };

  const NOTES: Record<Format, string[]> = {
    full: [
      "Solid pine frame, weighted easel. Leans, never topples.",
      "Loop-pile canvas: satisfying shred, zero confetti.",
      "Prints swap in minutes, new drops each season.",
      "430 × 630 × 35 mm. Poster presence, bookshelf footprint.",
    ],
    print: [
      "The print alone. Your frame stays on the wall.",
      "Same loop-pile weave, fresh territory.",
      "Fits every Canvas Series frame, Scratcher and House.",
    ],
  };

  return (
    <section className={pdp.stage}>
      <div className={`shell ${pdp.stageGrid}`}>
        {/* ——— 图库 ——— */}
        <div className={styles.gallery}>
          <div className={styles.main}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={photo}
              src={photos[photo]?.src ?? LIFE_PHOTOS[0].src}
              alt={photos[photo]?.alt ?? LIFE_PHOTOS[0].alt}
            />
            <span className={styles.counterTag} aria-hidden>
              {String(photo + 1).padStart(2, "0")} /{" "}
              {String(photos.length).padStart(2, "0")}
            </span>
          </div>
          <div
            className={styles.thumbs}
            role="tablist"
            aria-label="Product photos"
          >
            {photos.map((p, i) => (
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
            <p className={pdp.panelKicker}>
              {offSaleEntirely
                ? "Off the bench for now"
                : "Shipping now · Australia-wide"}
            </p>
            <h1 className={pdp.panelTitle}>The Canvas Scratcher</h1>
            <p className={pdp.panelTagline}>
              Looks like a print. Scratches like a post. Leans on any wall the
              living happens against.
            </p>

            {offSaleEntirely ? (
              <>
                <p className={styles.offSaleBlurb}>
                  The Scratcher is off the shelf while we catch up. Leave your
                  email and you&rsquo;ll hear first when it&rsquo;s back.
                </p>
                <WaitlistForm
                  handle="canvas-scratcher"
                  title="The Canvas Scratcher"
                />
              </>
            ) : (
              <>
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
                    aria-disabled={formatDisabled.full}
                    className={`${styles.format} ${format === "full" ? styles.formatOn : ""} ${formatDisabled.full ? styles.formatOff : ""}`}
                    onClick={() =>
                      !formatDisabled.full && setFormat("full")
                    }
                  >
                    <strong>Frame + print</strong>
                    <span>{fullNote}</span>
                    <em>{price("full")}</em>
                    {!state.fullOffSale && state.frameSoldOut ? (
                      <i className={styles.pickTag} aria-hidden>
                        out
                      </i>
                    ) : !state.fullOffSale && state.frameLow ? (
                      <i
                        className={`${styles.pickTag} ${styles.pickTagLow}`}
                        aria-hidden
                      >
                        low
                      </i>
                    ) : null}
                  </button>
                  <button
                    role="radio"
                    aria-checked={format === "print"}
                    aria-disabled={formatDisabled.print}
                    className={`${styles.format} ${format === "print" ? styles.formatOn : ""} ${formatDisabled.print ? styles.formatOff : ""}`}
                    onClick={() =>
                      !formatDisabled.print && setFormat("print")
                    }
                  >
                    <strong>Print only</strong>
                    <span>{printNote}</span>
                    <em>{price("print")}</em>
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
                  {visible.map((p) => (
                    <button
                      key={p.art.id}
                      role="radio"
                      aria-checked={pick === p.i}
                      aria-label={`${p.art.title}${p.st.soldOut ? ", out of stock" : p.st.low ? ", low stock" : ""}`}
                      className={`${styles.pick} ${pick === p.i ? styles.picked : ""} ${p.st.soldOut ? styles.pickOut : ""}`}
                      onClick={() => choosePrint(p.i)}
                      title={p.art.title}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/hero/art/flat-0${p.i + 1}.png`} alt="" />
                      {p.st.soldOut ? (
                        <i className={styles.pickTag} aria-hidden>
                          out
                        </i>
                      ) : p.st.low ? (
                        <i
                          className={`${styles.pickTag} ${styles.pickTagLow}`}
                          aria-hidden
                        >
                          low
                        </i>
                      ) : null}
                    </button>
                  ))}
                </div>
                <p className={styles.pickName} key={`n-${art.id}`}>
                  {art.title}
                  {pickState?.soldOut && (
                    <em className={styles.pickNameNote}> · out of stock</em>
                  )}
                  {!pickState?.soldOut && pickState?.low && (
                    <em className={styles.pickNameNote}> · low stock</em>
                  )}
                </p>
                <p className={styles.pickCaption} key={`c-${art.id}`}>
                  {art.caption}
                </p>

                <div className={pdp.buyRow}>
                  <span className={pdp.price}>
                    {price(format)} <em>free shipping over AU$188</em>
                  </span>
                  <button
                    className="btnPrimary"
                    onClick={addToBasket}
                    disabled={cantAdd}
                  >
                    {cantAdd ? "Sold out" : "Add to basket"}
                  </button>
                </div>

                <ul className={pdp.panelNotes}>
                  {NOTES[format].map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </>
            )}

            {/* 品牌铭牌：面板收尾一行，在售/下架都在（口径 HANDOVER §1.1） */}
            <p className={pdp.provenance}>
              <span>Made with our partner workshop</span>
              <PartnerMark className={pdp.provenanceMark} />
            </p>
          </div>
        </div>
      </div>

      {/* ——— 移动端粘性购买条 ——— */}
      {!offSaleEntirely && (
        <div className={pdp.stickyBar}>
          <span className={pdp.stickyInfo}>
            <span className={pdp.stickyName}>
              {format === "full" ? "Scratcher" : "Print"} · {art.title}
            </span>
            <span className={pdp.stickyPrice}>
              {cantAdd ? "sold out right now" : `${price(format)} · ships AU-wide`}
            </span>
          </span>
          <button
            className={pdp.stickyBtn}
            onClick={addToBasket}
            disabled={cantAdd}
          >
            {cantAdd ? "Sold out" : "Add to basket"}
          </button>
        </div>
      )}
    </section>
  );
}
