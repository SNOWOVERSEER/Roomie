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

### 发货（拿到追踪号后一条命令）

```bash
curl -X POST https://roomiepaw.vercel.app/api/shipping \
  -H "Authorization: Bearer $ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"order_number":1001,"tracking_number":"XX1234567890","carrier":"auspost"}'
```

- `carrier` 支持 `auspost` / `sendle`（自动生成追踪链接），其他承运商传 `tracking_url`。
- 自动：状态 → `shipped`、记 `shipped_at`、给顾客发「发货邮件」。
- 送达后（可选）：`-d '{"order_number":1001,"status":"delivered"}'`。

### 查订单

Supabase Dashboard → Table Editor → `orders`。
字段：`order_number`（从 1001 起）、客户/地址、`items`（含画芯名与猫屋编号）、
`status`（paid/shipped/delivered）、追踪号、各时间戳。

### 退款 / 优惠券（零代码，规格决策）

- 退款：Stripe Dashboard → Payments → 找到付款 → Refund。
- 优惠券：Stripe Dashboard → Product catalog → Coupons → 建 Coupon + Promotion Code；
  结算页已开 `allow_promotion_codes`，顾客直接输码。

### 看候补名单 / 导出邮箱

Supabase Dashboard → Table Editor → `waitlist`（`product_handle` 区分产品：
`canvas-house` / `nook-house` / `cloud-perch` / `wave-bowls`）。
SQL Editor 导出某产品全部邮箱：

```sql
select email from waitlist where product_handle = 'canvas-house' order by created_at;
```

### 猫屋开售（把它从 waitlist 切回可购）

首批猫屋当前**不可购**（2026-07-12 决策：选号预售撤销，改候补）。开售时：

1. `lib/catalog.ts` 把 canvas-house 加回（Stripe price 已存在：
   `price_1TsHxqDzmUuzRpRKebu6oZDS`，AU$189 占位）+ `scripts/stripe-setup.mjs` 的 SKUS 同步；
2. HouseShop 面板把 WaitlistForm 换回购买按钮（git 历史里有选号版本可参考，
   commit `4ca870b` 之前）；
3. 给 waitlist 里的人发邮件（导出邮箱 → Resend 群发或手动）。

### 上新 SKU

1. `lib/catalog.ts` 加一项（价格分）；
2. `scripts/stripe-setup.mjs` 的 `SKUS` 数组同步加；
3. `npm run stripe:setup`（幂等），把打印的 Price ID 填回 catalog；
4. 前端把商品接进 PDP / 购物车调用 `add(handle, variant)`。

### 数据库迁移

新建 `supabase/migrations/000X_xxx.sql` → `npm run db:migrate`
（已执行的文件记录在 `schema_migrations`，重复跑安全）。

## 上线（切正式收款）Checklist

1. **Stripe 切 live**：
   - [ ] 完成 Stripe 账户激活（商业信息、银行账户）
   - [ ] `sk_live_…` 替换 Vercel 的 `STRIPE_SECRET_KEY`
   - [ ] 用 live key 重跑 `npm run stripe:setup` → 新 Price ID 回填
     `lib/catalog.ts`、新 webhook secret 替换 Vercel 的 `STRIPE_WEBHOOK_SECRET`
   - [ ] Dashboard 开启 **Afterpay/Clearpay**（Settings → Payment methods；
     sandbox 里当前只有 Card/Klarna/Zip）
   - [ ] 开启 **Stripe Tax**（Settings → Tax，填墨尔本发货地址，登记 GST）
     → Vercel 设 `STRIPE_TAX_ENABLED=1`（价格已按 GST 含内配置 `tax_behavior: inclusive`）
2. **Resend**：
   - [ ] Domains 里验证 `roomiepaw.com.au`（加 DNS 记录）
   - [ ] `RESEND_FROM` 换成如 `Roomie <orders@roomiepaw.com.au>`
   - 未验证前 `onboarding@resend.dev` 只能发给 Resend 账户本人邮箱（现状够测试用）
3. **定价确认**（现为占位）：画芯 AU$35、猫屋 AU$189 → 改 `lib/catalog.ts`
   + 重跑 `stripe:setup`（脚本按新价建新 Price，旧 Price 在 Dashboard 手动 archive）
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
- 购物车在浏览器本地（localStorage），换设备不同步。
- waitlist 不发确认邮件、无退订链接（开售通知属一次性交易性邮件；
  若以后做营销邮件再补合规退订）。
