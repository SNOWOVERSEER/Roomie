/*
 * Stripe 资源幂等初始化：3 个 SKU 的 Product+Price（AUD、含税价）
 * + 生产 Webhook endpoint（roomiepaw.vercel.app/api/webhook）。
 *
 * 幂等键：product.metadata.roomie_handle。重复跑只读不建。
 * 换 live key 重跑一遍，即得生产环境的 Price ID（回填 lib/catalog.ts）
 * 与生产 whsec（配到 Vercel）。
 *
 * 用法：npm run stripe:setup（读 .env.local 的 STRIPE_SECRET_KEY）
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import Stripe from "stripe";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
for (const line of readFileSync(path.join(root, ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const SITE = "https://roomiepaw.vercel.app";

const SKUS = [
  {
    handle: "canvas-scratcher",
    name: "The Canvas Scratcher",
    description:
      "A framed loop-pile canvas that leans on your wall like art and scratches like a post. Solid pine, swap-able prints.",
    unitAmount: 8900,
    image: `${SITE}/c01/print-01.webp`,
  },
  {
    handle: "canvas-print",
    name: "Swap-in Print",
    description:
      "A fresh loop-pile canvas for the frame you already have. Fits every Canvas Series frame.",
    unitAmount: 3500, // TODO 占位价，与 lib/catalog.ts 同步改
    image: `${SITE}/c01/print-02.webp`,
  },
  {
    handle: "canvas-house",
    name: "The Canvas House",
    description:
      "The canvas folded into a den — two scratch walls, a porthole door. First run of ten, numbered on the frame.",
    unitAmount: 18900, // TODO 占位价，与 lib/catalog.ts 同步改
    image: `${SITE}/c01/house-poster.jpg`,
  },
];

async function ensureProduct(sku) {
  const existing = await stripe.products.search({
    query: `metadata['roomie_handle']:'${sku.handle}' AND active:'true'`,
  });
  if (existing.data[0]) return existing.data[0];
  return stripe.products.create({
    name: sku.name,
    description: sku.description,
    images: [sku.image],
    metadata: { roomie_handle: sku.handle },
  });
}

async function ensurePrice(product, sku) {
  const prices = await stripe.prices.list({ product: product.id, active: true, limit: 10 });
  const hit = prices.data.find(
    (p) => p.unit_amount === sku.unitAmount && p.currency === "aud",
  );
  if (hit) return hit;
  return stripe.prices.create({
    product: product.id,
    currency: "aud",
    unit_amount: sku.unitAmount,
    // 澳洲零售价 GST 含内；开启 Stripe Tax 后按含税价拆分
    tax_behavior: "inclusive",
  });
}

const out = {};
for (const sku of SKUS) {
  const product = await ensureProduct(sku);
  const price = await ensurePrice(product, sku);
  out[sku.handle] = { product: product.id, price: price.id, unitAmount: sku.unitAmount };
  console.log(`${sku.handle}: product=${product.id} price=${price.id} (${sku.unitAmount} aud)`);
}

// —— 生产 webhook endpoint（幂等：按 URL 匹配）——
const hookUrl = `${SITE}/api/webhook`;
const hooks = await stripe.webhookEndpoints.list({ limit: 100 });
let hook = hooks.data.find((h) => h.url === hookUrl);
if (!hook) {
  hook = await stripe.webhookEndpoints.create({
    url: hookUrl,
    enabled_events: [
      "checkout.session.completed",
      "checkout.session.async_payment_succeeded",
      "checkout.session.async_payment_failed",
    ],
    description: "Roomie production — writes orders + confirmation email",
  });
  console.log(`webhook created: ${hook.id}`);
  console.log(`PROD_STRIPE_WEBHOOK_SECRET=${hook.secret}`); // 只在创建时返回一次
} else {
  console.log(`webhook exists: ${hook.id}（secret 只在创建时显示，可在 Dashboard 查看）`);
}

console.log("\n--- lib/catalog.ts 常量 ---");
console.log(JSON.stringify(out, null, 2));
