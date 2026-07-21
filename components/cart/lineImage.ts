import type { CartLine } from "@/components/CartContext";
import { ARTWORKS } from "@/lib/heroConfig";

/** 购物篮行缩略图：画芯类 variant → 对应画作平面稿缩略版（-s.jpg，
 *  全尺寸 flat 是 3-4MB 管线原稿，tools/make_flat_thumbs.py 生成缩略），
 *  否则用商品图 */
export function lineImage(line: CartLine, image: string): string {
  if (!line.variant) return image;
  const i = ARTWORKS.findIndex((a) => a.title === line.variant);
  return i >= 0 ? `/hero/art/flat-0${i + 1}-s.jpg` : image;
}
