import Link from "next/link";
import Reveal from "@/components/Reveal";
import { formatCents, getCatalog } from "@/lib/catalog";
import WaitlistForm from "@/components/WaitlistForm";
import styles from "./TheShelf.module.css";

/*
 * What's next 区 —— 小工作室叙事：一件一件做，未上市产品用
 * 手绘占位（products 表 available=false 的商品）+ waitlist。
 */
export default async function TheShelf() {
  const products = await getCatalog();
  const soon = products.filter((p) => !p.available);
  const price = (h: string) =>
    formatCents(products.find((p) => p.handle === h)?.priceCents ?? 0);

  return (
    <section className={styles.section} id="coming-next">
      <div className="shell">
        <Reveal>
          <p className={styles.eyebrow}>In the workshop</p>
          <h2 className={styles.heading}>The roomful is growing</h2>
          <p className={styles.lede}>
            We&rsquo;re a small pet-furniture studio in Melbourne, making the
            un-ugly version of everything a cat needs, one piece at a time.
            Here&rsquo;s what&rsquo;s on the bench.
          </p>
        </Reveal>

        <div className={styles.grid}>
          <Reveal className={styles.featured}>
            <Link className={styles.featuredCard} href="/scratcher">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/c01/shelf-featured.webp"
                alt="The Canvas Scratcher at home: a framed canvas leaning by a sofa, cat asleep beside it"
                loading="lazy"
              />
              <span className={styles.nowChip}>In store now</span>
              <span className={styles.featuredBody}>
                <span className={styles.featuredTitle}>The Canvas Series</span>
                <span className={styles.featuredMeta}>
                  two pieces, six prints · from {price("canvas-scratcher")}
                </span>
              </span>
            </Link>
            <div className={styles.featuredLinks}>
              <Link href="/scratcher">
                The Scratcher <em>{price("canvas-scratcher")}</em>
              </Link>
              <Link href="/house">
                The House <em>waitlist open</em>
              </Link>
              <Link href="/scratcher#prints">
                Swap-in prints <em>{price("canvas-print")}</em>
              </Link>
            </div>
          </Reveal>

          <div className={styles.soonCol}>
            {soon.map((p, i) => (
              <Reveal key={p.handle} delay={120 + i * 90}>
                <article className={styles.soonCard}>
                  <div className={styles.soonMedia}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.image} alt="" aria-hidden loading="lazy" />
                  </div>
                  <div className={styles.soonBody}>
                    <p className={styles.soonNo}>
                      <em>sketching now</em>
                    </p>
                    <h3>{p.title}</h3>
                    <p className={styles.soonBlurb}>{p.tagline}</p>
                    <WaitlistForm compact handle={p.handle} title={p.title} />
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
