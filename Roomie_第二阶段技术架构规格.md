# Roomie — MVP 技术架构规格

> **交付对象：coding agent。** 定义架构边界与决策，不定义实现细节。

---

## 架构概述

自建 Next.js 前端部署在 Vercel。支付交给 Stripe，订单存 Supabase，邮件走 Resend。没有自建服务器，Vercel 是唯一的计算层。

服务端逻辑全部通过 **API Routes** 实现，不使用 Edge Functions。

---

## 技术栈

| 层 | 选型 |
|---|---|
| 前端框架 | Next.js App Router（已有） |
| 部署 | Vercel，Region：悉尼（syd1） |
| 支付 | Stripe |
| 订单存储 | Supabase（PostgreSQL） |
| 邮件 | Resend |
| 商品数据 | 代码内常量（SKU 少，不引入 CMS） |

不引入：Shopify、WooCommerce、CMS、消息队列、任何自建服务器。

---

## 系统边界

```
┌─────────────────────────┐
│         Vercel          │
│   Next.js（前端 + API） │
└────┬──────┬──────┬──────┘
     │      │      │
  Stripe  Supabase  Resend
```

三个外部服务各司其职，Vercel 是唯一协调层。

---

## 职责划分

**Stripe 负责：** 收款、退款、Afterpay、GST 自动计算（Stripe Tax）、优惠券（Promotion Codes）、托管结算页。退款和优惠券在 Stripe Dashboard 操作，无需写代码。

**Supabase 负责：** 存储订单记录，追踪订单状态（paid → shipped → delivered）。

**Resend 负责：** 付款确认邮件（Webhook 触发）、发货通知邮件（手动触发）。

**你手动负责：** 发货（Australia Post / Sendle）、在 Stripe Dashboard 处理退款、创建优惠券。Australia Post 自动回调接口标为 **TODO，MVP 不做**。

---

## 核心数据流

**购买：** 客户结算 → Next.js 创建 Stripe Checkout Session → 跳转 Stripe 托管页付款 → Stripe 推 Webhook → 写订单到 Supabase + 发确认邮件。

**发货：** 你手动下单拿到追踪号 → 调内部接口更新 Supabase 订单状态 → 发发货通知邮件。

**退款：** 客户申请 → 你在 Stripe Dashboard 操作 → Stripe 自动退款。

---

## API Routes

三个端点，职责如下，实现细节由 agent 自行决定：

| 端点 | 职责 |
|---|---|
| `/api/checkout` | 创建 Stripe Checkout Session |
| `/api/webhook` | 接收 Stripe 事件，写订单，触发确认邮件 |
| `/api/shipping` | 内部接口（需鉴权），更新追踪号，触发发货邮件 |

---

## 数据模型

### orders 表（Supabase）

核心字段：Stripe Session ID、Payment Intent ID、客户邮件、客户姓名、收货地址、商品列表、总金额、币种、订单状态、追踪号、追踪链接、时间戳。

订单状态枚举：`paid` / `shipped` / `delivered`

### 商品（代码常量）

每个商品包含：ID、名称、描述、价格（单位：分）、Stripe Price ID、图片、URL handle。上新品 = 加一项 + 在 Stripe Dashboard 建对应 Price。

---

## Stripe Dashboard 配置（非代码）

MVP 上线前必须完成：

- 建 Products & Prices（每个 SKU 对应一个 Price，AUD）
- 开启 Stripe Tax，配置澳洲 GST
- 启用 Afterpay 支付方式
- 配置生产 Webhook 端点，监听 `checkout.session.completed`

---

## 环境变量

| 变量 | 说明 |
|---|---|
| `STRIPE_SECRET_KEY` | 服务端专用 |
| `STRIPE_WEBHOOK_SECRET` | Webhook 签名验证 |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | 前端可见 |
| `SUPABASE_URL` | 数据库地址 |
| `SUPABASE_SECRET_KEY` | 服务端专用（`sb_secret_xxx`），绕过 RLS |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 前端可见（`sb_publishable_xxx`） |
| `RESEND_API_KEY` | 邮件发送 |
| `NEXT_PUBLIC_URL` | 生产域名，用于构建回调 URL |
| `ADMIN_SECRET` | `/api/shipping` 鉴权 |

敏感 key 仅配置在 Vercel Production 环境，不暴露 Preview 环境。

---

## 安全约束

- Stripe Webhook 必须验证签名
- `/api/shipping` 必须校验 `ADMIN_SECRET`
- `SUPABASE_SECRET_KEY` 和 `STRIPE_SECRET_KEY` 只在服务端使用

---

## 部署

- Vercel Region：`syd1`（悉尼，澳洲用户延迟最低）
- `/api/webhook` 函数超时设为 30 秒
- `main` 分支自动部署生产，其他分支生成 Preview URL
- 域名在 Vercel Domains 绑定，SSL 自动签发

---

## 免费额度

| 服务 | 免费额度 |
|---|---|
| Vercel | 100GB 带宽/月 |
| Stripe | 无月费，1.7% + 30¢/笔（澳洲本地卡） |
| Supabase | 500MB 数据库 |
| Resend | 3000 封/月 |

起步月固定成本：$0。

---

## MVP 范围

**做：** 购物车 → Stripe 结算 → 订单写库 → 付款确认邮件 → 发货通知邮件 → 付款成功页。

**不做（TODO）：** 客户订单查询页、Australia Post 自动回调、库存管理、CMS 商品管理。

---

*Roomie · Melbourne · 让宠物用品，成为家的一部分*
