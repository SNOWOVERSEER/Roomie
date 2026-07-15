import type { Metadata } from "next";
import { Baloo_2, Nunito_Sans } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { getCatalog } from "@/lib/catalog";
import { PROD_ORIGIN } from "@/lib/env";
import { getStockItems, productSoldOut } from "@/lib/inventory";
import { CartProvider, type ClientCatalogItem } from "@/components/CartContext";
import PromoProvider from "@/components/promo/PromoProvider";
import {
  activeCampaign,
  PROMO_DISMISS_COOKIE,
  SUBSCRIBED_COOKIE,
} from "@/lib/promos";

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

/* 非 https 或非法的 NEXT_PUBLIC_URL 一律回退生产域名（同 lib/email.ts base()
   规则）——构建期 new URL() 对坏配置值抛错会炸整个 build，踩过 */
const siteUrl = (() => {
  const u = process.env.NEXT_PUBLIC_URL ?? "";
  try {
    return new URL(u.startsWith("https://") ? u : PROD_ORIGIN);
  } catch {
    return new URL(PROD_ORIGIN);
  }
})();

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: "RoomiePaw · pet furniture that feels like home",
  description:
    "RoomiePaw is a small Melbourne studio making pet furniture that holds its own in the living room. First up: The Canvas Scratcher, a framed print your cat is allowed to ruin.",
  openGraph: {
    title: "RoomiePaw · pet furniture that feels like home",
    description:
      "Pet things that feel like part of home, from a small Melbourne studio. First up: a framed canvas that's secretly a scratcher.",
    images: ["/hero/still-last.jpg"],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // 客户端购物车的价格快照（上架商品；售罄按组件库存聚合）。
  // 展示用快照，结算金额永远由服务端 re-derive。
  const [rows, stockItems, jar] = await Promise.all([
    getCatalog(),
    getStockItems(),
    cookies(),
  ]);

  // 活动栏位初始可见性在服务端算好：已关掉（7 天内、同活动）或
  // 已订阅（letter 类活动）都不渲染 —— SSR 首帧即正确，无闪烁无位移
  const dismissedId = jar.get(PROMO_DISMISS_COOKIE)?.value ?? null;
  const subscribed = jar.get(SUBSCRIBED_COOKIE)?.value === "1";
  const act = activeCampaign();
  const campaign =
    act && act.id !== dismissedId && !(act.kind === "subscribe" && subscribed)
      ? act
      : null;
  const catalog: ClientCatalogItem[] = rows
    .filter((i) => i.available)
    .map((i) => ({
      handle: i.handle,
      title: i.title,
      priceCents: i.priceCents,
      image: i.image,
      numbered: i.numbered,
      soldOut: productSoldOut(i, stockItems),
    }));
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable}`}>
        <CartProvider catalog={catalog}>
          <PromoProvider campaign={campaign} subscribed={subscribed}>
            {children}
          </PromoProvider>
        </CartProvider>
      </body>
    </html>
  );
}
