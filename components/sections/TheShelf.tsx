import Link from "next/link";
import Reveal from "@/components/Reveal";
import { getCollections } from "@/lib/shopify";
import WaitlistButton from "./WaitlistButton";
import styles from "./TheShelf.module.css";

/*
 * 货架区 —— 集合店的结构核心：一次只认真做一个系列。
 * live 系列 = 大幅实拍主位；soon 系列 = 手绘占位（保持现有卡通画风），
 * 视觉上用「图纸感」（虚线边）与主位拉开层级。
 */
export default async function TheShelf() {
  const collections = await getCollections();
  const live = collections.find((c) => c.status === "live");
  const soon = collections.filter((c) => c.status === "soon");

  return (
    <section className={styles.section} id="collection">
      <div className="shell">
        <Reveal>
          <p className={styles.eyebrow}>The shelf</p>
          <h2 className={styles.heading}>One collection at a time</h2>
          <p className={styles.lede}>
            Roomie is a collection store: we find one small maker, obsess over
            one idea together, and put it on the shelf only when it belongs in
            a living room. Then we start the next.
          </p>
        </Reveal>

        <div className={styles.grid}>
          {live && (
            <Reveal className={styles.featured}>
              <a className={styles.featuredCard} href="#collection-01">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={live.image}
                  alt="The Canvas Series at home — a framed canvas leaning by a sofa, cat asleep beside it"
                  loading="lazy"
                />
                <span className={styles.nowChip}>Now showing</span>
                <span className={styles.featuredBody}>
                  <span className={styles.featuredNo}>№ {live.number}</span>
                  <span className={styles.featuredTitle}>{live.title}</span>
                  <span className={styles.featuredMeta}>
                    made with {live.maker} · from AU${live.priceFrom}
                  </span>
                </span>
              </a>
              <div className={styles.featuredLinks}>
                <Link href="/scratcher">
                  The Scratcher <em>AU$89</em>
                </Link>
                <Link href="/house">
                  The House <em>run of 10</em>
                </Link>
              </div>
            </Reveal>
          )}

          <div className={styles.soonCol}>
            {soon.map((c, i) => (
              <Reveal key={c.handle} delay={120 + i * 90}>
                <article className={styles.soonCard}>
                  <div className={styles.soonMedia}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.image} alt="" aria-hidden loading="lazy" />
                  </div>
                  <div className={styles.soonBody}>
                    <p className={styles.soonNo}>
                      № {c.number} · <em>sketching now</em>
                    </p>
                    <h3>{c.title}</h3>
                    <p className={styles.soonBlurb}>{c.blurb}</p>
                    <WaitlistButton title={c.title} />
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
