import Link from "next/link";
import { formatCents } from "@/lib/catalog";
import { getProductStatuses } from "@/lib/inventory";
import styles from "./FinalCta.module.css";

/* 收束段：夜色一拍，把两条购买动线最后各递一次。下单动作都在详情页。
   本段是站内唯一不走 Reveal 的进场（对 HANDOVER 4.4 的刻意例外）：
   深色整幅背景铺满视口而文字还没浮现时会成为"整屏纯蓝"，
   最后一次转化不能有不可见的窗口。 */
export default async function FinalCta() {
  const scr = (await getProductStatuses()).get("canvas-scratcher");
  const scrLabel = scr?.offSale
    ? "The Scratcher · join the waitlist"
    : scr?.soldOut
      ? "The Scratcher · sold out, back soon"
      : `The Scratcher · ${formatCents(scr?.priceCents ?? 0)}`;
  return (
    <section className={styles.section}>
      <div className={`shell ${styles.inner}`}>
        <h2 className={styles.heading}>Take one home</h2>
        <p className={styles.sub}>
          The print that scratches, or the den that hides. Both wear the
          same swap-able canvas.
        </p>
        <div className={styles.row}>
          <Link className="btnPrimary" href="/scratcher">
            {scrLabel}
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
        </div>
        <p className={styles.fine}>
          Ships AU-wide, free over AU$188 · prints swap in minutes · more
          pieces on the bench
        </p>
      </div>
    </section>
  );
}
