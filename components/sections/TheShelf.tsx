import Link from "next/link";
import Reveal from "@/components/Reveal";
import { formatCents, getCatalog } from "@/lib/catalog";
import { getStockItems, productSoldOut } from "@/lib/inventory";
import WaitlistForm from "@/components/WaitlistForm";
import styles from "./TheShelf.module.css";

/*
 * What's next 区 —— 小工作室叙事：一件一件做。
 * 卡片来源 = 没有购买流程的商品（!sellable：从未 ready 的占位/猫屋）；
 * 暂时下架的在售商品不混进「工作坊在做」叙事，在各自入口标注。
 */
export default async function TheShelf() {
  const [products, stockItems] = await Promise.all([
    getCatalog(),
    getStockItems(),
  ]);
  /* 有专页承接的商品不进 What's next（猫屋的 waitlist 在自己的 PDP） */
  const HAS_OWN_PAGE = new Set([
    "canvas-scratcher",
    "canvas-print",
    "canvas-house",
  ]);
  const soon = products.filter(
    (p) => !p.sellable && !p.available && !HAS_OWN_PAGE.has(p.handle),
  );
  const status = (h: string) => {
    const p = products.find((x) => x.handle === h);
    if (!p) return "";
    if (!p.available) return "waitlist";
    if (productSoldOut(p, stockItems)) return "sold out";
    return formatCents(p.priceCents);
  };

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
                  two pieces, six prints · from {status("canvas-scratcher")}
                </span>
              </span>
            </Link>
            <div className={styles.featuredLinks}>
              <Link href="/scratcher">
                The Scratcher <em>{status("canvas-scratcher")}</em>
              </Link>
              <Link href="/house">
                The House <em>waitlist open</em>
              </Link>
              <Link href="/scratcher#prints">
                Swap-in prints <em>{status("canvas-print")}</em>
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
