import Link from "next/link";
import Reveal from "@/components/Reveal";
import styles from "./pdp.module.css";

/** 详情页底部的「另一件」——把系列的两件互相勾起来 */
export default function CrossSell({
  href,
  kicker,
  title,
  blurb,
  image,
  imageAlt,
  cta,
  tone = "night",
}: {
  href: string;
  kicker: string;
  title: string;
  blurb: string;
  image: string;
  imageAlt: string;
  cta: string;
  tone?: "night" | "day";
}) {
  return (
    <section className={styles.cross}>
      <div className="shell">
        <Reveal>
          <Link
            href={href}
            className={`${styles.crossCard} ${tone === "day" ? styles.crossDay : ""}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt={imageAlt} loading="lazy" />
            <span>
              <span className={styles.crossKicker}>{kicker}</span>
              <span className={styles.crossTitle}>{title}</span>
              <span className={styles.crossBlurb}>{blurb}</span>
            </span>
            <span className={styles.crossGo}>
              {cta}
              <svg viewBox="0 0 20 20" width="15" aria-hidden>
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
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
