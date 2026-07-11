import Reveal from "@/components/Reveal";
import ProductCard from "@/components/ProductCard";
import { getProducts } from "@/lib/shopify";
import styles from "./CollectionGrid.module.css";

export default async function CollectionGrid() {
  const products = await getProducts();

  return (
    <section className={styles.section} id="collection">
      <div className="shell">
        <Reveal>
          <p className={styles.eyebrow}>The collection</p>
          <h2 className={styles.heading}>The rest of the family</h2>
          <p className={styles.lede}>
            One design language, many makers — everything picked to disappear
            into your home, not shout over it.
          </p>
        </Reveal>

        <div className={styles.grid}>
          {products.map((p, i) => (
            <Reveal key={p.id} delay={i * 90}>
              <ProductCard product={p} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
