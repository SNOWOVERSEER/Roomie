import type { Metadata } from "next";
import { Baloo_2, Nunito_Sans } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/components/CartContext";

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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable}`}>
        {/* TODO(Shopify): 当 store 就绪后，把 CartProvider 换成
            <ShopifyProvider><CartProvider>（@shopify/hydrogen-react），
            配置见 lib/shopify.ts */}
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
