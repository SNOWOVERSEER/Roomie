# Local Admin Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 商品数据（价格/库存/文案/上下架）迁入 Supabase `products` 表，主站改为读表并支持库存扣减；新建仓库内 `admin/` 本地管理后台（Products/Orders/Waitlist），改价、补货、发货全部点击完成，无需部署。

**Architecture:** 主站（Vercel 生产）从 products 表服务端读取商品，checkout 校验库存、webhook 原子扣减；admin 是独立 Next.js 应用，只绑 127.0.0.1 永不部署，直连 Supabase（service key）+ Stripe API，发货复用生产 `/api/shipping`。Spec: `docs/superpowers/specs/2026-07-13-local-admin-design.md`。

**Tech Stack:** Next.js 15 App Router / React 19 / @supabase/supabase-js / stripe-node / TypeScript。无测试框架（沿用项目现状）。

## Global Constraints

- 站点用户可见文案**纯英文**，**禁止长破折号 —**（分隔用 `·`）；代码注释中文无妨。
- 供应商品牌/logo/中文绝不出现在站点任何位置。
- 服务端结算金额一律从数据库 re-derive，绝不信任客户端价格。
- `next build` 前必须停掉 dev server（共用 `.next` 会损坏 dev 缓存；恢复 = 停服 + 删 `.next` + 重启）。
- 本项目无测试框架（沿用现状，不新引入）：每任务验证 = `npx tsc --noEmit` + curl/node 脚本断言 + 浏览器目检；计划中的验证步骤给出确切命令与期望结果。
- 主站验证用 dev server（端口 3000），admin 用 3100。
- 迁移当天站点渲染输出必须与迁移前一字不差（价格/文案/上下架全对齐 seed 数据）。
- **开发期间绝不对 `canvas-scratcher` / `canvas-print` 执行改价**（改价会归档旧 Stripe Price，而生产还在跑读常量的旧代码，归档会弄断生产结算）。改价功能验证一律用新建的测试商品。主站部署后此限制解除。
- 环境变量全部复用根 `.env.local`（已有 STRIPE_SECRET_KEY / SUPABASE_URL / SUPABASE_SECRET_KEY / SUPABASE_DB_PASSWORD / ADMIN_SECRET / NEXT_PUBLIC_URL 等），不新增变量、不复制文件。
- git 提交信息末尾带 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`。

---

### Task 1: products 表迁移 + seed + 扣库存 RPC

**Files:**
- Create: `supabase/migrations/0005_products.sql`

**Interfaces:**
- Produces: `public.products` 表（列见下）；`public.decrement_stock(p_handle text, p_qty int)` 函数；6 行 seed 数据。
- 后续所有任务依赖表结构：`handle/title/tagline/price_cents/image/stripe_product_id/stripe_price_id/stock/available/numbered/sort/created_at/updated_at`。

- [ ] **Step 1: 写迁移 SQL**

```sql
-- Roomie · products 表：商品唯一事实源从代码常量迁入 DB（admin-platform，2026-07-13）。
-- 设计见 docs/superpowers/specs/2026-07-13-local-admin-design.md。
-- stock 语义：NULL = 不限量/不跟踪（迁移前行为）；数字 = 严格跟踪；0 = 售罄。
-- RLS 开且无策略 = 仅服务端 secret key 可达（同 orders/waitlist 先例）。

create table if not exists public.products (
  handle            text primary key,
  title             text not null,
  tagline           text not null default '',
  price_cents       integer not null check (price_cents >= 0),
  image             text not null default '',
  stripe_product_id text,
  stripe_price_id   text,
  stock             integer,
  available         boolean not null default false,
  numbered          boolean not null default false,
  sort              integer not null default 100,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

drop trigger if exists products_updated_at on public.products;
create trigger products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

alter table public.products enable row level security;

-- webhook 原子扣库存（PostgREST 的 update 只能 set 常量，表达式必须走函数）。
-- 只扣跟踪中的商品；允许出现瞬时负数（并发竞态），admin 界面红色警报提示。
create or replace function public.decrement_stock(p_handle text, p_qty int)
returns void language sql as $$
  update public.products
  set stock = stock - p_qty
  where handle = p_handle and stock is not null;
$$;

-- Seed：现有 lib/catalog.ts CATALOG + lib/shopify.ts MOCK_PRODUCTS 原样搬入。
-- stock 全 NULL = 不限量，保证迁移当天站点行为零变化。
-- canvas-house 的 Stripe price 已存在（AU$189 占位）但保持 waitlist（available=false）。
insert into public.products
  (handle, title, tagline, price_cents, image, stripe_product_id, stripe_price_id, stock, available, numbered, sort)
values
  ('canvas-scratcher', 'The Canvas Scratcher',
   'A framed print your cat is allowed to ruin. Slowly.',
   8900, '/c01/print-01.webp', null, 'price_1TsHxoDzmUuzRpRKdgcL52kJ', null, true, false, 10),
  ('canvas-print', 'Swap-in Print',
   'A fresh canvas for the frame you already have.',
   3500, '/c01/print-02.webp', null, 'price_1TsHxpDzmUuzRpRKRnGBcpHp', null, true, false, 20),
  ('canvas-house', 'The Canvas House',
   'The canvas, folded into a den.',
   18900, '/c01/house-poster.jpg', null, 'price_1TsHxqDzmUuzRpRKebu6oZDS', null, false, false, 30),
  ('nook-house', 'The Nook',
   'Side table outside. Cat cave inside.',
   14900, '/collection/nook.svg', null, null, null, false, false, 40),
  ('cloud-perch', 'Cloud Perch',
   'A window seat for professional sunbeam inspectors.',
   11900, '/collection/perch.svg', null, null, null, false, false, 50),
  ('wave-bowls', 'Wave Bowls',
   'Ceramic dinnerware that can stay on the table.',
   5900, '/collection/bowls.svg', null, null, null, false, false, 60)
on conflict (handle) do nothing;
```

- [ ] **Step 2: 跑迁移**

Run: `npm run db:migrate`
Expected: `apply 0005_products.sql ✓` + `migrations up to date`

- [ ] **Step 3: 验证表与数据**

Run:
```bash
node -e '
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
for (const l of fs.readFileSync(".env.local","utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
}
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
db.from("products").select("handle,price_cents,stock,available").order("sort").then(({data,error}) => {
  if (error) throw error;
  console.table(data);
  if (data.length !== 6) throw new Error("expected 6 rows");
  console.log("OK");
});'
```
Expected: 6 行表格（scratcher 8900 / print 3500 / house 18900 / nook 14900 / perch 11900 / bowls 5900），全部 `stock: null`，前两行 `available: true`，输出 `OK`。

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0005_products.sql
git commit -m "DB: products table + seed + decrement_stock RPC"
```

---

### Task 2: catalog 新 API（渐进引入，暂不删旧 CATALOG）

**Files:**
- Modify: `lib/catalog.ts`（新增 DB 读取 API；旧 `CATALOG` 常量本任务保留，Task 6 删）
- Modify: `lib/supabase-admin.ts`（新增 `ProductRow` 类型）

**Interfaces:**
- Produces（后续任务全部依赖，签名必须一字不差）:
  - `interface CatalogItem { handle: string; title: string; tagline: string; priceCents: number; image: string; stripeProductId: string | null; stripePriceId: string | null; stock: number | null; available: boolean; numbered: boolean; sort: number }`
  - `getCatalog(): Promise<CatalogItem[]>`（sort 升序，全量含未上架）
  - `getCatalogMap(): Promise<Map<string, CatalogItem>>`
  - `isSoldOut(i: CatalogItem): boolean`（`stock !== null && stock <= 0`）
  - `canBuy(i: CatalogItem): boolean`（`available && !!stripePriceId && !isSoldOut(i)`）
  - `ProductRow`（supabase-admin）：表行 snake_case 原样。
- 保持不变：`SHIPPING`、`shippingCentsFor`、`formatCents`、（暂时）`CATALOG`。

- [ ] **Step 1: supabase-admin.ts 加 ProductRow**

在 `OrderRow` 接口后追加：

```ts
export interface ProductRow {
  handle: string;
  title: string;
  tagline: string;
  price_cents: number;
  image: string;
  stripe_product_id: string | null;
  stripe_price_id: string | null;
  /** null = 不限量/不跟踪；0 = 售罄（负数 = 并发竞态，admin 警报） */
  stock: number | null;
  available: boolean;
  numbered: boolean;
  sort: number;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 2: catalog.ts 新增 DB API**

文件头注释改为说明新架构，`CatalogHandle`/`CatalogItem`/`CATALOG` 旧段保留在文件底部（标注 `/* ―― 旧常量层，迁移期间保留，admin-platform Task 6 删除 ―― */`）。新增：

```ts
import { getSupabaseAdmin, type ProductRow } from "./supabase-admin";

/*
 * 商品唯一事实源 = Supabase products 表（admin-platform，2026-07-13 起）。
 * 本模块是主站读取入口（仅服务端）；写入只发生在本地 admin 后台。
 * stock 语义：null = 不限量；0 = 售罄；服务端结算一律从这里 re-derive。
 */

export interface CatalogItem {
  handle: string;
  title: string;
  tagline: string;
  priceCents: number;
  image: string;
  stripeProductId: string | null;
  stripePriceId: string | null;
  stock: number | null;
  available: boolean;
  numbered: boolean;
  sort: number;
}

const fromRow = (r: ProductRow): CatalogItem => ({
  handle: r.handle,
  title: r.title,
  tagline: r.tagline,
  priceCents: r.price_cents,
  image: r.image,
  stripeProductId: r.stripe_product_id,
  stripePriceId: r.stripe_price_id,
  stock: r.stock,
  available: r.available,
  numbered: r.numbered,
  sort: r.sort,
});

/** 全量商品（含未上架），sort 升序。DB 不可达时抛错 → 页面 error boundary。 */
export async function getCatalog(): Promise<CatalogItem[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("products")
    .select("*")
    .order("sort", { ascending: true });
  if (error) throw new Error(`products 读取失败: ${error.message}`);
  return (data as ProductRow[]).map(fromRow);
}

export async function getCatalogMap(): Promise<Map<string, CatalogItem>> {
  return new Map((await getCatalog()).map((i) => [i.handle, i]));
}

export const isSoldOut = (i: CatalogItem): boolean =>
  i.stock !== null && i.stock <= 0;

/** 可购 = 上架 + 已接 Stripe + 未售罄（checkout 的唯一判定） */
export const canBuy = (i: CatalogItem): boolean =>
  i.available && !!i.stripePriceId && !isSoldOut(i);
```

注意：旧 `CatalogItem` 接口与新接口同名冲突 —— 旧段的接口重命名为 `LegacyCatalogItem`（`CATALOG: Record<CatalogHandle, LegacyCatalogItem>`），消费方只用字段不引用旧接口名（grep 确认 `CatalogItem` 无外部 import 后再动）。

- [ ] **Step 3: 类型检查**

Run: `npx tsc --noEmit`
Expected: 零错误（旧消费方不受影响）。

- [ ] **Step 4: Commit**

```bash
git add lib/catalog.ts lib/supabase-admin.ts
git commit -m "Catalog: DB-backed getCatalog API alongside legacy constants"
```

---

### Task 3: 服务端交易链路迁移（checkout 库存校验 / webhook 扣减 / email）

**Files:**
- Modify: `app/api/checkout/route.ts`
- Modify: `app/api/webhook/route.ts`
- Modify: `lib/email.ts`

**Interfaces:**
- Consumes: `getCatalogMap` / `canBuy` / `isSoldOut` / `CatalogItem`（Task 2）；`decrement_stock` RPC（Task 1）。
- Produces: `/api/checkout` 新增 409 响应 `{ error: "sold_out", handle: string, title: string }`（库存不足或不可购时）。Task 4 的 useCheckout 依赖此结构。

- [ ] **Step 1: checkout route 改查表 + 库存校验**

`app/api/checkout/route.ts` 整体替换 CATALOG 逻辑（imports 改为 `import { getCatalogMap, canBuy, shippingCentsFor } from "@/lib/catalog";`，删除 `CatalogHandle`）：

```ts
interface InLine {
  handle: string;
  variant?: string;
  qty?: number;
}

export async function POST(req: NextRequest) {
  let body: { lines?: InLine[] };
  try {
    body = (await req.json()) as { lines?: InLine[] };
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const catalog = await getCatalogMap();
  const input = (body.lines ?? []).filter(
    (l): l is InLine =>
      !!l && typeof l === "object" && typeof l.handle === "string" && catalog.has(l.handle),
  );
  if (input.length === 0 || input.length > 20) {
    return NextResponse.json({ error: "empty or oversized cart" }, { status: 400 });
  }

  // 规范化：数量 1..9；编号件恒 1
  const lines = input.map((l) => {
    const item = catalog.get(l.handle)!;
    return {
      item,
      variant: typeof l.variant === "string" ? l.variant.slice(0, 40) : undefined,
      qty: item.numbered ? 1 : Math.min(9, Math.max(1, Math.round(l.qty ?? 1))),
    };
  });

  // 可购与库存校验（合并同 handle 的数量后再比库存）
  const qtyByHandle = new Map<string, number>();
  for (const l of lines) {
    qtyByHandle.set(l.item.handle, (qtyByHandle.get(l.item.handle) ?? 0) + l.qty);
  }
  for (const [handle, qty] of qtyByHandle) {
    const item = catalog.get(handle)!;
    if (!canBuy(item) || (item.stock !== null && qty > item.stock)) {
      return NextResponse.json(
        { error: "sold_out", handle, title: item.title },
        { status: 409 },
      );
    }
  }
  ...
```

后续 snapshot/subtotal/session 段落中 `CATALOG[l.handle].priceCents` → `l.item.priceCents`，`CATALOG[l.handle].stripePriceId` → `l.item.stripePriceId!`（canBuy 已保证非空），metadata snapshot 的 `h: l.handle` → `h: l.item.handle`。其余（运费/shipping_options/成功取消 URL）不动。

- [ ] **Step 2: webhook 改查表 + 扣库存**

`app/api/webhook/route.ts`：
- import 改为 `import { getCatalogMap } from "@/lib/catalog";`
- `itemsFromSession` 里 `c.h in CATALOG` 的分支替换：

```ts
async function itemsFromSession(
  session: Stripe.Checkout.Session,
): Promise<OrderItem[]> {
  try {
    const cart = JSON.parse(session.metadata?.cart ?? "") as {
      h: string;
      v?: string;
      q?: number;
    }[];
    if (Array.isArray(cart) && cart.length > 0) {
      const catalog = await getCatalogMap();
      const known = cart.filter((c) => catalog.has(c.h));
      if (known.length > 0) {
        return known.map((c) => {
          const item = catalog.get(c.h)!;
          return {
            handle: item.handle,
            title: item.title,
            variant: c.v || undefined,
            qty: Math.max(1, c.q ?? 1),
            unit_cents: item.priceCents,
          };
        });
      }
    }
  } catch {
    /* 快照缺失/超限 → 兜底 */
  }
  // ... Stripe line_items 兜底原样保留
```

- `recordOrder` 里首次插入成功分支（`if (inserted)`）追加扣库存（在 `sendOrderConfirmation` 之前）：

```ts
      if (inserted) {
        // 原子扣库存（只扣 stock 非 null 的跟踪商品；重复事件走不到这里）
        for (const it of inserted.items) {
          const { error: decErr } = await getSupabaseAdmin().rpc("decrement_stock", {
            p_handle: it.handle,
            p_qty: it.qty,
          });
          if (decErr) {
            console.error("[webhook] 扣库存失败:", it.handle, decErr.message);
          }
        }
        await sendOrderConfirmation(inserted); // 内部吞错，邮件不阻断订单
      }
```

- [ ] **Step 3: email.ts 改查表**

`lib/email.ts`：删除 `import { CATALOG, ..., type CatalogHandle }` 中的 CATALOG/CatalogHandle（保留 `formatCents`），`itemThumb` 改为接收 catalog map：

```ts
import { formatCents, getCatalogMap, type CatalogItem } from "./catalog";

/** 行缩略图（绝对 URL）：画芯 variant 对应画作平面稿，其余用商品图 */
function itemThumb(it: OrderItem, catalog: Map<string, CatalogItem>): string | null {
  const i = ARTWORKS.findIndex((a) => a.title === it.variant);
  if (i >= 0) return `${base()}/hero/art/flat-0${i + 1}.png`;
  const cat = catalog.get(it.handle);
  return cat?.image ? `${base()}${cat.image}` : null;
}
```

（原 `canvas-house` 硬编码分支删除 —— house 的 image 已在表里。）调用方 `sendOrderConfirmation` / `sendShippingNotice` 内在渲染 items 前 `const catalog = await getCatalogMap();` 并传入 `itemThumb(it, catalog)`。

- [ ] **Step 4: 类型检查 + 行为验证**

Run: `npx tsc --noEmit`
Expected: 零错误。

Run（dev server 已起 `npm run dev`，另开终端）:
```bash
# 合法请求 → 返回 Stripe URL
curl -s -X POST localhost:3000/api/checkout -H 'Content-Type: application/json' \
  -d '{"lines":[{"handle":"canvas-scratcher","qty":1}]}' | head -c 120; echo
# 未知 handle → 400
curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:3000/api/checkout \
  -H 'Content-Type: application/json' -d '{"lines":[{"handle":"nope","qty":1}]}'
# 未上架（canvas-house available=false）→ 409
curl -s -X POST localhost:3000/api/checkout -H 'Content-Type: application/json' \
  -d '{"lines":[{"handle":"canvas-house","qty":1}]}'
```
Expected: 第一条输出含 `https://checkout.stripe.com`；第二条 `400`；第三条 `{"error":"sold_out","handle":"canvas-house","title":"The Canvas House"}`。

再验库存挡板（临时把 print 库存置 1 再还原）：
```bash
node -e '
const { createClient } = require("@supabase/supabase-js"); const fs = require("fs");
for (const l of fs.readFileSync(".env.local","utf8").split("\n")) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2]; }
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
db.from("products").update({stock: 1}).eq("handle","canvas-print").then(() => console.log("stock=1"));'
curl -s -X POST localhost:3000/api/checkout -H 'Content-Type: application/json' \
  -d '{"lines":[{"handle":"canvas-print","qty":2}]}'   # qty 2 > stock 1
node -e '... db.from("products").update({stock: null}).eq("handle","canvas-print") ...（同上模板还原）'
```
Expected: 中间 curl 返回 409 `sold_out`；最后还原 `stock=null`。

- [ ] **Step 5: Commit**

```bash
git add app/api/checkout/route.ts app/api/webhook/route.ts lib/email.ts
git commit -m "Checkout/webhook/email re-derive from products table; stock check + atomic decrement"
```

---

### Task 4: 客户端购物车数据流（layout 注入 catalog 快照）

**Files:**
- Modify: `app/layout.tsx`
- Modify: `components/CartContext.tsx`
- Modify: `components/cart/CartDrawer.tsx`
- Modify: `components/cart/CartView.tsx`
- Modify: `components/cart/lineImage.ts`
- Modify: `components/cart/useCheckout.ts`

**Interfaces:**
- Consumes: `getCatalog` / `isSoldOut`（Task 2）；checkout 409 结构（Task 3）。
- Produces（Task 5 依赖）:
  - `interface ClientCatalogItem { handle: string; title: string; priceCents: number; image: string; numbered: boolean; soldOut: boolean }`（export 自 CartContext）
  - `CartProvider({ catalog, children }: { catalog: ClientCatalogItem[]; children: React.ReactNode })`
  - context 新增字段 `catalog: Record<string, ClientCatalogItem>`
  - `CartLine.handle` 类型放宽为 `string`
  - `lineImage(line: CartLine, image: string): string`

- [ ] **Step 1: layout.tsx 查表并注入（全站转动态）**

```tsx
import { getCatalog, isSoldOut } from "@/lib/catalog";
import { CartProvider, type ClientCatalogItem } from "@/components/CartContext";

/*
 * 商品数据来自 Supabase（admin 后台可改价/库存）——必须显式动态渲染，
 * 否则构建时预渲染会把旧价格烧进静态 HTML。
 */
export const dynamic = "force-dynamic";
```

RootLayout 改 async，body 内：

```tsx
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
```

（顺带删掉 body 内那段 `TODO(Shopify)` 注释——Shopify 路线已废。）

- [ ] **Step 2: CartContext 改 props 驱动**

`components/CartContext.tsx`：
- 删除 `import { CATALOG, type CatalogHandle } from "@/lib/catalog";`
- 新增导出类型 + CartLine 放宽：

```ts
export interface ClientCatalogItem {
  handle: string;
  title: string;
  priceCents: number;
  image: string;
  numbered: boolean;
  soldOut: boolean;
}

export interface CartLine {
  key: string; // `${handle}::${variant ?? ""}`
  handle: string;
  variant?: string;
  qty: number;
}
```

- `CartState` 增加 `catalog: Record<string, ClientCatalogItem>;`（默认值 `{}`）。
- `sanitize` 移进 Provider 内（依赖 catalog）或改为参数化：

```ts
function sanitize(raw: unknown, catalog: Record<string, ClientCatalogItem>): CartLine[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (l): l is CartLine =>
        !!l &&
        typeof l === "object" &&
        typeof (l as CartLine).handle === "string" &&
        (l as CartLine).handle in catalog &&
        typeof (l as CartLine).qty === "number",
    )
    .map((l) => ({
      key: keyOf(l.handle, l.variant),
      handle: l.handle,
      variant: l.variant,
      qty: Math.min(9, Math.max(1, Math.round(l.qty))),
    }));
}
```

- Provider 签名与内部：

```tsx
export function CartProvider({
  catalog: catalogList,
  children,
}: {
  catalog: ClientCatalogItem[];
  children: React.ReactNode;
}) {
  const catalog = useMemo(
    () => Object.fromEntries(catalogList.map((i) => [i.handle, i])),
    [catalogList],
  );
```

（`useMemo` 加进 react import。）localStorage 恢复处 `sanitize(JSON.parse(raw), catalog)`。

- `add` 里 `const item = CATALOG[handle]` → `const item = catalog[handle]`；开头加售罄挡板：

```ts
      if (!item) return;
      if (item.soldOut) {
        showToast(item.title, "is sold out right now", "check back soon, small batches move fast");
        return;
      }
```

- `subtotalCents` 计算 → `catalog[l.handle]?.priceCents ?? 0`。
- context value 加 `catalog`。
- `<CartDrawer ... catalog={catalog} />` 传入。

- [ ] **Step 3: CartDrawer / CartView / lineImage 改 catalog 来源**

`CartDrawer.tsx`：props 加 `catalog: Record<string, ClientCatalogItem>`（import type 从 CartContext），删除 `CATALOG` import（保留 formatCents/SHIPPING/shippingCentsFor）。行渲染：

```tsx
              {lines.map((l) => {
                const item = catalog[l.handle];
                if (!item) return null;
                return (
                  ...
                      <img src={lineImage(l, item.image)} alt="" loading="lazy" />
```

`CartView.tsx`：`const { lines, count, subtotalCents, setQty, remove, catalog } = useCart();` 同样替换 `CATALOG[l.handle]` → `catalog[l.handle]`（`if (!item) return null;` 防御），`lineImage(l, item.image)`。删除 CATALOG import。

`lineImage.ts`：

```ts
import type { CartLine } from "@/components/CartContext";
import { ARTWORKS } from "@/lib/heroConfig";

/** 购物篮行缩略图：画芯类 variant → 对应画作平面稿，否则用商品图 */
export function lineImage(line: CartLine, image: string): string {
  if (!line.variant) return image;
  const i = ARTWORKS.findIndex((a) => a.title === line.variant);
  return i >= 0 ? `/hero/art/flat-0${i + 1}.png` : image;
}
```

- [ ] **Step 4: useCheckout 处理 409**

`checkout` 函数 try 内改为：

```ts
      const data = (await res.json()) as {
        url?: string;
        error?: string;
        title?: string;
      };
      if (res.status === 409 && data.title) {
        setErr(`${data.title} just sold out. Remove it from the basket to continue.`);
        setBusy(false);
        return;
      }
      if (!res.ok || !data.url) throw new Error(data.error ?? "no url");
      window.location.assign(data.url);
```

- [ ] **Step 5: 验证**

Run: `npx tsc --noEmit` → 零错误。

浏览器（localhost:3000）：/scratcher 加购两种规格 → 篮子抽屉行/价/图正常、步进正常；/cart 整页一致；点击 Checkout 跳到 Stripe 托管页（可即关）。
售罄路径：SQL 把 canvas-print stock 置 0（同 Task 3 的 node 模板）→ 刷新首页 → 从 PDP 尝试加购 print → toast "is sold out right now" 不入篮；还原 stock=null。

- [ ] **Step 6: Commit**

```bash
git add app/layout.tsx components/CartContext.tsx components/cart/
git commit -m "Cart runs on server-injected catalog snapshot; sold-out guard + 409 message"
```

---

### Task 5: 页面与文案价格注入（PDP / landing / care / hero）

**Files:**
- Modify: `app/scratcher/page.tsx`、`components/pdp/ScratcherShop.tsx`
- Modify: `app/house/page.tsx`、`components/pdp/HouseShop.tsx`
- Modify: `app/page.tsx`、`components/Hero/Hero.tsx`、`components/Hero/HeroCopy.tsx`、`lib/heroConfig.ts`
- Modify: `components/sections/CanvasCollection.tsx`、`components/sections/FinalCta.tsx`、`components/sections/TheShelf.tsx`
- Modify: `app/care/page.tsx`

**Interfaces:**
- Consumes: `getCatalog` / `getCatalogMap` / `formatCents` / `isSoldOut`（Task 2）。
- Produces:
  - `interface OfferInfo { priceCents: number; soldOut: boolean }`（export 自 ScratcherShop）
  - `ScratcherShop({ full, print }: { full: OfferInfo; print: OfferInfo })`
  - `HouseShop({ priceCents }: { priceCents: number })`
  - `Hero({ priceText }: { priceText: string })`、`HeroCopy({ priceText }: { priceText: string })`
  - `HERO_COPY.ctaNote` 变为 `(price: string) => string`

- [ ] **Step 1: ScratcherShop 接收 props + 售罄态**

```tsx
export interface OfferInfo {
  priceCents: number;
  soldOut: boolean;
}

export default function ScratcherShop({
  full,
  print,
}: {
  full: OfferInfo;
  print: OfferInfo;
}) {
```

- 删除 `const PRICE: Record<Format, string> = ...` 与其 TODO 注释；新增派生（import `formatCents` 自 `@/lib/catalog`——纯函数，客户端可用）：

```tsx
  const offer: Record<Format, OfferInfo> = { full, print };
  const price = (f: Format) => formatCents(offer[f].priceCents);
  const soldOut = offer[format].soldOut;
```

- 两个 format radio 的 `<em>AU$89</em>` / `<em>AU$35</em>` → `<em>{price("full")}</em>` / `<em>{price("print")}</em>`；radio 内售罄时在 `<span>` 行加注：`<span>{full.soldOut ? "sold out right now" : "the full piece, ready to lean"}</span>`（print 同理：`a fresh canvas for your frame`）。
- 购买行价格 `{PRICE[format]}` → `{price(format)}`；按钮：

```tsx
              <button className="btnPrimary" onClick={addToBasket} disabled={soldOut}>
                {soldOut ? "Sold out" : "Add to basket"}
              </button>
```

- sticky bar：`{PRICE[format]} · ships AU-wide` → `{price(format)} · ships AU-wide`；按钮同样 `disabled={soldOut}`，文案同上。

- [ ] **Step 2: scratcher 页面查表传参**

`app/scratcher/page.tsx` 组件改 async：

```tsx
import { formatCents, getCatalogMap, isSoldOut } from "@/lib/catalog";

export default async function ScratcherPage() {
  const catalog = await getCatalogMap();
  const scratcher = catalog.get("canvas-scratcher")!;
  const print = catalog.get("canvas-print")!;
  const offer = (i: typeof scratcher) => ({
    priceCents: i.priceCents,
    soldOut: isSoldOut(i),
  });
```

- `<ScratcherShop full={offer(scratcher)} print={offer(print)} />`
- 换画区那句改为：`Spare prints are {formatCents(print.priceCents)} each, sold on their own.`

- [ ] **Step 3: HouseShop + house 页**

`HouseShop.tsx`：

```tsx
import { formatCents } from "@/lib/catalog";

export default function HouseShop({ priceCents }: { priceCents: number }) {
```

价格行 `AU$189 <em>...` → `{formatCents(priceCents)} <em>expected · no charge to join</em>`。

`app/house/page.tsx` 改 async：

```tsx
import { formatCents, getCatalogMap } from "@/lib/catalog";

export default async function HousePage() {
  const catalog = await getCatalogMap();
  const house = catalog.get("canvas-house")!;
  const scratcher = catalog.get("canvas-scratcher")!;
```

- `<HouseShop priceCents={house.priceCents} />`
- CrossSell `blurb={`The original leaning print. Same canvases, same pine, ${formatCents(scratcher.priceCents)}.`}`

- [ ] **Step 4: hero 文案链**

`lib/heroConfig.ts`：

```ts
  cta: "Shop the Canvas Scratcher", // TODO 最终文案待定
  ctaNote: (price: string) => `${price} · swappable prints · ships AU-wide`,
```

`components/Hero/HeroCopy.tsx`：组件签名加 `{ priceText }: { priceText: string }`，渲染处 `{HERO_COPY.ctaNote(priceText)}`。
`components/Hero/Hero.tsx`：签名加 `{ priceText }: { priceText: string }`，下传 `<HeroCopy priceText={priceText} />`（找到现有 `<HeroCopy` 调用点加 prop；Hero 其余不动）。
`app/page.tsx` 改 async：

```tsx
import { formatCents, getCatalogMap } from "@/lib/catalog";

export default async function Page() {
  const catalog = await getCatalogMap();
  const price = (h: string) => formatCents(catalog.get(h)?.priceCents ?? 0);
  return (
    ...
        <Hero priceText={price("canvas-scratcher")} />
```

- [ ] **Step 5: landing server 组件直接查表**

`CanvasCollection.tsx`（server 组件，改 async 自查）：

```tsx
import { formatCents, getCatalogMap } from "@/lib/catalog";

export default async function CanvasCollection() {
  const catalog = await getCatalogMap();
  const price = (h: string) => formatCents(catalog.get(h)?.priceCents ?? 0);
```

- 清单卡 `AU$89 · shipping now` → `{price("canvas-scratcher")} · shipping now`
- `AU$35 each · seasonal drops` → `{price("canvas-print")} each · seasonal drops`
- PortalCard `kicker="AU$89 · six prints"` → `` kicker={`${price("canvas-scratcher")} · six prints`} ``

`FinalCta.tsx` 同法 async：`The Scratcher · {price("canvas-scratcher")}`。

`TheShelf.tsx`：`import { getProducts } from "@/lib/shopify";` → `import { formatCents, getCatalog } from "@/lib/catalog";`：

```tsx
  const products = await getCatalog();
  const soon = products.filter((p) => !p.available);
  const price = (h: string) =>
    formatCents(products.find((p) => p.handle === h)?.priceCents ?? 0);
```

- `two pieces, six prints · from AU$89` → `` two pieces, six prints · from {price("canvas-scratcher")} ``
- `The Scratcher <em>AU$89</em>` → `<em>{price("canvas-scratcher")}</em>`
- `Swap-in prints <em>AU$35</em>` → `<em>{price("canvas-print")}</em>`
- soon 卡消费字段 `p.tagline` / `p.image` / `p.title` / `p.handle` 与 CatalogItem 对齐（字段同名，无需改）。

`app/care/page.tsx` 改 async 查表：`swap in a fresh one for {formatCents(print.priceCents)}`（取 `canvas-print`）。

- [ ] **Step 6: 验证（渲染一字不差）**

Run: `npx tsc --noEmit` → 零错误。

dev server 目检 4 页（/, /scratcher, /house, /care）：所有价格位置显示与改造前相同（AU$89 / AU$35 / AU$189）；hero CTA 注、清单卡、门户卡、FinalCta、TheShelf featured 链接、swap 区、care 链接逐一核对。
改价传导验证：SQL 把 scratcher `price_cents` 置 9900 → 刷新 4 页 → 所有 AU$89 位置变 AU$99 → SQL 还原 8900 → 复原确认。

- [ ] **Step 7: Commit**

```bash
git add app/ components/ lib/heroConfig.ts
git commit -m "All displayed prices derive from products table; sold-out state on scratcher PDP"
```

---

### Task 6: 旧常量退役 + waitlist 查表 + error boundary

**Files:**
- Modify: `lib/catalog.ts`（删旧段）
- Delete: `lib/shopify.ts`
- Modify: `app/api/waitlist/route.ts`
- Create: `app/error.tsx`

**Interfaces:**
- Consumes: 前五个任务已把所有消费方迁到新 API。
- Produces: `lib/catalog.ts` 从此只含 DB API + SHIPPING/formatCents；`CATALOG`/`CatalogHandle`/`LegacyCatalogItem`/`getProducts` 不复存在。

- [ ] **Step 1: 确认无残留引用**

Run: `grep -rn "CATALOG\b\|CatalogHandle\|lib/shopify" --include="*.ts" --include="*.tsx" app components lib | grep -v "lib/catalog.ts"`
Expected: 无输出（有则先迁移漏网处再继续）。

- [ ] **Step 2: 删除旧段**

- `lib/catalog.ts`：删除 `LegacyCatalogItem`、`CATALOG`、`CatalogHandle` 及配套注释（保留新 API + `formatCents` + `SHIPPING` + `shippingCentsFor`；文件头注释更新为「唯一事实源 = products 表；写入走本地 admin」）。
- `git rm lib/shopify.ts`

- [ ] **Step 3: waitlist route 改查表**

`app/api/waitlist/route.ts`：删除 `VALID_HANDLES` 常量，改为：

```ts
import { getCatalogMap } from "@/lib/catalog";
```

```ts
  const email = (body.email ?? "").trim().toLowerCase();
  const handle = body.handle ?? "";
  // waitlist 只对「存在且未上架」的商品开放（上架商品直接购买）
  const item = (await getCatalogMap()).get(handle);
  if (!item || item.available) {
    return NextResponse.json({ error: "unknown product" }, { status: 400 });
  }
```

- [ ] **Step 4: 根 error boundary**

Create `app/error.tsx`（DB 不可达等运行时错误的品牌化兜底；纯英文、无长破折号）：

```tsx
"use client";

/* 全站错误兜底：products 表不可达等场景。品牌化、可重试。 */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main
      style={{
        minHeight: "70vh",
        display: "grid",
        placeItems: "center",
        textAlign: "center",
        padding: "4rem 1.5rem",
        fontFamily: "var(--font-body, sans-serif)",
      }}
    >
      <div>
        <p style={{ letterSpacing: ".14em", textTransform: "uppercase", fontWeight: 700, fontSize: ".8rem", color: "#d4702a" }}>
          A small tangle
        </p>
        <h1 style={{ fontFamily: "var(--font-display, sans-serif)", color: "#12275e", margin: ".4em 0" }}>
          The shop slipped off the shelf.
        </h1>
        <p style={{ color: "#5c5a55", maxWidth: "34rem" }}>
          Something on our side needs a moment. Give it another try, it usually rights itself.
        </p>
        <button
          onClick={reset}
          style={{ marginTop: "1.4rem", padding: ".8rem 1.6rem", borderRadius: "999px", border: 0, background: "#e8863c", color: "#fff", fontWeight: 700, cursor: "pointer" }}
        >
          Try again
        </button>
      </div>
    </main>
  );
}
```

- [ ] **Step 5: 全站验证 + 构建**

Run: `npx tsc --noEmit` → 零错误。
Run（先停 dev server）: `npm run build` → 构建成功；输出里 `/`、`/scratcher`、`/house`、`/cart` 等标记为 dynamic（ƒ），无 prerender 商品页。
重启 dev，Playwright（scratchpad 环境）截图 4 页与改造前对照目检；waitlist 表单（landing What's next 卡）提交一个测试邮箱 → 200；对 `canvas-scratcher`（available=true）POST /api/waitlist → 400。

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Retire legacy CATALOG constants and shopify mock; waitlist validates against table"
```

---

### Task 7: admin 应用脚手架（认证 + 安全层 + 空页面）

**Files:**
- Create: `admin/package.json`、`admin/tsconfig.json`、`admin/next.config.ts`、`admin/next-env.d.ts`（next 自动生成）
- Create: `admin/middleware.ts`、`admin/lib/auth.ts`、`admin/lib/db.ts`、`admin/lib/stripe.ts`、`admin/lib/types.ts`
- Create: `admin/app/layout.tsx`、`admin/app/globals.css`、`admin/app/login/page.tsx`、`admin/app/page.tsx`、`admin/app/orders/page.tsx`、`admin/app/waitlist/page.tsx`
- Modify: 根 `tsconfig.json`（exclude admin）、根 `package.json`（scripts.admin）、`.gitignore`（如无通配则加 admin/.next）

**Interfaces:**
- Produces（Task 8-10 依赖）:
  - `db(): SupabaseClient`（admin/lib/db.ts）
  - `stripe(): Stripe`（admin/lib/stripe.ts）
  - `sessionToken(): Promise<string>`、`assertAuth(): Promise<void>`（admin/lib/auth.ts）
  - `ProductRow` / `OrderRow` / `OrderItem` / `WaitlistRow` 类型（admin/lib/types.ts，与主站 supabase-admin.ts 的定义保持字段一致）
  - 认证 cookie 名 `admin_auth`；允许 Host：`127.0.0.1:3100` / `localhost:3100`。

- [ ] **Step 1: 应用骨架文件**

`admin/package.json`：

```json
{
  "name": "roomie-admin",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev -H 127.0.0.1 -p 3100",
    "build": "next build"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.110.2",
    "next": "^15.5.6",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "stripe": "^22.3.1"
  },
  "devDependencies": {
    "@types/node": "^22",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "typescript": "^5"
  }
}
```

`admin/tsconfig.json`：复制根 tsconfig，`paths` 改 `{"@/*": ["./*"]}`（无跨目录 import）。

`admin/next.config.ts`（密钥单一来源 = 根 .env.local）：

```ts
import { readFileSync } from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

/*
 * admin 永不部署，只在店主本机跑（127.0.0.1:3100）。
 * 密钥从仓库根 .env.local 读，不复制、不新增文件。
 */
const envPath = path.join(__dirname, "..", ".env.local");
try {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
} catch {
  console.warn("[admin] ../.env.local 不存在，密钥缺失时运行期会报错");
}

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
};
export default nextConfig;
```

根 `tsconfig.json`：`"exclude": ["node_modules", "admin"]`。
根 `package.json` scripts 加：`"admin": "npm --prefix admin run dev"`（首次使用前 `npm --prefix admin install`）。
`.gitignore` 确认 `node_modules` 与 `.next` 是无斜杠模式（匹配 admin 内层）；不是则补 `admin/node_modules/`、`admin/.next/`。

- [ ] **Step 2: 认证与客户端**

`admin/lib/auth.ts`：

```ts
import { cookies } from "next/headers";

/*
 * 口令层：复用生产已有的 ADMIN_SECRET（.env.local）。
 * cookie 值 = sha256("roomie-admin-session:" + secret)，无状态、重启不失效；
 * middleware（edge）与 server actions（node）都用 Web Crypto 计算同一值。
 */
export async function sessionToken(): Promise<string> {
  const secret = process.env.ADMIN_SECRET ?? "";
  if (!secret) throw new Error("ADMIN_SECRET missing in root .env.local");
  const data = new TextEncoder().encode(`roomie-admin-session:${secret}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** server action 纵深防御：middleware 之外再验一次 cookie */
export async function assertAuth(): Promise<void> {
  const got = (await cookies()).get("admin_auth")?.value;
  if (!got || got !== (await sessionToken())) throw new Error("unauthorized");
}
```

`admin/lib/db.ts`：

```ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;
export function db(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SECRET_KEY missing (root .env.local)");
  client ??= createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
```

`admin/lib/stripe.ts`：

```ts
import Stripe from "stripe";

let client: Stripe | null = null;
export function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY missing (root .env.local)");
  client ??= new Stripe(key);
  return client;
}

/** 界面提醒条用：当前 key 的模式（test/live）。改价建的 Price 会落在这个模式。 */
export function stripeMode(): "test" | "live" | "unknown" {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  if (key.startsWith("sk_test") || key.startsWith("rk_test")) return "test";
  if (key.startsWith("sk_live") || key.startsWith("rk_live")) return "live";
  return "unknown";
}
```

`admin/lib/types.ts`（与主站 `lib/supabase-admin.ts` 的 OrderRow/OrderItem、`ProductRow` 字段逐一对齐；admin 不跨目录 import 以免构建摩擦——两处结构同源于同一张表，漂移风险由「改表必改两处」注释提示）：

```ts
/* 与主站 lib/supabase-admin.ts 同构（表结构变更时两处同步改） */

export interface ProductRow {
  handle: string;
  title: string;
  tagline: string;
  price_cents: number;
  image: string;
  stripe_product_id: string | null;
  stripe_price_id: string | null;
  stock: number | null;
  available: boolean;
  numbered: boolean;
  sort: number;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  handle: string;
  title: string;
  variant?: string;
  qty: number;
  unit_cents: number;
}

export interface OrderRow {
  id: string;
  order_number: number;
  order_ref: string;
  stripe_session_id: string;
  stripe_payment_intent_id: string | null;
  email: string;
  customer_name: string | null;
  shipping_address: Record<string, unknown> | null;
  items: OrderItem[];
  amount_total: number;
  shipping_cents: number;
  currency: string;
  status: "paid" | "shipped" | "delivered";
  tracking_number: string | null;
  tracking_url: string | null;
  carrier: string | null;
  created_at: string;
  shipped_at: string | null;
  delivered_at: string | null;
  updated_at: string;
}

export interface WaitlistRow {
  id: string;
  email: string;
  product_handle: string;
  created_at: string;
}

export const formatCents = (cents: number) =>
  `AU$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
```

- [ ] **Step 3: middleware（Host 校验 + 认证门）**

`admin/middleware.ts`：

```ts
import { NextRequest, NextResponse } from "next/server";

/*
 * 两层网关（edge）：
 * 1. Host 白名单：防 DNS rebinding（恶意网页把自己的域名解析到 127.0.0.1，
 *    绕过浏览器同源限制打本地服务）。只认本机两种写法。
 * 2. 认证 cookie：无有效 admin_auth 一律去 /login。
 */
const ALLOWED_HOSTS = new Set(["127.0.0.1:3100", "localhost:3100"]);

async function expectedToken(): Promise<string | null> {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return null;
  const data = new TextEncoder().encode(`roomie-admin-session:${secret}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function middleware(req: NextRequest) {
  const host = req.headers.get("host") ?? "";
  if (!ALLOWED_HOSTS.has(host)) {
    return new NextResponse("forbidden", { status: 403 });
  }
  if (req.nextUrl.pathname.startsWith("/login")) return NextResponse.next();

  const want = await expectedToken();
  const got = req.cookies.get("admin_auth")?.value;
  if (!want || got !== want) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico).*)"],
};
```

- [ ] **Step 4: 布局、登录页、三个空页面**

`admin/app/globals.css`（工具风 + 品牌色 token；正文系统字体栈即可）：

```css
:root {
  --orange: #e8863c;
  --orange-deep: #d4702a;
  --blue: #3a5bc7;
  --navy: #12275e;
  --cream: #edeae3;
  --paper: #f8f6f0;
  --ink: #2e2e33;
  --ink-soft: #5c5a55;
  --line: #ddd8cd;
  --red: #c23b3b;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--cream);
  color: var(--ink);
  font: 15px/1.55 -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;
}
main { max-width: 1080px; margin: 0 auto; padding: 24px 20px 80px; }
h1 { font-size: 22px; color: var(--navy); margin: 18px 0 14px; }
h2 { font-size: 16px; color: var(--navy); margin: 26px 0 10px; }
table { width: 100%; border-collapse: collapse; background: var(--paper); border-radius: 12px; overflow: hidden; }
th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--line); vertical-align: middle; }
th { font-size: 12px; text-transform: uppercase; letter-spacing: .08em; color: var(--ink-soft); }
input, select { font: inherit; padding: 6px 8px; border: 1px solid var(--line); border-radius: 8px; background: #fff; }
button { font: inherit; font-weight: 700; padding: 7px 14px; border: 0; border-radius: 999px; background: var(--orange); color: #fff; cursor: pointer; }
button.ghost { background: transparent; color: var(--blue); border: 1px solid var(--line); }
button:disabled { opacity: .5; cursor: default; }
.nav { display: flex; gap: 18px; align-items: center; padding: 14px 20px; background: var(--paper); border-bottom: 1px solid var(--line); }
.nav a { color: var(--navy); text-decoration: none; font-weight: 700; }
.nav a.on { color: var(--orange-deep); }
.badge { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; }
.warn { color: var(--red); font-weight: 700; }
.mode { margin-left: auto; font-size: 12px; color: var(--ink-soft); }
```

`admin/app/layout.tsx`（nav + Stripe 模式提醒条）：

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { stripeMode } from "@/lib/stripe";

export const metadata: Metadata = {
  title: "Roomie Admin",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const mode = stripeMode();
  return (
    <html lang="en">
      <body>
        <nav className="nav">
          <strong style={{ color: "var(--orange-deep)" }}>Roomie Admin</strong>
          <Link href="/">Products</Link>
          <Link href="/orders">Orders</Link>
          <Link href="/waitlist">Waitlist</Link>
          <span className="mode">
            Stripe: <b>{mode}</b> · local only (127.0.0.1:3100)
          </span>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
```

`admin/app/login/page.tsx`：

```tsx
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { sessionToken } from "@/lib/auth";

/* 口令 = 生产 ADMIN_SECRET（.env.local）。httpOnly cookie，30 天。 */
async function login(formData: FormData) {
  "use server";
  const input = String(formData.get("secret") ?? "");
  if (!process.env.ADMIN_SECRET || input !== process.env.ADMIN_SECRET) {
    redirect("/login?bad=1");
  }
  (await cookies()).set("admin_auth", await sessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  redirect("/");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ bad?: string }>;
}) {
  const { bad } = await searchParams;
  return (
    <form action={login} style={{ maxWidth: 380, margin: "18vh auto 0", display: "grid", gap: 12 }}>
      <h1>Roomie Admin</h1>
      <input type="password" name="secret" placeholder="ADMIN_SECRET" autoFocus required />
      {bad && <p className="warn">Wrong secret.</p>}
      <button type="submit">Enter</button>
    </form>
  );
}
```

三个页面占位（Task 8-10 填充）：`admin/app/page.tsx` / `orders/page.tsx` / `waitlist/page.tsx` 各导出一个 async server component，暂渲 `<h1>Products</h1>` 等标题。

- [ ] **Step 5: 安装 + 启动验证**

```bash
npm --prefix admin install
npm run admin   # 起 127.0.0.1:3100（后台跑）
```

验证（另一终端）：
```bash
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3100/            # 307 → /login（无 cookie）
curl -s -o /dev/null -w '%{http_code}\n' -H 'Host: evil.example:3100' http://127.0.0.1:3100/   # 403（Host 白名单）
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3100/login       # 200
```
浏览器 http://127.0.0.1:3100 → 跳登录页 → 输错口令留在 login 带 "Wrong secret." → 输对进入 Products 占位页，nav 显示 `Stripe: test`。
局域网隔离：`lsof -nP -iTCP:3100 | grep LISTEN` → 绑定地址是 `127.0.0.1:3100`（不是 `*:3100`）。

- [ ] **Step 6: Commit**

```bash
git add admin/ tsconfig.json package.json .gitignore
git commit -m "Admin scaffold: local-only Next app, host allowlist + ADMIN_SECRET gate"
```

---

### Task 8: admin Products 页（改价 / 库存 / 上下架 / 文案 / 新增）

**Files:**
- Create: `admin/lib/actions.ts`（products 域 server actions）
- Create: `admin/components/ProductsTable.tsx`（client）
- Modify: `admin/app/page.tsx`

**Interfaces:**
- Consumes: `db()` / `stripe()` / `assertAuth()` / `ProductRow`（Task 7）。
- Produces（server actions，全部 `"use server"` + 首行 `await assertAuth()`，返回 `{ ok: true } | { error: string }`）:
  - `updatePrice(handle: string, newCents: number)`
  - `updateStock(handle: string, stock: number | null)`
  - `toggleAvailable(handle: string, available: boolean)`
  - `updateCopy(handle: string, title: string, tagline: string)`
  - `createProduct(input: { handle: string; title: string; tagline: string; priceCents: number; image: string })`
  - `deleteProduct(handle: string)`
  - `ensureStripe(handle: string)`（补建 Stripe product+price）

- [ ] **Step 1: server actions**

`admin/lib/actions.ts`：

```ts
"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { assertAuth } from "@/lib/auth";
import type { ProductRow } from "@/lib/types";

type Result = { ok: true } | { error: string };

const HANDLE_RE = /^[a-z0-9-]{2,40}$/;

async function getRow(handle: string): Promise<ProductRow | null> {
  const { data } = await db().from("products").select("*").eq("handle", handle).single();
  return (data as ProductRow) ?? null;
}

/*
 * 改价 = Stripe Price 不可变金额，必须建新归档旧：
 *   1. 建新 Price（同 product）
 *   2. DB 回写 price_cents + stripe_price_id（失败则归档新价回滚）
 *   3. 归档旧 Price
 * 旧价保持 active 到最后一步，改价过程中生产结算不断档。
 * 无 Stripe 侧对象的商品（未开售占位品）只写 DB。
 */
export async function updatePrice(handle: string, newCents: number): Promise<Result> {
  await assertAuth();
  if (!Number.isInteger(newCents) || newCents < 100 || newCents > 500_000) {
    return { error: "price out of range (AU$1 to AU$5000)" };
  }
  const row = await getRow(handle);
  if (!row) return { error: "product not found" };

  let newPriceId: string | null = null;
  let productId = row.stripe_product_id;
  try {
    if (row.stripe_price_id || productId) {
      if (!productId && row.stripe_price_id) {
        // 旧 seed 只存了 price id：从 Stripe 反查 product 并回填
        const old = await stripe().prices.retrieve(row.stripe_price_id);
        productId = typeof old.product === "string" ? old.product : old.product.id;
      }
      const created = await stripe().prices.create({
        product: productId!,
        unit_amount: newCents,
        currency: "aud",
      });
      newPriceId = created.id;
    }
  } catch (e) {
    return { error: `Stripe: ${e instanceof Error ? e.message : "failed"}` };
  }

  const patch: Record<string, unknown> = { price_cents: newCents };
  if (newPriceId) {
    patch.stripe_price_id = newPriceId;
    patch.stripe_product_id = productId;
  }
  const { error } = await db().from("products").update(patch).eq("handle", handle);
  if (error) {
    if (newPriceId) await stripe().prices.update(newPriceId, { active: false }).catch(() => {});
    return { error: error.message };
  }
  if (newPriceId && row.stripe_price_id) {
    await stripe().prices.update(row.stripe_price_id, { active: false }).catch(() => {});
  }
  revalidatePath("/");
  return { ok: true };
}

export async function updateStock(handle: string, stock: number | null): Promise<Result> {
  await assertAuth();
  if (stock !== null && (!Number.isInteger(stock) || stock < 0 || stock > 100_000)) {
    return { error: "stock out of range" };
  }
  const { error } = await db().from("products").update({ stock }).eq("handle", handle);
  if (error) return { error: error.message };
  revalidatePath("/");
  return { ok: true };
}

export async function toggleAvailable(handle: string, available: boolean): Promise<Result> {
  await assertAuth();
  const row = await getRow(handle);
  if (!row) return { error: "product not found" };
  if (available && !row.stripe_price_id) {
    return { error: "no Stripe price yet. Create in Stripe first, then put it on sale" };
  }
  const { error } = await db().from("products").update({ available }).eq("handle", handle);
  if (error) return { error: error.message };
  revalidatePath("/");
  return { ok: true };
}

export async function updateCopy(handle: string, title: string, tagline: string): Promise<Result> {
  await assertAuth();
  const t = title.trim();
  if (t.length < 2 || t.length > 80) return { error: "title length 2 to 80" };
  if (tagline.length > 160) return { error: "tagline too long" };
  const { error } = await db()
    .from("products")
    .update({ title: t, tagline: tagline.trim() })
    .eq("handle", handle);
  if (error) return { error: error.message };
  revalidatePath("/");
  return { ok: true };
}

export async function createProduct(input: {
  handle: string;
  title: string;
  tagline: string;
  priceCents: number;
  image: string;
}): Promise<Result> {
  await assertAuth();
  if (!HANDLE_RE.test(input.handle)) return { error: "handle: lowercase letters, digits, hyphens" };
  if (!Number.isInteger(input.priceCents) || input.priceCents < 100) return { error: "bad price" };
  if (!input.image.startsWith("/")) return { error: "image must be a /public path like /c01/x.webp" };
  const { error } = await db().from("products").insert({
    handle: input.handle,
    title: input.title.trim(),
    tagline: input.tagline.trim(),
    price_cents: input.priceCents,
    image: input.image.trim(),
    available: false,
    sort: 1000,
  });
  if (error) return { error: error.message };
  revalidatePath("/");
  return { ok: true };
}

export async function deleteProduct(handle: string): Promise<Result> {
  await assertAuth();
  const row = await getRow(handle);
  if (!row) return { error: "product not found" };
  if (row.available) return { error: "take it off sale before deleting" };
  const { error } = await db().from("products").delete().eq("handle", handle);
  if (error) return { error: error.message };
  revalidatePath("/");
  return { ok: true };
}

/** 为无 Stripe 侧对象的商品补建 product + price（开售前置步骤） */
export async function ensureStripe(handle: string): Promise<Result> {
  await assertAuth();
  const row = await getRow(handle);
  if (!row) return { error: "product not found" };
  if (row.stripe_price_id) return { error: "already has a Stripe price" };
  try {
    const productId =
      row.stripe_product_id ??
      (await stripe().products.create({ name: row.title })).id;
    const price = await stripe().prices.create({
      product: productId,
      unit_amount: row.price_cents,
      currency: "aud",
    });
    const { error } = await db()
      .from("products")
      .update({ stripe_product_id: productId, stripe_price_id: price.id })
      .eq("handle", handle);
    if (error) return { error: error.message };
  } catch (e) {
    return { error: `Stripe: ${e instanceof Error ? e.message : "failed"}` };
  }
  revalidatePath("/");
  return { ok: true };
}
```

- [ ] **Step 2: Products 页 + 表格组件**

`admin/app/page.tsx`：

```tsx
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
```

`admin/components/ProductsTable.tsx`（client）。要点：
- 每行：image 缩略（`<img src={site + p.image}>`，site = `https://roomiepaw.vercel.app`，svg/webp 直链）、handle（等宽字体）、title/tagline（`<input>` 行内编辑 + Save 按钮 → `updateCopy`）、价格（显示 `formatCents`，Edit 点开 `<input type="number" step="0.01">` 输入澳元 → `updatePrice(handle, Math.round(v*100))`）、库存单元格、available checkbox → `toggleAvailable`、Stripe 状态列、Delete（`confirm()` 后 `deleteProduct`）。
- 库存单元格三态：`stock === null` 显示 `∞ untracked` + "track" 按钮（置 0 起步）；数字显示 `<input type="number">` + Save + "untrack" 按钮（置回 null）；`stock <= 0` 时整格 `class="warn"`（0 = SOLD OUT、负数 = OVERSOLD n——负数即并发竞态信号）。
- Stripe 列：有 price id 显示尾号 `…${id.slice(-6)}`；无则 "Create in Stripe" 按钮 → `ensureStripe`。
- 页尾 `<details><summary>Add a product</summary>` 表单（handle/title/tagline/price AUD/image path）→ `createProduct`。
- 所有 action 调用模式统一：`const r = await action(...); if ("error" in r) setErr(r.error); else { setErr(null); router.refresh(); }`（`useRouter` from `next/navigation`；顶部一个全局错误条显示 err）。
- 提示条：`Prices on the live site update within seconds. Stripe checkout uses the new price immediately.`

完整组件代码由实现者按上述行为写（约 200 行，围绕七个 action 的薄 UI，无业务逻辑）。

- [ ] **Step 3: 验证（全程用测试商品，不碰在售 SKU）**

浏览器 127.0.0.1:3100：
1. 表格渲染 6 行，价格/库存/状态与 DB 一致。
2. Add a product：`test-item / Test Item / just testing / 12 / /c01/print-01.webp` → 行出现，available=false，Stripe 列显示 Create 按钮。
3. `ensureStripe`：点 Create in Stripe → 列变尾号。Stripe dashboard（test mode）见新 product "Test Item" + AU$12 price。
4. 改价 test-item → 15 → Stripe 出现 AU$15 新 price 且 AU$12 归档（dashboard 或 `stripe prices list --product` 确认）；DB `price_cents=1500`。
5. 库存：track → 置 3 → 主站无影响（test-item 未上架）；untrack 回 ∞。
6. toggleAvailable on → **主站 dev（3000）TheShelf「What's next」少一张卡**（available=true 不再算 soon）——注意这验证了传导；再 toggle off 恢复。
7. 文案：改 tagline → What's next 卡文案变（toggle off 状态下可见）→ 改回。
8. Delete test-item（先确保 off sale）→ 行消失；Stripe 侧遗留 test product 手动 archive 或留着无害（test mode）。
9. 在售 SKU 快速核对：canvas-scratcher 行 Edit price 按钮存在但**不点**（Global Constraints 禁令）。

- [ ] **Step 4: Commit**

```bash
git add admin/
git commit -m "Admin products: price via Stripe rotate, stock, availability, copy, create/delete"
```

---

### Task 9: admin Orders 页（列表 / 详情 / 发货 / 送达）

**Files:**
- Create: `admin/lib/orderActions.ts`
- Create: `admin/components/OrdersList.tsx`（client）
- Modify: `admin/app/orders/page.tsx`

**Interfaces:**
- Consumes: `db()` / `assertAuth()` / `OrderRow`（Task 7）；生产 `/api/shipping`（Bearer ADMIN_SECRET，body `{order_ref, tracking_number, carrier}` 或 `{order_ref, status:"delivered"}`）。
- Produces:
  - `shipOrder(orderRef: string, trackingNumber: string, carrier: string): Promise<Result>`
  - `markDelivered(orderRef: string): Promise<Result>`

- [ ] **Step 1: actions**

`admin/lib/orderActions.ts`：

```ts
"use server";

import { revalidatePath } from "next/cache";
import { assertAuth } from "@/lib/auth";

type Result = { ok: true } | { error: string };

/*
 * 发货/送达走生产 API（不直写 DB）：那边是事实源，且发货邮件、
 * 追踪链接推导逻辑都在主站 /api/shipping 里，复用不重复。
 * 本地 NEXT_PUBLIC_URL 常是 localhost（教训：邮件断链），非 https 一律回退生产域名。
 */
const site = () => {
  const u = process.env.NEXT_PUBLIC_URL ?? "";
  return u.startsWith("https://") ? u : "https://roomiepaw.vercel.app";
};

async function callShipping(body: Record<string, unknown>): Promise<Result> {
  await assertAuth();
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return { error: "ADMIN_SECRET missing" };
  try {
    const res = await fetch(`${site()}/api/shipping`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) return { error: data.error ?? `HTTP ${res.status}` };
    revalidatePath("/orders");
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "network error" };
  }
}

export async function shipOrder(
  orderRef: string,
  trackingNumber: string,
  carrier: string,
): Promise<Result> {
  if (!trackingNumber.trim()) return { error: "tracking number required" };
  return callShipping({
    order_ref: orderRef,
    tracking_number: trackingNumber.trim(),
    carrier: carrier.trim() || undefined,
  });
}

export async function markDelivered(orderRef: string): Promise<Result> {
  return callShipping({ order_ref: orderRef, status: "delivered" });
}
```

- [ ] **Step 2: 页面 + 列表组件**

`admin/app/orders/page.tsx`：

```tsx
import { db } from "@/lib/db";
import type { OrderRow } from "@/lib/types";
import OrdersList from "@/components/OrdersList";

export default async function OrdersPage() {
  const { data, error } = await db()
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  const orders = (data ?? []) as OrderRow[];
  return (
    <>
      <h1>Orders</h1>
      <OrdersList orders={orders} />
    </>
  );
}
```

`admin/components/OrdersList.tsx`（client）。要点：
- 按状态分三组渲染：`To ship`（paid，置顶、橙色计数徽章）、`Shipped`、`Delivered`。空组显示 "none"。
- 每单一个 `<details>`：summary 行 = `#order_ref · created_at 日期 · customer_name/email · items 摘要（title×qty 逗号连接）· formatCents(amount_total)` + 状态 badge。
- 展开内容：items 明细表（title/variant/qty/unit）、运费行、shipping_address 格式化（name, line1, line2, city state postal）、email。
- paid 单展开区 = 发货表单：tracking number `<input>` + carrier `<select>`（auspost/sendle/other）+ Ship 按钮 → `shipOrder(order_ref, tracking, carrier)`；成功后 `router.refresh()`，出错行内红字。按钮旁注 `Sends the shipping email to the customer.`
- shipped 单：显示 tracking_number（tracking_url 超链）+ "Mark delivered" 按钮 → `markDelivered`。
- delivered 单：只读。

- [ ] **Step 3: 验证**

准备一条测试单（直接 insert，email 用店主邮箱，别用真实客户单验证）：
```bash
node -e '
const { createClient } = require("@supabase/supabase-js"); const fs = require("fs");
for (const l of fs.readFileSync(".env.local","utf8").split("\n")) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2]; }
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
db.from("orders").insert({
  stripe_session_id: "cs_test_admin_ui_" + Date.now(),
  order_ref: String(100000 + Math.floor(Math.random()*900000)),
  email: "zyx994041988@gmail.com", customer_name: "Admin Test",
  shipping_address: { name: "Admin Test", line1: "1 Test St", city: "Melbourne", state: "VIC", postal_code: "3000", country: "AU" },
  items: [{ handle: "canvas-print", title: "Swap-in Print", variant: "Wave Light", qty: 1, unit_cents: 3500 }],
  amount_total: 6100, shipping_cents: 2600, currency: "aud", status: "paid",
}).select("order_ref").then(({data,error}) => console.log(error ?? data));'
```
1. /orders：测试单出现在 To ship 组，展开见地址/明细。
2. 填 tracking `TESTTRACK123` + auspost → Ship → 状态刷新到 Shipped 组，tracking 链接指向 auspost；**店主邮箱收到发货邮件**（生产发的，图片完好）。
3. Mark delivered → 移入 Delivered 组。
4. 清理测试单：`db.from("orders").delete().eq("stripe_session_id", "<上面的id>")`。
5. 出错路径：对不存在的 ref 手动调 `shipOrder`（或临时改错 ADMIN_SECRET）→ 行内显示错误不崩。

- [ ] **Step 4: Commit**

```bash
git add admin/
git commit -m "Admin orders: grouped list, ship via production API, mark delivered"
```

---

### Task 10: admin Waitlist 页（分组 + CSV 导出）

**Files:**
- Modify: `admin/app/waitlist/page.tsx`
- Create: `admin/app/waitlist/export/route.ts`

**Interfaces:**
- Consumes: `db()` / `WaitlistRow`（Task 7）。middleware 已覆盖 route handler 认证。

- [ ] **Step 1: 页面**

`admin/app/waitlist/page.tsx`：

```tsx
import { db } from "@/lib/db";
import type { WaitlistRow } from "@/lib/types";

export default async function WaitlistPage() {
  const { data, error } = await db()
    .from("waitlist")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as WaitlistRow[];
  const groups = new Map<string, WaitlistRow[]>();
  for (const r of rows) {
    (groups.get(r.product_handle) ?? groups.set(r.product_handle, []).get(r.product_handle)!).push(r);
  }
  return (
    <>
      <h1>Waitlist</h1>
      <p>
        {rows.length} signups · <a href="/waitlist/export">download CSV</a>
      </p>
      {[...groups.entries()].map(([handle, list]) => (
        <section key={handle}>
          <h2>
            {handle} <span className="badge" style={{ background: "var(--cream)" }}>{list.length}</span>
          </h2>
          <table>
            <thead><tr><th>Email</th><th>Joined</th></tr></thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id}>
                  <td>{r.email}</td>
                  <td>{new Date(r.created_at).toLocaleDateString("en-AU")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
      {rows.length === 0 && <p>No signups yet.</p>}
    </>
  );
}
```

- [ ] **Step 2: CSV route**

`admin/app/waitlist/export/route.ts`：

```ts
import { db } from "@/lib/db";
import type { WaitlistRow } from "@/lib/types";

export async function GET() {
  const { data, error } = await db()
    .from("waitlist")
    .select("*")
    .order("product_handle")
    .order("created_at");
  if (error) return new Response(error.message, { status: 500 });
  const rows = (data ?? []) as WaitlistRow[];
  const esc = (s: string) => `"${s.replaceAll('"', '""')}"`;
  const csv = [
    "product,email,joined",
    ...rows.map((r) => [esc(r.product_handle), esc(r.email), r.created_at].join(",")),
  ].join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="roomie-waitlist.csv"`,
    },
  });
}
```

- [ ] **Step 3: 验证**

浏览器 /waitlist：现有登记按产品分组显示（Task 6 提交过一个测试邮箱应在列）；download CSV 得到文件，行数 = 总数 + 表头。
无 cookie 验证：`curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3100/waitlist/export` → 307（middleware 挡住，未泄露数据）。

- [ ] **Step 4: Commit**

```bash
git add admin/
git commit -m "Admin waitlist: grouped view + CSV export"
```

---

### Task 11: 文档 + 终检

**Files:**
- Modify: `docs/HANDOVER.md`（新增「Admin 后台与商品数据」章节）
- Modify: `docs/phase2-runbook.md`（发货章节改指向 admin；「猫屋开售」步骤更新为后台操作）
- Modify: `README.md`（如有运行说明段，补 `npm run admin`）

**Interfaces:** 无代码接口；文档必须覆盖以下事实。

- [ ] **Step 1: HANDOVER.md 增补**

新增章节要点（用文档现有体例）：
- 架构变更：商品唯一事实源 = Supabase products 表（代码常量已退役）；stock 语义（null/数字/0/负数警报）；全站 force-dynamic 的原因。
- admin 使用：`npm --prefix admin install`（一次）→ `npm run admin` → 127.0.0.1:3100，口令 = ADMIN_SECRET；三页功能一览；发货走生产 API 会真发邮件。
- 安全模型四层（127.0.0.1 绑定 / Host 白名单防 DNS rebinding / 口令 cookie / 密钥仅服务端）+ 「永不部署 admin」红线。
- **切 live Stripe 的那天**：.env.local 与 Vercel 同步换 live key 后，products 表里的 price id 仍是 test mode——对每个在售商品在 admin 里「改价」一次（同价即可）即自动在 live mode 重建 price 并回写；或用 Create in Stripe。
- 开发期教训重申：主站部署前不要用 admin 改在售 SKU 价格（归档旧 price 会弄断生产结算）。
- 表结构变更时 admin/lib/types.ts 与 lib/supabase-admin.ts 两处同步。

- [ ] **Step 2: runbook 更新**

- 发货章节：curl 命令保留作 fallback，首选改为「admin → Orders → 填运单号 → Ship」。
- 猫屋开售章节改为：admin → canvas-house 行 →（已有 price）确认价格 → 设库存 → available on；提醒 house 页购买形态改造是前置产品决策（当前 available on 只影响 waitlist 校验与 TheShelf 分组，HouseShop 界面仍是 waitlist——开售前需另做购买面板）。

- [ ] **Step 3: 终检**

```bash
# 主站（先停两个 dev server）
npx tsc --noEmit && npm run build
# admin
npm --prefix admin run build
```
Expected: 双绿。重起主站 dev + admin，Playwright 截图 landing/scratcher/house/cart 四页目检一遍（价格、售罄态未误触发、布局无回归）；admin 三页各点开一遍。

- [ ] **Step 4: Commit**

```bash
git add docs/ README.md
git commit -m "Docs: admin platform handbook, runbook now points at the admin UI"
```

---

## Plan Self-Review（已执行）

1. **Spec coverage**：products 表+RPC（T1）；catalog DB 化（T2/T6）；checkout 校验 409（T3）；webhook 扣减+幂等（T3）；购物车快照+re-derive 原则（T4）；PDP/landing/care/hero 全部价格接表+售罄态（T5，spec 漏列的 TheShelf/FinalCta/CanvasCollection/care/hero 已补）；force-dynamic（T4 Step 1）；error boundary（T6）；waitlist 校验查表（T6）；admin 三页（T8/9/10）；四层安全（T7）；Stripe 改价旋转+回滚序（T8）；发货走生产 API（T9）；CSV（T10）；文档+切 live 说明（T11）。猫屋开售形态明确不做（spec 边界，runbook 注明）。
2. **Placeholder scan**：ProductsTable/OrdersList 两个纯 UI 组件未逐行给码，但行为、数据流、action 调用模式均已完整规定（有意为之：薄 UI 无业务逻辑）；无 TBD/TODO 型步骤。
3. **Type consistency**：`CatalogItem`/`ClientCatalogItem`/`OfferInfo`/`ProductRow`/`Result` 各任务引用与定义一致；`lineImage(line, image)` 签名 T4 定义 T4 内消费；409 结构 T3 定义 T4 消费；cookie 名/Host 白名单 T7 定义 T7-10 消费。
