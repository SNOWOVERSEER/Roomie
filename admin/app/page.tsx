import { db } from "@/lib/db";
import type { ProductRow } from "@/lib/types";
import ProductsTable from "@/components/ProductsTable";

export default async function ProductsPage() {
  const { data, error } = await db()
    .from("products")
    .select("*")
    .order("sort", { ascending: true });
  if (error) throw new Error(error.message);
  return (
    <>
      <h1>Products</h1>
      <ProductsTable products={(data ?? []) as ProductRow[]} />
    </>
  );
}
