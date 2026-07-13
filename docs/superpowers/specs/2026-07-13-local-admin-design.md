# Roomie Admin：本地管理后台 + 商品数据上移 Supabase

日期：2026-07-13 · 分支：`admin-platform` · 状态：设计已获用户批准

## 背景与目标

当前运营操作全靠手工：改价要改 `lib/catalog.ts` → 重跑 `stripe:setup` → 回填 Price ID → 部署；
库存概念不存在（只有硬编码 `available` 开关）；发货靠手拼 curl 调 `/api/shipping`；
看订单/waitlist 要翻 Supabase/Stripe 网页后台。

目标：一个**只在店主本机运行、永不部署**的管理后台，覆盖改价、库存、上下架、
文案、订单发货、waitlist 查看；改动即时生效，不需要重新部署主站。

用户确认的功能范围：改价 + 真库存数量 + 订单查看/发货 + 商品上下架/文案 + waitlist 查看。

## 架构决策

**商品数据（价格/库存/文案/上下架）迁入 Supabase `products` 表**，主站从表读取。
这推翻 P2 规格"商品数据用代码常量，不引 CMS"的旧决策——原因：真库存（卖一减一）
必须有可变存储，代码常量无法表达；且 Supabase 已在栈内（orders/waitlist 已验证）。
用户已确认此路线。

工作分两部分：

```
A. 主站改造（部署到生产）
   ├─ 商品页 / 购物车 ← 从 products 表读（服务端）
   ├─ /api/checkout ← 从表 re-derive 价格 + 校验库存
   └─ /api/webhook → 写订单后原子扣减库存

B. 管理后台 admin/（仓库内独立 Next.js 应用，永不部署）
   ├─ 读写 Supabase：products / orders / waitlist（service key）
   ├─ 调 Stripe API：改价 = 建新 Price + 归档旧 Price + 回写表
   └─ 发货：POST 生产站 /api/shipping（Bearer ADMIN_SECRET，复用发邮件逻辑）
```

**为什么独立应用而非主站 `/admin` 路由**：物理隔离——admin 代码不进生产构建，
不存在"middleware 忘挡 / env 配错就裸奔公网"的失效模式。

## 数据库：迁移 `0005_products.sql`

```sql
create table public.products (
  handle            text primary key,
  title             text not null,
  tagline           text not null default '',
  price_cents       integer not null,
  image             text not null default '',   -- public/ 路径
  stripe_product_id text,
  stripe_price_id   text,                        -- 空 = 未接 Stripe（不可购）
  stock             integer,                     -- 空 = 不限量/不跟踪；0 = 售罄
  available         boolean not null default false,
  numbered          boolean not null default false,
  sort              integer not null default 100,
  created_at / updated_at（同 orders 的触发器模式）
);
-- RLS 开启、不建策略：仅服务端 service key 可达（同 orders/waitlist 先例）
```

**库存语义（用户已确认）**：`stock IS NULL` = 不限量（等于迁移前行为）；数字 = 严格跟踪；
0 = 售罄（站点置灰、checkout 拒绝）。Seed 全部 NULL → **迁移当天站点行为零变化**，
店主之后在后台填真实件数才开始跟踪。

Seed 数据（写进迁移或 seed 脚本，幂等 upsert）：
- `canvas-scratcher`（8900，现有 stripe ids，available=true）
- `canvas-print`（3500，现有 stripe ids，available=true）
- `canvas-house`（18900，已有 price_1TsHxq…，available=false —— waitlist 模式）
- `nook-house` / `cloud-perch` / `wave-bowls`（What's next 占位，available=false，无 stripe）

现有 `lib/shopify.ts` MOCK_PRODUCTS 的 title/tagline/image/价格原样搬入，
渲染结果必须与迁移前一字不差。

## 主站改造

1. **`lib/catalog.ts`**：删除 `CATALOG` 常量 → 新增服务端 `getCatalog()` / `getProduct(handle)`
   查 products 表。`SHIPPING`、`shippingCentsFor`、`formatCents` 保持纯常量/纯函数不动。
   `CatalogItem` 类型保留（由表行映射，加 `stock`/`available`/`tagline` 字段）。
2. **`lib/shopify.ts` 退役**：`getProducts()`（TheShelf 用）并入 catalog 数据源，文件删除。
3. **客户端购物车数据流**：`CartContext` 是客户端组件，现直接 import CATALOG。
   改为 `app/layout.tsx`（服务端）查一次表，把轻量价格快照（handle→price/title/image）
   作为 props 传给 `CartProvider`。购物车展示用快照；**结算金额仍由服务端 re-derive**
   （现有安全原则不变，显示快照过期无碍——Stripe 托管页展示的才是最终价）。
   波及文件：`CartContext.tsx`、`cart/CartDrawer.tsx`、`cart/CartView.tsx`、`cart/lineImage.ts`。
4. **PDP 硬编码价格参数化**：`ScratcherShop.tsx`（"AU$89"/"AU$35" 三处）、
   `HouseShop.tsx`（"AU$189"）、`app/house/page.tsx` CrossSell blurb（"AU$89"）——
   页面服务端查表后作为 props 传入。
5. **售罄态**：`stock=0` 时加购按钮禁用显示 "Sold out"；`/api/checkout` 校验每行
   库存（不足 → 409 + 商品名，前端 toast 提示）。
6. **`/api/webhook`**：写单成功后原子扣库存
   （`update products set stock = stock - qty where handle = ? and stock is not null`）。
   幂等性由现有 `stripe_session_id` 唯一约束保证——插入冲突（重复事件）则不扣减。
   并发竞态允许瞬时负数，后台红色警报提示（用户已确认：不做预留锁，小店量级诚实模型）。
7. **渲染模式**：root layout 因 CartProvider 快照而查表 → 全站显式转动态渲染
   （root layout `export const dynamic = 'force-dynamic'`）。**必须显式声明**：否则
   Next 构建时预渲染会把构建时刻的价格烧进静态 HTML，改价不生效。改价后约几秒
   全站生效。流量小 + Supabase/Vercel 同区 syd，每请求查表的延迟可忽略。
8. **邮件**：`lib/email.ts` 中 CATALOG 查询改为 async 查表（webhook 上下文本就在服务端）。

## 管理后台 `admin/`

独立 Next.js App Router 应用（own `package.json`，Next/React 版本与主站对齐）。
根 `package.json` 加 `"admin": "next dev -H 127.0.0.1 -p 3100"`（在 admin/ 目录执行）。
env 从**根目录 `.env.local`** 读（next.config 用 dotenv 指向 `../.env.local`），不新增密钥拷贝。
admin 自带薄客户端初始化（`admin/lib/db.ts`、`admin/lib/stripe.ts`），类型从主站 import
（`@site/*` tsconfig path → 仓库根），不复用主站 `lib/env.ts` 的校验逻辑。

### 页面（3 个）

1. **Products**（`/`）：全商品表格。
   - 行内改价：输入新价 → Server Action：Stripe `prices.create`（同 product）→
     `prices.update(old, {active:false})` → 回写 `price_cents` + `stripe_price_id`。
     失败回滚序：DB 写失败则归档刚建的新 price 并报错。
     无 `stripe_product_id` 的商品（占位品）改价只写 DB；打开 available 时若无 stripe id
     → 界面提示并提供"Create in Stripe"一键补建。
   - 库存：+/− 步进、直接填数、"设为不限量"（置 NULL）；负数/≤2 红色警报显示。
   - 上下架 toggle（available）；title/tagline 行内编辑。
   - 新增商品表单：handle/title/tagline/价格/图片路径（`public/` 路径字符串，
     图片本体仍走代码库素材管线）。
2. **Orders**（`/orders`）：按状态分组列表（paid 待发货置顶）→ 详情（items/地址/金额/追踪）。
   发货表单：运单号 + 承运商（auspost/sendle/其他）→ POST 生产 `/api/shipping`
   （Bearer ADMIN_SECRET）→ 客户自动收发货邮件 → 本地刷新状态。可再标 delivered。
   失败时展示 API 返回错误，不本地改状态（生产是事实源）。
3. **Waitlist**（`/waitlist`）：按 product_handle 分组邮箱列表 + 导出 CSV。

### 安全（四层，用户已确认口令方案）

1. **网络**：dev server 绑 `127.0.0.1`；应用永不部署（不在 Vercel 构建路径内）。
2. **浏览器侧**：middleware 校验 Host ∈ {127.0.0.1:3100, localhost:3100}（防 DNS rebinding）；
   Server Actions 自带同源 Origin 校验。
3. **口令**：首次访问输入 `ADMIN_SECRET`（复用现有 env 值）→ httpOnly cookie；
   middleware 校验，未认证跳登录页。
4. **密钥**：Supabase service key / Stripe secret key 只在 Server Actions/route handlers
   中使用，永不进浏览器 bundle。

## 明确不做（YAGNI，用户已确认）

- 图片上传（素材必须过 de-logo 管线，图片继续走 `public/` 代码流程，后台只填路径）
- 猫屋开售的购买形态改造（保持 waitlist 模式；开售形态是未定的产品决策——
  但开售那天的操作因本系统变为：挂 price → 开 available → 填库存）
- 多用户/权限、销售统计图表（Stripe Dashboard 已有）、低库存邮件提醒
- 客户端库存实时推送（页面加载时的快照足够）

## 测试与验收

- **迁移零回归**：seed 后主站渲染与迁移前一字不差（价格/文案/上下架状态逐页目检 + 构建）。
- **e2e**：测试卡下单全链路 → webhook 写单 + 库存 -1 断言；stock=0 时 PDP 售罄态 +
  checkout 409。
- **后台操作各过一遍**：改价（Stripe test mode 验证新 price 生效、旧 price 归档）、
  补货/设不限量、上下架、文案编辑、新增商品、发货（对测试单，邮件发店主自己邮箱）、
  waitlist 导出。
- **安全验收**：局域网内其他设备访问 3100 端口不通；无 cookie 访问任何页面被拒；
  错误 Host 头请求被拒。
- 主站 `tsc + next build` 干净（dev server 必须先停——共用 .next 的已知坑）；
  admin 同样构建干净。
- **上线顺序**：先跑迁移建表 seed → 部署主站（读表版）→ 目检生产 → 后台投入使用。

## 决策日志

- 2026-07-13 用户确认：功能范围全选（价格/库存/订单发货/上下架文案/waitlist）。
- 2026-07-13 用户确认：商品数据迁入 Supabase（推翻 P2"不引 CMS"决策）。
- 2026-07-13 用户批准整体设计，含四个代拍决定：stock NULL=不限量；竞态允许瞬时负数
  不加锁；口令复用 ADMIN_SECRET；商品页转动态渲染。
