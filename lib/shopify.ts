/*
 * Shopify 接口层（当前为 mock 降级实现）。
 *
 * store 就绪后的接入方式（UI 不需要改动）：
 * 1. `.env.local` 填入：
 *      NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN=TODO.myshopify.com
 *      NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN=TODO
 * 2. `npm i @shopify/hydrogen-react`，在 app/layout.tsx 挂
 *    <ShopifyProvider storeDomain=... storefrontToken=... countryIsoCode="AU">
 *    与 <CartProvider>。
 * 3. 把下面的 mock 函数体换成 Storefront API (GraphQL) 调用，
 *    checkout 跳 Shopify 托管页（cart.checkoutUrl）。
 */

export interface Product {
  id: string;
  handle: string;
  title: string;
  tagline: string;
  price: number; // AUD
  currency: "AUD";
  image: string; // /public 路径或 Shopify CDN URL
  available: boolean;
}

/**
 * 集合店的一层抽象：一个「系列」= 一个合作制造方 + 一组产品。
 * 货架区（TheShelf）与未来的滑动 Hero 都以此为数据源。
 * TODO(Shopify): 映射为 Shopify custom collection + metafields
 * （number/maker/status），此处先 mock。
 */
export interface CollectionSummary {
  number: string; // 展示编号，如 "01"
  handle: string;
  title: string;
  maker?: string; // 合作制造方（可露出 logo/名称）
  status: "live" | "soon";
  blurb: string;
  image: string;
  priceFrom?: number; // AUD
}

/* TODO(Shopify): 占位商品数据。图片为品牌风格插画占位图。 */
const MOCK_PRODUCTS: Product[] = [
  {
    id: "gid://mock/1",
    handle: "canvas-scratcher",
    title: "The Canvas Scratcher",
    tagline: "A framed print your cat is allowed to ruin — slowly.",
    price: 89,
    currency: "AUD",
    image: "/story/still-sit.jpg",
    available: true,
  },
  {
    id: "gid://mock/5",
    handle: "canvas-house",
    title: "The Canvas House",
    tagline: "The canvas, folded into a den.",
    price: 189, // TODO 价格待用户确认
    currency: "AUD",
    image: "/c01/house-poster.jpg",
    available: true, // 预售可下单（编号预留）
  },
  {
    id: "gid://mock/2",
    handle: "nook-house",
    title: "The Nook",
    tagline: "Side table outside. Cat cave inside.",
    price: 149,
    currency: "AUD",
    image: "/collection/nook.svg",
    available: false,
  },
  {
    id: "gid://mock/3",
    handle: "cloud-perch",
    title: "Cloud Perch",
    tagline: "A window seat for professional sunbeam inspectors.",
    price: 119,
    currency: "AUD",
    image: "/collection/perch.svg",
    available: false,
  },
  {
    id: "gid://mock/4",
    handle: "wave-bowls",
    title: "Wave Bowls",
    tagline: "Ceramic dinnerware that can stay on the table.",
    price: 59,
    currency: "AUD",
    image: "/collection/bowls.svg",
    available: false,
  },
];

/* TODO(Shopify): 占位系列数据。№01 为在售系列；02–04 为占位（卡通插画占位图）。 */
const MOCK_COLLECTIONS: CollectionSummary[] = [
  {
    number: "01",
    handle: "canvas-series",
    title: "The Canvas Series",
    maker: "GlugGlug",
    status: "live",
    blurb: "A scratcher disguised as a print, and its new little house.",
    image: "/c01/shelf-featured.webp",
    priceFrom: 89,
  },
  {
    number: "02",
    handle: "nook-collection",
    title: "The Nook",
    status: "soon",
    blurb: "Side table outside. Cat cave inside.",
    image: "/collection/nook.svg",
  },
  {
    number: "03",
    handle: "perch-collection",
    title: "Cloud Perch",
    status: "soon",
    blurb: "A window seat for professional sunbeam inspectors.",
    image: "/collection/perch.svg",
  },
  {
    number: "04",
    handle: "bowls-collection",
    title: "Wave Bowls",
    status: "soon",
    blurb: "Ceramic dinnerware that can stay on the table.",
    image: "/collection/bowls.svg",
  },
];

export async function getProducts(): Promise<Product[]> {
  // TODO(Shopify): 换成 Storefront API products query
  return MOCK_PRODUCTS;
}

export async function getCollections(): Promise<CollectionSummary[]> {
  // TODO(Shopify): 换成 Storefront API collections query
  return MOCK_COLLECTIONS;
}

/**
 * 猫屋首批编号预售的余量。claimed = 已被预留的编号。
 * TODO(Shopify): 用 10 个变体（№01–№10）的库存映射，此处 mock 为全部可选。
 */
export async function getHouseRun(): Promise<{
  total: number;
  claimed: number[];
}> {
  return { total: 10, claimed: [] };
}

export async function getProduct(handle: string): Promise<Product | undefined> {
  return MOCK_PRODUCTS.find((p) => p.handle === handle);
}

export async function addToCartMock(handle: string): Promise<{ ok: true }> {
  // TODO(Shopify): 换成 hydrogen-react useCart().linesAdd
  await new Promise((r) => setTimeout(r, 220));
  void handle;
  return { ok: true };
}

export function formatPrice(p: Product): string {
  return `AU$${p.price}`;
}
