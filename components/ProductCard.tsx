"use client";

import { formatPrice, type Product } from "@/lib/shopify";
import { useCart } from "./CartContext";
import styles from "./ProductCard.module.css";

export default function ProductCard({ product }: { product: Product }) {
  const { add } = useCart();

  return (
    <article className={styles.card}>
      <div className={styles.media}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={product.image} alt={product.title} loading="lazy" />
        {!product.available && (
          <span className={styles.soon}>coming soon</span>
        )}
      </div>
      <div className={styles.body}>
        <h3>{product.title}</h3>
        <p>{product.tagline}</p>
        <div className={styles.row}>
          <span className={styles.price}>{formatPrice(product)}</span>
          {product.available ? (
            <button
              className={styles.add}
              onClick={() => add(product.handle, product.title)}
            >
              Add to basket
            </button>
          ) : (
            <button className={styles.wait}>Join waitlist</button>
          )}
        </div>
      </div>
    </article>
  );
}
