import type { CartLine } from "@/components/CartContext";
import { CATALOG } from "@/lib/catalog";
import { ARTWORKS } from "@/lib/heroConfig";

/** 购物篮行缩略图：画芯类 variant → 对应画作平面稿，否则用商品图 */
export function lineImage(line: CartLine): string {
  const item = CATALOG[line.handle];
  if (!line.variant) return item.image;
  const i = ARTWORKS.findIndex((a) => a.title === line.variant);
  return i >= 0 ? `/hero/art/flat-0${i + 1}.png` : item.image;
}
