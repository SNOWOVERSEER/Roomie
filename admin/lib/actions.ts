"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
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
  revalidatePath("/");
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
  revalidatePath("/");
  return { ok: true };
}

export async function toggleAvailable(
  handle: string,
  available: boolean,
): Promise<Result> {
  await assertAuth();
  const row = await getRow(handle);
  if (!row) return { error: "product not found" };
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
  revalidatePath("/");
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
  revalidatePath("/");
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
  revalidatePath("/");
  return { ok: true };
}

export async function deleteProduct(handle: string): Promise<Result> {
  await assertAuth();
  const row = await getRow(handle);
  if (!row) return { error: "product not found" };
  if (row.available) return { error: "take it off sale before deleting" };
  const { error } = await db().from("products").delete().eq("handle", handle);
  if (error) return { error: error.message };
  revalidatePath("/");
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
  revalidatePath("/");
  return { ok: true };
}
