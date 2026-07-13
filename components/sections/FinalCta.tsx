import Link from "next/link";
import { formatCents, getCatalogMap } from "@/lib/catalog";
import Reveal from "@/components/Reveal";
import styles from "./FinalCta.module.css";

/* 收束段：夜色一拍，把两条购买动线最后各递一次。下单动作都在详情页。 */
export default async function FinalCta() {
  const catalog = await getCatalogMap();
  const scratcherPrice = formatCents(
    catalog.get("canvas-scratcher")?.priceCents ?? 0,
  );
  return (
    <section className={styles.section}>
      <div className={`shell ${styles.inner}`}>
        <Reveal>
          <h2 className={styles.heading}>Take one home</h2>
          <p className={styles.sub}>
            The print that scratches, or the den that hides. Both wear the
            same swap-able canvas.
          </p>
        </Reveal>
        <Reveal delay={110} className={styles.row}>
          <Link className="btnPrimary" href="/scratcher">
            The Scratcher · {scratcherPrice}
          </Link>
          <Link className={styles.ghostCream} href="/house">
            The House · join the waitlist
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
          </Link>
        </Reveal>
        <Reveal delay={190}>
          <p className={styles.fine}>
            Ships AU-wide, free over AU$188 · prints swap in minutes · more
            pieces on the bench
          </p>
        </Reveal>
      </div>
    </section>
  );
}
