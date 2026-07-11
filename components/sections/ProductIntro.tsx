import Reveal from "@/components/Reveal";
import styles from "./ProductIntro.module.css";

const POINTS = [
  {
    n: "01",
    title: "A print on the outside",
    body: "Poplar frame, gallery-tight canvas. Lean it on a wall like any art you actually chose — no beige carpet tower in sight.",
  },
  {
    n: "02",
    title: "A scratcher underneath",
    body: "The canvas is a tight scratch-weave that satisfies the daily shred — without the confetti of cardboard crumbs.",
  },
  {
    n: "03",
    title: "Leans steady, scratches hard",
    body: "A weighted base keeps the frame planted mid-scratch. No wobble, no crash, no startled cat.",
  },
  {
    n: "04",
    title: "Swap the print, keep the frame",
    body: "When a canvas is well and truly loved, slide in a fresh print. New art for you, new territory for them.",
  },
];

export default function ProductIntro() {
  return (
    <section className={styles.section} id="scratcher">
      <div className={`shell ${styles.grid}`}>
        <Reveal className={styles.mediaCol} as="figure">
          <div className={styles.photo}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/story/still-scratch.jpg"
              alt="The cat stretched tall, scratching the framed canvas"
              loading="lazy"
            />
            <figcaption className={styles.tag}>
              real cat · real scratches · frame 5.2s of our film
            </figcaption>
          </div>
        </Reveal>

        <div className={styles.textCol}>
          <Reveal>
            <p className={styles.eyebrow}>The Canvas Scratcher</p>
            <h2 className={styles.heading}>
              Looks like a print.
              <br />
              Scratches like a post.
            </h2>
            <p className={styles.lede}>
              Cats scratch where the living happens — so we made the scratcher
              something your living room would want anyway.
            </p>
          </Reveal>

          <ol className={styles.points}>
            {POINTS.map((p, i) => (
              <Reveal key={p.n} as="li" delay={i * 90}>
                <span className={styles.num}>{p.n}</span>
                <div>
                  <h3>{p.title}</h3>
                  <p>{p.body}</p>
                </div>
              </Reveal>
            ))}
          </ol>

          <Reveal delay={120}>
            <div className={styles.printsRow}>
              {[1, 2, 3, 4].map((i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={`/hero/art/flat-0${i}.png`}
                  alt=""
                  aria-hidden
                  loading="lazy"
                />
              ))}
              <p>
                Four prints at launch —{" "}
                <em>Sunny Field · Moonlit Night · Wave Light · Forest Light</em>{" "}
                — try them all in the frame up top.
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
