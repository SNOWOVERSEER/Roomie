# Admin 订单管理全面化 · 设计（2026-07-14）

> 背景：admin 后台雏形已有（Products / Orders / Waitlist）。用户要求补齐市面电商
> 后台的订单侧能力：状态流转、发货、退货、退款/退单、联系客户、数据统计等，
> "交给你去想想，然后需要做出来，拉通"。商品管理（上下架/改价/内容）保持现状。
> 本 spec 由 agent 在用户全权委托下自主定稿并直接实施；产品性取舍在交付说明中上报。

## 1. 功能面（对标 Shopify 订单侧，裁剪到小店量级）

| 能力 | 形态 |
|---|---|
| 订单状态机 | paid → shipped → delivered（现有）＋ cancelled / return_requested / returned |
| 退款 | 部分/全额，走 Stripe Refunds API（按 payment_intent），退款邮件 |
| 退单（取消） | 仅未发货可取消：全额退剩余款 + 可选回补库存 + 取消邮件 |
| 退货 | shipped/delivered 起：登记退货（原因）→ 邮件退货指引 → 收货确认（可同时退款+回补库存）；可撤销回原状态 |
| 联系客户 | 订单详情内自由撰写（主题+正文），品牌邮件壳发送；确认/发货邮件可重发 |
| 时间线 | 里程碑从 orders 列派生（零双写）；退款/邮件/回补/撤销退货记 `order_events` 表 |
| 内部备注 | orders.admin_note 单字段行内编辑（Shopify 式 order note） |
| 搜索/筛选 | 客户端搜 order_ref/email/姓名/运单号；状态 chips 过滤（≤500 单量级足够） |
| 数据统计 | Dashboard 首页：净营收 KPI（今日/7d/30d/全期）、单量、AOV、待办数、30 天柱状图（纯 SVG）、状态分布、Top products、低库存警报、最近订单、waitlist 计数 |
| 客户视图 | /customers：按 email 聚合（单数、LTV、末单、waitlist 交叉标记） |
| 导出 | /orders/export 全量 CSV（对账：小计/运费/总额/已退/状态/运单） |
| 装箱单 | /orders/[ref]/slip 可打印装箱单兼税务发票（print CSS，含 GST included；ABN 留 TODO） |

不做（YAGNI，量级不符）：折扣码、草稿单、多仓、店员权限分级、客服工单系统、
按行退款（金额制部分退款已覆盖）。

## 2. 数据模型（迁移 0007，全部增量、生产安全）

- `orders.status` check 扩为 6 态；新列：`refunded_cents int not null default 0`、
  `cancelled_at` / `return_requested_at` / `returned_at` timestamptz、
  `return_reason text`、`admin_note text`。
- **`refunded_cents` 永远写 Stripe 侧权威累计值**（charge.amount_refunded），
  admin 退款后回读 PI→latest_charge 取值；webhook 新增 `charge.refunded` 同步
  （绝对值赋值，天然幂等，覆盖 Stripe Dashboard 手工退款）。旧 endpoint 未订阅
  该事件——admin 主路径不依赖它，stripe-setup.mjs 已补，重建即生效（文档注明）。
- `order_events(id, order_id fk cascade, type text, message text, data jsonb, created_at)`，
  RLS 开零策略。type ∈ refund/email/restock/return_cancelled（里程碑不入表，防双写漂移）。
- RPC `restock_item(p_id,p_qty)` / `restock_product(p_handle,p_qty)`：加库存，
  仅影响 stock 非 null 的跟踪行（与 decrement 对偶）。

## 3. 状态机与动作守卫

```
paid ──ship──▶ shipped ──deliver──▶ delivered
 │                │                     │
 └─cancel─▶ cancelled                   │
                  └──start return──▶ return_requested ──mark returned──▶ returned
                         ▲                    │cancel return
                     (delivered 同)           └─▶ 回 delivered_at? delivered : shipped
```

- cancel 仅 paid；退款额 = amount_total − refunded_cents（为 0 则跳过 Stripe）；
  restock 默认开（货未出门）。
- refund 任意已付状态可用，金额 1..剩余；原因限 Stripe 三枚举。
- mark returned 可选「同时退款」（默认剩余全额）+ restock 默认开（货已回）。
- 回补库存按 BOM 展开（复用主站 `lib/inventory.componentsFor`），非 BOM 走商品级。
- 邮件失败不回滚业务变更，返回 warning（沿用发货语义）。

## 4. 邮件（lib/email.ts 单一事实源，admin 直调）

新增四封，复用现有 shell/品牌样式，动态文本全 esc()，文案无长破折号：
cancellation（退款在途 5-10 工作日）、refund（部分/全额）、return instructions
（回信沟通 + 店主可附自由段落；退货地址不在库，留自由段落解决）、custom
（主题即标题，正文按空行分段）。

## 5. 信息架构与 UI

- 导航：**Dashboard(/) · Orders · Products(/products) · Waitlist · Customers**。
  原 Products 首页整体移到 /products（actions revalidatePath 同步改）。
- Orders：工具条（搜索、状态 chips、Export CSV）；默认分组 To ship → Returns
  in progress → Shipped → Delivered → History(returned/cancelled)；搜索/筛选时平铺。
  订单卡新增：支付块（PI 链接进 Stripe Dashboard，test/live 感知；退款徽章）、
  时间线、admin note、按状态动作面板（危险动作两步确认，restock 开关内联）、
  装箱单链接。新增 badge 色：cancelled 红、return_requested 琥珀、returned 灰蓝。
- Dashboard 全部服务端计算（全表拉需要列，JS 聚合——遵守 jsonb 不上 PostgREST
  过滤的既有坑），净营收 = amount_total − refunded_cents，按下单日归属。
- 装箱单页独立打印样式，隐藏后台导航。

## 6. 验证计划

tsc 双 app 零错 → 跑迁移 → 插 3-4 笔合成订单（1 笔挂真实 test-mode PI）→
浏览器走全流程（cancel+restock / 部分退款(真 Stripe) / return 全链 / 联系客户 /
重发 / CSV / slip / Dashboard 数字对账）→ 截图取证 → 删除合成数据复原
（№1001 不动）。邮件真实发送仅 1-2 封到店主邮箱留证。
