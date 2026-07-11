"use client";

import { useState } from "react";
import Reveal from "@/components/Reveal";
import styles from "./BrandStory.module.css";

export default function BrandStory() {
  const [revealed, setRevealed] = useState(false);

  return (
    <section className={styles.section} id="story">
      <div className={`shell ${styles.grid}`}>
        <div className={styles.textCol}>
          <Reveal>
            <p className={styles.eyebrow}>Why Roomie</p>
            <h2 className={styles.heading}>
              Pet stuff shouldn&rsquo;t look like pet stuff.
            </h2>
            <p className={styles.body}>
              Your cat lives in the living room, not in a pet aisle. So the
              things they scratch, nap on and eat from should hold their own
              next to the sofa you saved up for. That&rsquo;s the whole idea —
              furniture you share, from a small pet-furniture studio in
              Melbourne.
            </p>
            <p className={styles.motto}>Pet things, part of home.</p>
          </Reveal>
        </div>

        <Reveal className={styles.mediaCol} delay={110}>
          <button
            type="button"
            className={styles.swap}
            onPointerEnter={() => setRevealed(true)}
            onPointerLeave={() => setRevealed(false)}
            onClick={() => setRevealed((r) => !r)}
            aria-pressed={revealed}
            aria-label="Reveal the cat in the room"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/story/room-empty.jpg"
              alt="A styled living room with a framed canvas leaning on the wall"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/story/room-cat.jpg"
              alt="The same living room — a cat sits proudly beside the canvas"
              className={`${styles.catLayer} ${revealed ? styles.show : ""}`}
            />
            <span className={`${styles.hint} ${revealed ? styles.hintOff : ""}`}>
              this room has a scratcher in it — <em>hover to meet the owner</em>
            </span>
          </button>
        </Reveal>
      </div>
    </section>
  );
}
