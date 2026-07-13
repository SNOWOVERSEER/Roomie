import type { Metadata } from "next";
import { Baloo_2, Nunito_Sans } from "next/font/google";
import "./globals.css";
import { getCatalog, isSoldOut } from "@/lib/catalog";
import { CartProvider, type ClientCatalogItem } from "@/components/CartContext";

/*
 * 商品数据来自 Supabase（admin 后台可改价/库存）——必须显式动态渲染，
 * 否则构建时预渲染会把旧价格烧进静态 HTML。
 */
export const dynamic = "force-dynamic";

/*
 * Display: Baloo 2 — round, chubby, matches the Roomie wordmark.
 * Body: Nunito Sans — warm rounded terminals, easy long-form reading.
 * (设计文档建议 Fredoka/Baloo + Inter；正文换成了更贴合品牌的 Nunito Sans，
 *  如需 Inter 只改这里即可。)
 */
const display = Baloo_2({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-display",
});
const body = Nunito_Sans({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_URL || "https://roomiepaw.vercel.app",
  ),
  title: "RoomiePaw · the art your cat can scratch",
  description:
    "The Canvas Scratcher by RoomiePaw: a framed canvas print for your wall that's secretly your cat's favourite thing. Pet furniture that feels like part of home. Melbourne, AU.",
  openGraph: {
    title: "RoomiePaw · the art your cat can scratch",
    description:
      "A framed canvas for your wall that's secretly a scratcher. Pet things that feel like part of home.",
    images: ["/hero/still-last.jpg"],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // 客户端购物车的价格快照（上架商品；含售罄标记）。
  // 展示用快照，结算金额永远由服务端 re-derive。
  const catalog: ClientCatalogItem[] = (await getCatalog())
    .filter((i) => i.available)
    .map((i) => ({
      handle: i.handle,
      title: i.title,
      priceCents: i.priceCents,
      image: i.image,
      numbered: i.numbered,
      soldOut: isSoldOut(i),
    }));
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable}`}>
        <CartProvider catalog={catalog}>{children}</CartProvider>
      </body>
    </html>
  );
}
