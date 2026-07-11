import Link from "next/link";
import styles from "./pdp.module.css";

/** 详情页顶部面包屑：产品线归属 + 返回首页 */
export default function Crumb({ piece }: { piece: string }) {
  return (
    <div className={styles.crumb}>
      <div className={`shell ${styles.crumbRow}`}>
        <p className={styles.crumbTrail}>
          The Canvas Series — <strong>{piece}</strong>
        </p>
        <Link className={styles.crumbBack} href="/#canvas">
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
          the whole series
        </Link>
      </div>
    </div>
  );
}
