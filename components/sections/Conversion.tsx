"use client";

import { useState } from "react";
import Reveal from "@/components/Reveal";
import { ARTWORKS } from "@/lib/heroConfig";
import { useCart } from "@/components/CartContext";
import styles from "./Conversion.module.css";

export default function Conversion() {
  const [pick, setPick] = useState(0);
  const { add } = useCart();
  const art = ARTWORKS[pick];

  return (
    <section className={styles.section}>
      <div className={`shell ${styles.inner}`}>
        <Reveal className={styles.card}>
          <div className={styles.preview}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={art.id}
              src={`/hero/art/flat-0${pick + 1}.png`}
              alt={`${art.title} print`}
              className={styles.previewArt}
            />
          </div>

          <div className={styles.config}>
            <h2>Bring one home</h2>
            <p className={styles.sub}>
              The Canvas Scratcher, framed and ready to lean. Pick the print it
              arrives wearing:
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

            <p className={styles.pickName} key={art.id}>
              {art.title}
            </p>

            <div className={styles.buyRow}>
              <span className={styles.price}>
                AU$89 <em>· free AU shipping</em>
              </span>
              <button
                className="btnPrimary"
                onClick={() =>
                  add("canvas-scratcher", `Canvas Scratcher · ${art.title}`)
                }
              >
                Add to basket
              </button>
            </div>
          </div>
        </Reveal>

        <Reveal className={styles.shopAll} delay={130}>
          <p className={styles.shopLine}>
            Beds, bowls, burrows — the whole roomful is coming.
          </p>
          <a className={styles.ghostCream} href="#collection">
            Browse the collection
            <svg viewBox="0 0 20 20" width="16" aria-hidden>
              <path
                d="M4 10h11m-4.5-4.5L15 10l-4.5 4.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
        </Reveal>
      </div>
    </section>
  );
}
