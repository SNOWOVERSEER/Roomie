import Link from "next/link";
import styles from "./pdp.module.css";

/** 详情页顶部面包屑：系列归属 + 返回集合 */
export default function Crumb({ piece }: { piece: string }) {
  return (
    <div className={styles.crumb}>
      <div className={`shell ${styles.crumbRow}`}>
        <p className={styles.crumbTrail}>
          Collection № 01 · The Canvas Series — <strong>{piece}</strong>
        </p>
        <Link className={styles.crumbBack} href="/#collection-01">
          <svg viewBox="0 0 20 20" width="15" aria-hidden>
            <path
              d="M16 10H5m4.5-4.5L5 10l4.5 4.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          all of № 01
        </Link>
      </div>
    </div>
  );
}
