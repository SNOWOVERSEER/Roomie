# Roomie P2 运维手册（Stripe + Supabase + Resend）

> 面向店主的日常操作与上线清单。架构决策见根目录
> [`Roomie_第二阶段技术架构规格.md`](../Roomie_第二阶段技术架构规格.md)，
> 代码层说明见 [`README.md`](../README.md) 的 Commerce backend 一节。

---

## 一图流

```
顾客加购（浏览器 localStorage）
  → /cart 点「Checkout securely」
  → POST /api/checkout          服务端按 lib/catalog.ts 定价建 Session
  → Stripe 托管结算页            卡 / Afterpay / 优惠码 / 澳洲地址
  → 付款成功
      ├─ 浏览器跳回 /checkout/success（轮询订单号）
      └─ Stripe Webhook → /api/webhook
            ├─ 写 Supabase orders（幂等，重投不重复）
            └─ Resend 发「确认邮件」
你手动发货（AusPost / Sendle 拿到追踪号）
  → POST /api/shipping（Bearer ADMIN_SECRET）
      ├─ 订单状态 paid → shipped（或 delivered）
      └─ Resend 发「发货邮件」（含追踪链接）

未上市产品（含猫屋首批）
  → 页面内 Join the waitlist（问邮箱 + 格式校验）
  → POST /api/waitlist → Supabase waitlist 表（同邮箱同产品幂等）
```

## 环境变量（Vercel → Settings → Environment Variables，Production 作用域）

| 变量 | 来源 | 备注 |
|---|---|---|
| `STRIPE_SECRET_KEY` | Stripe Dashboard → Developers → API keys | 当前 sandbox `sk_test_…`，上线换 `sk_live_…` |
| `STRIPE_WEBHOOK_SECRET` | `npm run stripe:setup` 创建 endpoint 时输出 | 生产值我已生成（见交付文件），只进 Vercel |
| `SUPABASE_URL` | Supabase → Project Settings → API | `https://wfqhqxojuaudycdrkjpy.supabase.co` |
| `SUPABASE_SECRET_KEY` | 同上（`sb_secret_…`） | 服务端专用，绕过 RLS |
| `RESEND_API_KEY` | resend.com → API Keys | 缺失时邮件静默跳过，不影响下单 |
| `RESEND_FROM` | 你决定 | 域名验证前必须是 `Roomie <onboarding@resend.dev>` |
| `NEXT_PUBLIC_URL` | — | `https://roomiepaw.vercel.app`（绑正式域名后更新） |
| `ADMIN_SECRET` | 我已生成（见交付文件） | `/api/shipping` 的口令 |
| `STRIPE_TAX_ENABLED` | — | Dashboard 配好 Stripe Tax 后设 `1`（默认关） |

本地开发：以上同名变量放 `.env.local`（已 gitignore）。
`SUPABASE_DB_PASSWORD` 只有本地跑迁移需要，Vercel 不配。

## 日常操作

**首选入口：本地 admin 后台**（admin-platform 起）——
`npm run admin` → http://127.0.0.1:3100（口令 = ADMIN_SECRET；首次先
`npm --prefix admin install`）。改价、库存、上下架、文案、发货、看单、
候补导出全部在这里点完；改动约几秒生效，不需要部署。下面的 curl/SQL
是后台不可用时的 fallback。

### 发货

**admin → Orders → 找到订单 → 填运单号选承运商 → Ship**（自动发发货邮件）。
送达后同处「Mark delivered」。

fallback（一条命令）：

```bash
curl -X POST https://roomiepaw.vercel.app/api/shipping \
  -H "Authorization: Bearer $ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"order_ref":"482916","tracking_number":"XX1234567890","carrier":"auspost"}'
```

- `carrier` 支持 `auspost` / `sendle`（自动生成追踪链接），其他承运商传 `tracking_url`。
- 自动：状态 → `shipped`、记 `shipped_at`、给顾客发「发货邮件」。
- 送达后（可选）：`-d '{"order_ref":"482916","status":"delivered"}'`。
- 也接受 `order_number`（内部自增号）或 `session_id`。
- ⚠️ 2026-07-13 已知缺口：Vercel 的 `ADMIN_SECRET` 与本地 `.env.local`
  不一致（生产回 401）——先在 Vercel env 对齐，admin 发货与这条 curl 才通。

### 改价 / 库存 / 上下架 / 上新（全在 admin → Products）

- **改价**：行内 edit → 填新价 → Save。自动在 Stripe 建新 Price、归档旧
  Price、回写表；全站显示价与结算价同步换，**不用重跑 stripe:setup、不用部署**。
- **库存**：默认 `∞ untracked`（不限量）；「track」开始计数，卖一件自动
  减一，0 = 站点售罄置灰，红色 OVERSOLD = 并发竞态提醒（手工核对后补货）。
- **上下架**：off sale 的商品从可购变 What's next 候补卡。
- **上新**：Add a product 填 handle/文案/价格/图片路径（图片本体先走仓库
  `public/` 素材管线：去 logo、webp 化，见 HANDOVER §6）→ Create in Stripe
  → 核对后 put on sale。

### 订单号说明

顾客看到的订单号是 **`order_ref`（6 位纯数字随机，如 482916）** ——
邮件、成功页、客服沟通都用它（用户定稿：无前缀纯数字）。设计原因：
顺序号（Shopify 式 #1001 起）会让顾客推算出总销量和增速；随机号是
小品牌通行做法。内部排序/对账仍有自增 `order_number`（表里两列都在）。

### 运费规则（改动处：`lib/catalog.ts` 的 `SHIPPING`）

只发澳洲；统一 **AU$26**，商品小计满 **AU$188 免运**。购物车/抽屉的
运费行与免邮差额提示、Stripe 结算页的运费项、订单表 `shipping_cents`、
邮件的 Shipping 行全部由这一处常量驱动。对客说明页：`/shipping-returns`。

### 查订单

**admin → Orders**（按 To ship / Shipped / Delivered 分组，点开看明细地址）。
fallback：Supabase Dashboard → Table Editor → `orders`。
字段：`order_ref`（顾客可见 6 位数字）、`order_number`（内部自增）、
客户/地址、`items`、`amount_total`/`shipping_cents`（分）、
`status`（paid/shipped/delivered）、追踪号、各时间戳。

### 退款 / 优惠券（零代码，规格决策）

- 退款：Stripe Dashboard → Payments → 找到付款 → Refund。
- 优惠券：Stripe Dashboard → Product catalog → Coupons → 建 Coupon + Promotion Code；
  结算页已开 `allow_promotion_codes`，顾客直接输码。

### 看候补名单 / 导出邮箱

**admin → Waitlist**（按产品分组 + 「download CSV」一键导出）。
fallback：Supabase Dashboard → Table Editor → `waitlist`，或 SQL：

```sql
select email from waitlist where product_handle = 'canvas-house' order by created_at;
```

### 猫屋开售（把它从 waitlist 切回可购）

首批猫屋当前**不可购**（2026-07-12 决策：选号预售撤销，改候补）。开售时：

1. **前置（代码，一次性）**：HouseShop 面板把 WaitlistForm 换回购买按钮
   （git 历史里有选号版本可参考，commit `4ca870b` 之前）——开售形态是
   待定产品决策；
2. **admin → Products → canvas-house**：确认价格（Stripe price 已挂：
   `price_1TsHxqDzmUuzRpRKebu6oZDS`，AU$189 占位，改价直接行内改）→
   「track」设首批件数（10）→ put on sale；
3. 给 waitlist 里的人发邮件（admin → Waitlist 导出 CSV → Resend 群发或手动）。

### 上新 SKU

**admin → Products → Add a product**（handle/文案/价格/图片路径）→
Create in Stripe → put on sale。图片本体先走仓库 `public/` 素材管线入库部署。
若新品要有自己的 PDP/购买面板，前端另行接（购物车调用 `add(handle, variant)`）。
`scripts/stripe-setup.mjs` 已不再是上新路径（保留作初始化参考）。

### 数据库迁移

新建 `supabase/migrations/000X_xxx.sql` → `npm run db:migrate`
（已执行的文件记录在 `schema_migrations`，重复跑安全）。

## 上线（切正式收款）Checklist

1. **Stripe 切 live**：
   - [ ] 完成 Stripe 账户激活（商业信息、银行账户）
   - [ ] `sk_live_…` 替换 Vercel 的 `STRIPE_SECRET_KEY` **和本地 `.env.local`
     （admin 用同一把 key，模式必须一致——admin 顶栏会显示 test/live）**
   - [ ] live 侧重建 Price：**admin → Products 里对每个在售商品「改价」一次
     （同价即可）**，自动在 live 建新 Price 回写表；占位商品用 Create in Stripe。
     新 webhook secret 替换 Vercel 的 `STRIPE_WEBHOOK_SECRET`
     （webhook endpoint 用 live key 重跑 `npm run stripe:setup` 创建）
   - [ ] Dashboard 开启 **Afterpay/Clearpay**（Settings → Payment methods；
     sandbox 里当前只有 Card/Klarna/Zip）
   - [ ] 开启 **Stripe Tax**（Settings → Tax，填墨尔本发货地址，登记 GST）
     → Vercel 设 `STRIPE_TAX_ENABLED=1`（价格已按 GST 含内配置 `tax_behavior: inclusive`）
2. **Resend**：
   - [ ] Domains 里验证 `roomiepaw.com.au`（加 DNS 记录）
   - [ ] `RESEND_FROM` 换成如 `Roomie <orders@roomiepaw.com.au>`
   - 未验证前 `onboarding@resend.dev` 只能发给 Resend 账户本人邮箱（现状够测试用）
3. **定价确认**（现为占位）：画芯 AU$35、猫屋 AU$189 →
   **admin → Products 行内改价**（自动建新 Price + 归档旧 Price，即时生效）
4. **域名**：Vercel Domains 绑 `roomiepaw.com.au` → 更新 `NEXT_PUBLIC_URL`
   → 重跑 `stripe:setup`（webhook URL 换新域名）
5. 测一笔真实小额订单，Dashboard 退款走一遍。

## 故障排查

| 症状 | 看哪里 |
|---|---|
| 付款成功但 success 页一直「fetching order number」 | Stripe Dashboard → Webhooks → endpoint 的投递记录；常见是 `STRIPE_WEBHOOK_SECRET` 不匹配（签名 400） |
| 订单入库但没邮件 | Vercel 函数日志搜 `[email]`；Resend Dashboard → Emails；域名未验证时只有账户本人邮箱能收 |
| `/api/shipping` 401 | `Authorization: Bearer` 与 Vercel 的 `ADMIN_SECRET` 是否一致 |
| waitlist 提交转圈失败 | Vercel 函数日志搜 `[waitlist]`；表在 Supabase → `waitlist` |
| 本地 webhook 收不到 | `stripe listen --api-key … --forward-to localhost:3000/api/webhook`，把它打印的 `whsec_…` 放进 `.env.local` 后重启 dev |

## 已知边界（MVP 刻意不做，规格确认）

- 无顾客订单查询页 / AusPost 自动回调 / 库存管理 / CMS。
- Policy 页（/shipping-returns /care /privacy /terms）为平实英语版，
  发货时效、退货窗口等默认值上线前请店主复核（代码里标了 TODO）。
- 购物车在浏览器本地（localStorage），换设备不同步。
- waitlist 不发确认邮件、无退订链接（开售通知属一次性交易性邮件；
  若以后做营销邮件再补合规退订）。
