"use server";

import { revalidatePath } from "next/cache";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { stripe, stripeMode } from "@/lib/stripe";
import { assertAuth } from "@/lib/auth";
import type { ProductRow } from "@/lib/types";

export type Result = { ok: true } | { error: string };

const HANDLE_RE = /^[a-z0-9-]{2,40}$/;

async function getRow(handle: string): Promise<ProductRow | null> {
  const { data } = await db()
    .from("products")
    .select("*")
    .eq("handle", handle)
    .single();
  return (data as ProductRow) ?? null;
}

/*
 * 改价 = Stripe Price 不可变金额，必须建新归档旧：
 *   1. 建新 Price（同 product）
 *   2. DB 回写 price_cents + stripe_price_id（失败则归档新价回滚）
 *   3. 归档旧 Price
 * 旧价保持 active 到最后一步，改价过程中生产结算不断档。
 * 无 Stripe 侧对象的商品（未开售占位品）只写 DB。
 */
export async function updatePrice(
  handle: string,
  newCents: number,
): Promise<Result> {
  await assertAuth();
  if (!Number.isInteger(newCents) || newCents < 100 || newCents > 500_000) {
    return { error: "price out of range (AU$1 to AU$5000)" };
  }
  const row = await getRow(handle);
  if (!row) return { error: "product not found" };

  let newPriceId: string | null = null;
  let productId = row.stripe_product_id;
  try {
    if (row.stripe_price_id || productId) {
      if (!productId && row.stripe_price_id) {
        // 旧 seed 只存了 price id：从 Stripe 反查 product 并回填
        const old = await stripe().prices.retrieve(row.stripe_price_id);
        productId =
          typeof old.product === "string" ? old.product : old.product.id;
      }
      const created = await stripe().prices.create({
        product: productId!,
        unit_amount: newCents,
        currency: "aud",
      });
      newPriceId = created.id;
    }
  } catch (e) {
    return { error: `Stripe: ${e instanceof Error ? e.message : "failed"}` };
  }

  const patch: Record<string, unknown> = { price_cents: newCents };
  if (newPriceId) {
    patch.stripe_price_id = newPriceId;
    patch.stripe_product_id = productId;
  }
  const { error } = await db().from("products").update(patch).eq("handle", handle);
  if (error) {
    if (newPriceId) {
      await stripe().prices.update(newPriceId, { active: false }).catch(() => {});
    }
    return { error: error.message };
  }
  if (newPriceId && row.stripe_price_id) {
    await stripe()
      .prices.update(row.stripe_price_id, { active: false })
      .catch(() => {});
  }
  revalidatePath("/products");
  return { ok: true };
}

export async function updateStock(
  handle: string,
  stock: number | null,
): Promise<Result> {
  await assertAuth();
  if (stock !== null && (!Number.isInteger(stock) || stock < 0 || stock > 100_000)) {
    return { error: "stock out of range" };
  }
  const { error } = await db().from("products").update({ stock }).eq("handle", handle);
  if (error) return { error: error.message };
  revalidatePath("/products");
  return { ok: true };
}

export async function toggleAvailable(
  handle: string,
  available: boolean,
): Promise<Result> {
  await assertAuth();
  const row = await getRow(handle);
  if (!row) return { error: "product not found" };
  if (available && !row.sellable) {
    return {
      error:
        "not ready to sell: this product has no purchase flow on the site yet (page + buy panel first)",
    };
  }
  if (available && !row.stripe_price_id) {
    return {
      error: "no Stripe price yet. Create in Stripe first, then put it on sale",
    };
  }
  const { error } = await db()
    .from("products")
    .update({ available })
    .eq("handle", handle);
  if (error) return { error: error.message };
  revalidatePath("/products");
  return { ok: true };
}

export async function updateCopy(
  handle: string,
  title: string,
  tagline: string,
): Promise<Result> {
  await assertAuth();
  const t = title.trim();
  if (t.length < 2 || t.length > 80) return { error: "title length 2 to 80" };
  if (tagline.length > 160) return { error: "tagline too long" };
  const { error } = await db()
    .from("products")
    .update({ title: t, tagline: tagline.trim() })
    .eq("handle", handle);
  if (error) return { error: error.message };
  revalidatePath("/products");
  return { ok: true };
}

export async function createProduct(input: {
  handle: string;
  title: string;
  tagline: string;
  priceCents: number;
  image: string;
}): Promise<Result> {
  await assertAuth();
  if (!HANDLE_RE.test(input.handle)) {
    return { error: "handle: lowercase letters, digits, hyphens" };
  }
  if (!Number.isInteger(input.priceCents) || input.priceCents < 100) {
    return { error: "bad price" };
  }
  if (!input.image.startsWith("/")) {
    return { error: "image must be a /public path like /c01/x.webp" };
  }
  const { error } = await db().from("products").insert({
    handle: input.handle,
    title: input.title.trim(),
    tagline: input.tagline.trim(),
    price_cents: input.priceCents,
    image: input.image.trim(),
    available: false,
    sort: 1000,
  });
  if (error) return { error: error.message };
  revalidatePath("/products");
  return { ok: true };
}

export async function deleteProduct(handle: string): Promise<Result> {
  await assertAuth();
  const row = await getRow(handle);
  if (!row) return { error: "product not found" };
  if (row.available) return { error: "take it off sale before deleting" };
  const { error } = await db().from("products").delete().eq("handle", handle);
  if (error) return { error: error.message };
  revalidatePath("/products");
  return { ok: true };
}

/* ―― 组件库存（stock_items：画框 + 六幅画芯）―― */

export async function updateItemStock(
  id: string,
  stock: number | null,
): Promise<Result> {
  await assertAuth();
  if (stock !== null && (!Number.isInteger(stock) || stock < 0 || stock > 100_000)) {
    return { error: "stock out of range" };
  }
  const { error } = await db().from("stock_items").update({ stock }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/products");
  return { ok: true };
}

/** 画作退役/复出（seasonal drops：退役后购买动线里彻底消失） */
export async function toggleItemAvailable(
  id: string,
  available: boolean,
): Promise<Result> {
  await assertAuth();
  if (id === "frame" && !available) {
    return { error: "the frame cannot be retired (take products off sale instead)" };
  }
  const { error } = await db()
    .from("stock_items")
    .update({ available })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/products");
  return { ok: true };
}

/** 为无 Stripe 侧对象的商品补建 product + price（开售前置步骤） */
export async function ensureStripe(handle: string): Promise<Result> {
  await assertAuth();
  const row = await getRow(handle);
  if (!row) return { error: "product not found" };
  if (row.stripe_price_id) return { error: "already has a Stripe price" };
  try {
    const productId =
      row.stripe_product_id ??
      (await stripe().products.create({ name: row.title })).id;
    const price = await stripe().prices.create({
      product: productId,
      unit_amount: row.price_cents,
      currency: "aud",
    });
    const { error } = await db()
      .from("products")
      .update({ stripe_product_id: productId, stripe_price_id: price.id })
      .eq("handle", handle);
    if (error) return { error: error.message };
  } catch (e) {
    return { error: `Stripe: ${e instanceof Error ? e.message : "failed"}` };
  }
  revalidatePath("/products");
  return { ok: true };
}

/* ―― Stripe 同步体检与修复（2026-07-26，切账户遗留教训产品化）――
 * 口径：DB（price_cents + 两个 stripe id 列）是唯一事实源，Stripe 跟随。
 * 结算不引用这些 id（checkout 走 price_data），失同步只挡 admin 改价/建价，
 * 但要能一眼看出、一键拉齐。check 全程只读；repair 幂等：
 *   - product id ≠ price 实际挂靠 → DB 回填真值（07-26 事故的修法）
 *   - product 归档 → 反归档（07-13 事故的止血动作产品化）
 *   - price 缺失/归档/金额币种不符 → 依 DB 在正确 product 下重建，
 *     顺序同 updatePrice：建新 → 回写 DB → 归档旧，改价过程不断档
 *   - 纯占位行（两列皆空）不建任何对象；"有 product 无 price"的待开售行
 *     只整理 product 侧，建价仍走 Create in Stripe（开售动作要显式）。 */

export type SyncRow = {
  handle: string;
  title: string;
  ok: boolean;
  issues: string[];
};
export type SyncReport = { mode: "test" | "live" | "unknown"; rows: SyncRow[] };

export async function checkStripeSync(): Promise<SyncReport | { error: string }> {
  await assertAuth();
  const { data, error } = await db()
    .from("products")
    .select("*")
    .order("sort", { ascending: true });
  if (error) return { error: error.message };
  try {
    const rows = await Promise.all(((data ?? []) as ProductRow[]).map(syncStatus));
    return { mode: stripeMode(), rows };
  } catch (e) {
    return { error: `Stripe: ${e instanceof Error ? e.message : "failed"}` };
  }
}

const aud = (cents: number | null) =>
  cents === null ? "?" : `AU$${(cents / 100).toFixed(2)}`;

async function syncStatus(r: ProductRow): Promise<SyncRow> {
  const issues: string[] = [];
  if (!r.stripe_price_id) {
    // 待开售行：没有 Stripe 对象是常态；只有存着无效/归档 product 才算失同步
    if (r.stripe_product_id) {
      try {
        const prod = await stripe().products.retrieve(r.stripe_product_id);
        if (!prod.active) issues.push("Stripe product is archived");
      } catch {
        issues.push(
          `stored product ${r.stripe_product_id} does not exist in this Stripe account`,
        );
      }
    }
  } else {
    try {
      const price = await stripe().prices.retrieve(r.stripe_price_id);
      const parent =
        typeof price.product === "string" ? price.product : price.product.id;
      if (!price.active) issues.push("Stripe price is archived");
      if (price.currency !== "aud")
        issues.push(`price currency is ${price.currency}, expected aud`);
      if (price.unit_amount !== r.price_cents)
        issues.push(
          `price is ${aud(price.unit_amount)} on Stripe but ${aud(r.price_cents)} in the database`,
        );
      if (r.stripe_product_id !== parent)
        issues.push(
          `stored product id (${r.stripe_product_id ?? "none"}) is not the product this price belongs to (${parent})`,
        );
      try {
        const prod = await stripe().products.retrieve(parent);
        if (!prod.active) issues.push("Stripe product is archived");
      } catch {
        issues.push(`parent product ${parent} does not exist in this Stripe account`);
      }
    } catch {
      issues.push(
        `stored price ${r.stripe_price_id} does not exist in this Stripe account`,
      );
    }
  }
  return { handle: r.handle, title: r.title, ok: issues.length === 0, issues };
}

export async function repairStripeSync(handle: string): Promise<Result> {
  await assertAuth();
  const row = await getRow(handle);
  if (!row) return { error: "product not found" };

  try {
    // 待开售行（无 price）：只整理 product 侧，不新建对象
    if (!row.stripe_price_id) {
      if (!row.stripe_product_id) return { ok: true };
      try {
        const prod = await stripe().products.retrieve(row.stripe_product_id);
        if (!prod.active) await stripe().products.update(prod.id, { active: true });
      } catch {
        // 旧账户残留 id：清空，回到干净占位态
        const { error } = await db()
          .from("products")
          .update({ stripe_product_id: null })
          .eq("handle", handle);
        if (error) return { error: error.message };
      }
      revalidatePath("/products");
      return { ok: true };
    }

    let oldPrice: Stripe.Price | null = null;
    try {
      oldPrice = await stripe().prices.retrieve(row.stripe_price_id);
    } catch {
      oldPrice = null;
    }

    // 定准 product：price 的实际挂靠 > 表存值（本账户可查者）> 新建
    let productId: string | null = oldPrice
      ? typeof oldPrice.product === "string"
        ? oldPrice.product
        : oldPrice.product.id
      : null;
    if (!productId && row.stripe_product_id) {
      try {
        productId = (await stripe().products.retrieve(row.stripe_product_id)).id;
      } catch {
        productId = null;
      }
    }
    if (!productId) {
      productId = (
        await stripe().products.create({
          name: row.title,
          metadata: { roomie_handle: row.handle },
        })
      ).id;
    } else {
      const prod = await stripe().products.retrieve(productId);
      if (!prod.active) await stripe().products.update(productId, { active: true });
    }

    // price 不达标（缺失/归档/金额币种不符/挂错 product）则依 DB 重建
    const priceGood =
      oldPrice !== null &&
      oldPrice.active &&
      oldPrice.currency === "aud" &&
      oldPrice.unit_amount === row.price_cents &&
      (typeof oldPrice.product === "string"
        ? oldPrice.product
        : oldPrice.product.id) === productId;

    let priceId = oldPrice?.id ?? null;
    let created = false;
    if (!priceGood) {
      const p = await stripe().prices.create({
        product: productId,
        unit_amount: row.price_cents,
        currency: "aud",
      });
      priceId = p.id;
      created = true;
    }

    if (priceId !== row.stripe_price_id || productId !== row.stripe_product_id) {
      const { error } = await db()
        .from("products")
        .update({ stripe_price_id: priceId, stripe_product_id: productId })
        .eq("handle", handle);
      if (error) {
        if (created && priceId) {
          await stripe().prices.update(priceId, { active: false }).catch(() => {});
        }
        return { error: error.message };
      }
    }
    if (created && oldPrice && oldPrice.active) {
      await stripe().prices.update(oldPrice.id, { active: false }).catch(() => {});
    }
  } catch (e) {
    return { error: `Stripe: ${e instanceof Error ? e.message : "failed"}` };
  }
  revalidatePath("/products");
  return { ok: true };
}
