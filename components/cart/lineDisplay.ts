import type { CartLine, ClientCatalogItem } from "../CartContext";
import { lineImage } from "./lineImage";

/*
 * 购物车一行的展示字段。
 *
 * 目录快照缺失时（DB 短暂不可达，见 lib/degrade.ts）catalog 里没有这个
 * handle —— 以前这种行直接 `return null` 不渲染，于是购物车会显示
 * 「3 pieces」而下面空空如也，看着像坏了。这里给出降级展示：
 *   · 标题从 handle 还原（canvas-scratcher → Canvas Scratcher）；
 *   · 缩略图本来就由 variant 经静态 ARTWORKS 推出，不依赖 DB，照常有；
 *     variant 对不上（如猫屋编号件）就不给图，不编造。
 *   · 价格返回 null = 未知，调用方隐去，绝不显示 AU$0。
 */

const titleFromHandle = (handle: string) =>
  handle
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

export interface LineDisplay {
  title: string;
  /** 空串 = 没有可用缩略图 */
  image: string;
  /** null = 价格未知（目录快照缺失） */
  priceCents: number | null;
  numbered: boolean;
}

export function lineDisplay(
  line: CartLine,
  item: ClientCatalogItem | undefined,
): LineDisplay {
  if (item) {
    return {
      title: item.title,
      image: lineImage(line, item.image),
      priceCents: item.priceCents,
      numbered: item.numbered,
    };
  }
  return {
    title: titleFromHandle(line.handle),
    // 兜底传空串：variant 能匹配到画芯就有图，匹配不到就没有
    image: lineImage(line, ""),
    priceCents: null,
    // 未知时不当编号件处理，让用户仍能改数量/删除
    numbered: false,
  };
}
