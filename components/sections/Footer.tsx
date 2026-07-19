import RoomieLogo from "@/components/RoomieLogo";
import PartnerMark from "@/components/PartnerMark";
import styles from "./Footer.module.css";

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={`shell ${styles.grid}`}>
        <div className={styles.brand}>
          <RoomieLogo height={44} variant="cream" />
          <p>
            Pet furniture that feels like part of home.
            <br />
            Made for pets, chosen for living rooms.
          </p>
          <div className={styles.social}>
            <a href="#" aria-label="Instagram">
              <svg viewBox="0 0 24 24" width="19" aria-hidden>
                <rect
                  x="3"
                  y="3"
                  width="18"
                  height="18"
                  rx="5.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <circle
                  cx="12"
                  cy="12"
                  r="4.2"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <circle cx="17.2" cy="6.8" r="1.4" fill="currentColor" />
              </svg>
            </a>
            <a href="#" aria-label="TikTok">
              <svg viewBox="0 0 24 24" width="19" aria-hidden>
                <path
                  d="M14.5 3v10.6a3.6 3.6 0 1 1-3.1-3.57M14.5 5.2c.7 2.1 2.3 3.5 4.5 3.7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              </svg>
            </a>
            <a href="#" aria-label="Pinterest">
              <svg viewBox="0 0 24 24" width="19" aria-hidden>
                <circle
                  cx="12"
                  cy="12"
                  r="9"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  d="M12 7.5c-2 0-3.4 1.4-3.4 3.1 0 1.2.6 2 1.5 2.4M12.6 9.5 10 19"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </a>
          </div>
        </div>

        <nav className={styles.col} aria-label="Shop">
          <h3>Shop</h3>
          <a href="/scratcher">The Canvas Scratcher</a>
          <a href="/house">The Canvas House</a>
          <a href="/#coming-next">What&rsquo;s next</a>
        </nav>

        <nav className={styles.col} aria-label="Help">
          <h3>Help</h3>
          <a href="/shipping-returns">Shipping &amp; returns</a>
          <a href="/care">Care guide</a>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <a href="mailto:hello@roomiepaw.com.au">hello@roomiepaw.com.au</a>
        </nav>

        {/* 合作品牌位：每个品牌一个 .partner 块，新品牌往下加 */}
        <div className={styles.col}>
          <h3>Partners</h3>
          <div className={styles.partner}>
            <PartnerMark className={styles.partnerMark} />
            <span>The workshop behind the Canvas Series.</span>
          </div>
        </div>
      </div>

      <div className={`shell ${styles.fine}`}>
        <span>© 2026 RoomiePaw · Melbourne, AU</span>
        <span className={styles.demo}>
          secure checkout by Stripe · GST included · ships Australia-wide
        </span>
      </div>
    </footer>
  );
}
