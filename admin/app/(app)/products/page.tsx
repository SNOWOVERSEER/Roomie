import { db } from "@/lib/db";
import type { ProductRow, StockItemRow } from "@/lib/types";
import ProductsTable from "@/components/ProductsTable";
import InventoryTable from "@/components/InventoryTable";

export default async function ProductsPage() {
  const [products, items] = await Promise.all([
    db().from("products").select("*").order("sort", { ascending: true }),
    db().from("stock_items").select("*").order("sort", { ascending: true }),
  ]);
  if (products.error) throw new Error(products.error.message);
  if (items.error) throw new Error(items.error.message);
  return (
    <>
      <h1>Products</h1>
      <ProductsTable products={(products.data ?? []) as ProductRow[]} />
      <InventoryTable items={(items.data ?? []) as StockItemRow[]} />
    </>
  );
}
