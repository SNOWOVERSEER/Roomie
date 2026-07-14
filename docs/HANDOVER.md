# Roomie 交接文档（Agent Handover）

> 目标读者：下一个接手本仓库的 coding agent（或人类开发者）。
> 读完本文 + 跟着「上手 15 分钟」跑一遍，即可在不丢失任何隐含约定的
> 前提下继续开发。姊妹文档：
> [`README.md`](../README.md)（工程概览，英文）·
> [`docs/phase2-runbook.md`](phase2-runbook.md)(店主运维手册) ·
> [`Roomie_第二阶段技术架构规格.md`](../Roomie_第二阶段技术架构规格.md)（P2 架构规格，用户提供）。

---

## 0. 一句话概览

Roomie 是墨尔本自有品牌宠物家居店（白牌），当前只有一条产品线
**The Canvas Series**（画布猫抓板 AU$89 + 单卖画芯 AU$35 占位 + 猫屋
waitlist 候补中）。Next.js App Router 全栈：前端 + Stripe 收款 +
Supabase 订单/候补 + Resend 邮件，Vercel（syd1）经 GitHub CI/CD 部署到
https://roomiepaw.vercel.app 。本地一笔沙盒订单（№ 1001）已全流程走通。

---

## 1. 红线（违反 = 事故，先读这节）

1. **供应商品牌（GlugGlug）绝不能出现在站点任何地方**——图片像素、
   视频帧、文案、alt、DOM、metadata 全算。所有已发布素材都经过
   de-logo 处理（见 §6）。新素材上站前必须目检 + 全分辨率查一遍。
   历史注意：用户曾说过"logo 没事"，后因合作性质变化**收回**，一律按最严执行。
2. **站点文案纯英文**。中文只允许出现在代码注释、内部文档（本文这类）。
   画作中文名（晴野/波光/叶舟/森光/窗影/红果）只存在于内部语境，
   站上用英文名（Sunny Field / Wave Light / Leaf Boat / Forest Light /
   Window Glow / Red Fruit）。
3. **重大改动必须 git commit**（用户明确流程要求）。小步提交、信息写清楚。
4. **供应商素材目录不入库**：`GlugGlug30天发文计划/`、`Glug视频/`
   在仓库根目录、已被 .gitignore 屏蔽。绝不 `git add -f`。
5. **密钥不入库**：真实密钥只在 `.env.local`（已 ignore）与 Vercel 环境
   变量里。`.env.example` 是唯一可提交的模板。
6. 部署到生产（push main）**先问用户**——CI/CD 直连生产站。

---

## 2. 用户与协作方式

- 用户中文沟通，常给高层目标后全权委托（"你看着去做"），但**产品性决策
  要主动上报**（定价、收费时机、预售模式这类——历史上猫屋从"选号预售"
  改成"waitlist"就是用户直接拍板推翻实现）。
- 交付习惯：做完给**截图证据**（SendUserFile），说明验证了什么。
- 占位内容一律标 `TODO` 并在总结里提醒（现存：画芯 AU$35 价格、
  猫屋开售时间/价、Resend 正式发件域名、footer 帮助页链接是 `#`）。
- **用户品味（重要，多次校准过）**：
  - 讨厌"通用组件感"的悬浮 UI（胶囊工具条、圆圈箭头按钮之类）。
  - 喜欢**融入场景的实物化控件**：靠墙的备用画芯就是切换器、
    画框角的纸吊牌就是标题铭牌。
  - "沉浸不代表隐秘"——控件要一眼可见，别为了低调牺牲可发现性。
  - 结构上反对平铺直叙：landing 勾兴趣，细节进详情页。

---

## 3. 品牌与声线

- 店格：墨尔本小工作室，"一件一件做"（What's next 区叙事）；
  slogan 语域：*pet things that feel like part of home* / *furniture you
  share with the cat*。
- 文案声线：克制的幽默 + 拟猫视角旁白。例句（保持这个味道）：
  - "A framed print your cat is allowed to ruin — slowly, and with great ceremony."
  - "The daily shred, honoured in full."
  - "straight off the set — no actors, just residents"
  - 空购物篮："The wall is still bare — and somebody has claws."
- 计数/编号用 `№`（№ 01 / 06），全站统一。
- 价格写法 `AU$89`；税话术 "GST included"；运费话术围绕
  「AU$26 flat · free over AU$188 · Australia only」展开（常量见
  `lib/catalog.ts` SHIPPING，对客页面 /shipping-returns）。
- **官方名称是 RoomiePaw**（2026-07-12 用户明确）：metadata、aria、
  页脚版权、邮件发件人一律 RoomiePaw；logo 图形仍是 "Roomie" 字标 +
  爪印（那是视觉资产，不是名称）。
- **文案禁用长破折号 "—"**（用户：AI 味太浓伤信任）：标题分隔用 `·`，
  句内改用句号/逗号/冒号重组。中文代码注释里的 "——" 不受限。
- 顾客可见订单号是 `order_ref`（6 位纯数字随机，如 482916，不暴露
  销量；用户定稿无前缀）；内部自增 `order_number` 只用于对账。

---

## 4. Design System（实值，来源 `app/globals.css`）

### 4.1 色板

| Token | 值 | 用途 |
|---|---|---|
| `--orange` | `#e8863c` | 品牌主橙：CTA、强调。**每屏只允许一个主橙 CTA** |
| `--orange-deep` | `#d4702a` | 橙 hover / kicker 文字 |
| `--blue` | `#3a5bc7` | 标题默认色（h1-h3 全局是它） |
| `--blue-deep` | `#2b4497` | 链接/组件里的深蓝文字 |
| `--navy` | `#12275e` | 夜幕背景（footer、猫屋舞台、CrossSell 卡）——取自画作夜空色 |
| `--cream` | `#edeae3` | 页面底色 |
| `--cream-warm` | `#f6f2e9` | 暖变体（隔行 section 用 `sectionWarm`） |
| `--paper` | `#f8f6f0` | 卡片/面板底色（"纸"） |
| `--ink` | `#2e2e33` | 正文 |
| `--ink-soft` | `#5c5a55` | 次级文字 |

半透明一律用 `color-mix(in srgb, var(--x) N%, transparent)`，不写 rgba 魔法数。
禁用纯黑纯白；暗色投影统一暖棕基调 `rgba(94, 62, 24, …)`。

### 4.2 字体

- Display：**Baloo 2**（`--font-display`，next/font 加载）——标题、按钮、
  eyebrow、价格、名牌。
- Body：**Nunito Sans**（`--font-body`）——正文 1.0625rem / 1.65。
- eyebrow/kicker 模式：display 字体 + 700-800 字重 + `0.14-0.16em` 字距 +
  大写 + 橙深色（各 module 里的 `.eyebrow` / `.kicker` / `.panelKicker`）。
- 数字对齐场景（价格、计数）加 `font-variant-numeric: tabular-nums`。

### 4.3 形状 / 阴影 / 布局

- 圆角：控件 `--r-ctrl:10px` · 卡片 `--r-card:14px` · 大媒体/面板
  `--r-media:22px` · 胶囊按钮 `999px`。
- 阴影：`--shadow-soft`（卡片）/ `--shadow-lift`（浮起面板）。
- 容器：`.shell` = `min(1140px, 100% - clamp(2.5rem, 7vw, 6rem))` 居中。
- 间距用 `clamp()` 流式（如 section `padding: clamp(3.5rem, 6.5vw, 5.5rem) 0`）。
- 断点习惯：**900px** 一刀（PDP/购物车栅格塌单列、粘性面板转静态、
  移动端粘性底条出现）；Nav 链接 720px 隐藏。
- PDP 主舞台栅格：`1.08fr / 0.92fr`，右栏 `position: sticky; top: 5.5rem`。

### 4.4 动效语言（站点的"性格"所在）

- 缓动：`--ease-out: cubic-bezier(.22,.61,.21,1)`（常规收尾）、
  `--ease-soft: cubic-bezier(.34,1.2,.64,1)`（**轻微过冲**，用于位移/浮起）。
  **禁止** bounce/elastic/linear。
- 时长：`--dur-fast:240ms / --dur-mid:420ms / --dur-slow:640ms`。
- 进场统一走 `components/Reveal.tsx`（IntersectionObserver 一次性上浮浮现），
  同组元素 delay 错峰 **80–120ms**。
- hover 语汇：`translateY(-2px)`（按钮/卡片）＋阴影加深；active `scale(0.98)`。
- 大动效只放在高价值时刻（hero 定格编排、抽屉滑入），不撒微交互。
- `prefers-reduced-motion`：globals 里全局 0.01ms 降级 + 组件内显式分支
  （hero 不自动播、抽屉改淡入）。**新动效必须过 reduced-motion 这关**。

### 4.5 组件语汇（写新 UI 前先翻这些现成模式）

| 模式 | 参考实现 |
|---|---|
| 纸面板（购买/结算/候补） | `components/pdp/pdp.module.css` `.panel` |
| 虚线分隔 | `border-top: 1.5px dashed color-mix(...26%)` |
| 圆点列表 | `.panelNotes li::before` 橙色 6px 圆点 |
| 步骤条 01/02/03 | `pdp.module.css` `.steps`（counter + 半透明大数字） |
| 纸吊牌 | hero 的 tagCard（`ArtworkSwitcher.module.css`） |
| 画芯选择器 | `ScratcherShop.module.css` `.picks/.pick/.picked`（橙描边选中） |
| 规格双卡 | `.formats/.format/.formatOn` |
| 数量步进器 | `CartView.module.css` / `CartDrawer.module.css` `.stepper` |
| 抽屉 | `components/cart/CartDrawer.*`（backdrop blur + visibility 延迟收尾） |
| toast | `CartContext.module.css`（勾 + 标题 + line + note 双行语义） |
| 空态 | `CartView` / `CartDrawer` 空态（大标题 + 一句幽默 + 主 CTA） |
| 行内表单 | `components/WaitlistForm.*`（胶囊输入 + 蓝色提交 + 行内报错） |

a11y 基线：radiogroup/radio + aria-checked 做选择器；dialog + aria-modal
做抽屉；`.srOnly` 藏 label；`:focus-visible` 全局蓝描边；aria-live 报状态。

---

## 5. 页面地图与交互要点

```
/                    landing（引流层，不承载购买细节）
  Hero               满屏影片剧场（见 §5.1）
  CanvasCollection   #canvas 系列刊头 + The lineup 目录卡 + Filmstrip + 两张 PortalCard
  TheShelf           #coming-next What's next：featured 卡 + 未上市占位卡（WaitlistForm compact）
  BrandStory         #story 小工作室叙事
  FinalCta           夜色收束双 CTA
/scratcher           抓板 PDP：图库(12图) + 双规格购买面板 + 卖点/工艺/换画/胶片 + CrossSell
/scratcher#prints    直达并预选「Print only」规格（hashchange 监听）
/house               猫屋 PDP：夜幕影片 + waitlist 面板 + 剧照 + 流程 + CrossSell
/cart                购物篮整页（Nav 走抽屉；此页兼任 Stripe cancel_url）
/checkout/success    付款成功页（轮询 /api/order 拿订单号；进页即清空购物篮）
/shipping-returns    运费与退货政策（26/188 规则、30 天退货、ACL 声明）
/care                养护指南 · /privacy 隐私 · /terms 销售条款
                     （共享 components/policy/PolicyPage 布局；Footer Help 栏入口）
```

关键交互约定：

- **抓板 PDP 联动是单向的（用户明确设计）**：右侧选画芯 → 左侧主图跳到
  该画芯的白底框内预览（图库前 6 张 = ARTWORKS 顺序）；左侧手动翻图
  **绝不**回写右侧选择。
- 购物篮：Nav 篮子 → 抽屉；商品页加购只弹 toast 不开抽屉。
- Filmstrip（横向胶片）：scroll-snap + 拖拽 + 计数；索引计算必须减去
  `kids[0].offsetLeft` 基准（踩过坑，见 §9）。
- Nav：滚动 >12px 即上半透明奶油底 + blur（内页内容从页顶开始，晚了会叠字）。

### 5.1 Hero 剧场（本站最值钱的部分，动它前先读）

- 状态机：10s 影片播放 →（HERO_TIMINGS 标题/副标题按秒淡入）→ `onEnded`
  定格末帧 → 错峰浮现（settle 0ms → CTA 680ms → 吊牌 1500ms → 滚动提示 2300ms）。
- 换画无缝的原理：`public/hero/art/art-0X.png` 不是平面画，是
  **末帧画框区域的完整合成图**（透视 warp + 光照图 + 画布纹理 + 视频解码
  色彩校正全部离线烘焙）。前端只做交叉溶解 + alpha 蒙版（只画画布区域）。
- 所有可调参数集中 `lib/heroConfig.ts`：视频尺寸 1664×1248（4:3）、
  `COVER_FOCUS {x:0.38}`（**它同时驱动 CSS object-position 和
  useVideoRect 坐标换算，两处必须同源**）、FRAME_RECT 从
  `lib/frame-rect.json` 读（管线自动写入，**永远不要手改**）。
- 覆盖层三条铁律：播放期间整层 opacity:0（别挡猫）；蒙版 PNG 必须带
  **alpha 通道**（mask-image 只认 alpha）；蒙版边界是解析直线 + 出血在
  中性暗缝里（详见 README「artwork pipeline」）。
- 交互：点画框/点备用画芯/键盘←→ 换画；备用画芯是**重叠斜靠堆**
  （`.mini + .mini { margin-left: -42% }` + z-index 递增）。
- 备注：hero 顶部代码注释里留了"未来做成可横向滑动的多系列 hero"的规划。

---

## 6. 资产管线（tools/ + 供应商素材）

素材源（不入库）：`GlugGlug30天发文计划/`（71 张 3:4 营销图，含 6 张
IMG_43xx 白底正拍模板）、`Glug视频/`（9 条 9:16 竖版）。成品在
`public/c01/`（已全部 de-logo + 无中文）与 `public/hero/`。

### 6.1 上新画作 SOP

1. 供应商白底正拍（IMG_43xx 同模板）放进源目录；
2. `tools/extract_flats.py` 加一行映射 → 跑 → 产出 `flat-0X.png`（1400×2000）
   （饱和度掩膜找画布内沿；检测不合理自动回退共识框——波光这种浅色
   闪光画面必踩）；
3. `python3 tools/make_artworks.py` → 合成 `art-0X.png` + 重写 frame-rect.json；
4. `lib/heroConfig.ts` ARTWORKS 加一项（英文名找用户定或自拟）；
5. PDP 预览图：白底正拍裁剪 `crop=(80,797,1240,2074)` + LaMa 修掉框顶
   印字（模板一致，文字框约 `(522,104,645,151)`）→ `public/c01/print-0X.webp`；
6. 检查：hero 换画、选画器、图库联动、无 logo 无中文 → commit。

### 6.2 De-logo 方法论（血泪教训沉淀）

- **唯一可靠流程**：画红框标 bbox → **目检红框图** → LaMa 修复 →
  修复区贴回原图（掩膜外零改动）→ 前后对比目检。
- 手写坐标克隆、OpenCV Telea、插值填充全都翻过车；**永远不要相信没画
  在图上验证过的坐标**。
- LaMa 环境：python3.12 venv（历史在 scratchpad，可按 `simple-lama-inpainting`
  重建；权重缓存 `~/.cache/torch`）。venv 的 Pillow 不支持 webp——PNG 中转，
  webp 转换用系统 python。
- 视频里的 logo：逐帧修不现实（手持抖动 + LaMa 会幻觉出笔画），正解是
  **整段替换成无 logo 镜头** + 单帧静态补丁（亮度环形增益逐帧跟踪），
  场景切点用 `ffprobe -vf "select=gt(scene,0.25)"` 定位。

---

## 7. 商务后端（P2，commit `4ca870b` 起）

架构：**Vercel 唯一计算层**；Stripe 托管结算收款；Supabase 存订单/候补；
Resend 发交易邮件。服务端逻辑全部在 API Routes（无 Edge Functions）。

```
加购(localStorage) → POST /api/checkout → Stripe hosted checkout
    → webhook → /api/webhook → orders 表 + 扣库存 + 确认邮件
    → 浏览器回 /checkout/success（轮询 /api/order）
发货：POST /api/shipping (Bearer ADMIN_SECRET) → shipped/delivered + 发货邮件
      （日常首选本地 admin 的 Orders 页，见 §7.5）
退款同步：webhook 另订 charge.refunded → orders.refunded_cents 写
      charge.amount_refunded 权威累计值（幂等；兜住 Stripe Dashboard 手工退款。
      ⚠️ 既有生产 endpoint 还没订这个事件——跑一次 npm run stripe:setup 会
      自动补订；admin 内退款不依赖它）
候补：WaitlistForm → POST /api/waitlist → waitlist 表
```

不可妥协的设计决策：

- **Supabase `products` 表是商品（SKU/价格/库存/文案/上下架/Stripe Price ID）
  的唯一事实源**（admin-platform 分支起；原 `lib/catalog.ts` 常量已退役，
  该文件现在是读取入口 `getCatalog()/getCatalogMap()` + 运费常量）；
  `/api/checkout` 服务端 re-derive + 校验库存，客户端只被信任"买什么买几个"。
- **webhook 幂等**：`orders.stripe_session_id` unique + upsert
  ignoreDuplicates；写库失败 → 500（Stripe 重试），邮件失败只记日志。
- **orders / waitlist 两表 RLS 开、零策略**：只有 `sb_secret` 服务端可达。
- 邮件无 key 静默降级（`[email]` 日志），任何环境缺 env 都不崩页面。
- Afterpay 异步支付：completed 事件 `payment_status` 可能未付，只记已付；
  `async_payment_succeeded` 再落库。

现状快照（2026-07-12）：

- Stripe **test mode**：scratcher `price_1TsHxoDzmUuzRpRKdgcL52kJ`(8900) /
  print `price_1TsHxpDzmUuzRpRKRnGBcpHp`(3500) / house
  `price_1TsHxqDzmUuzRpRKebu6oZDS`(18900，暂不可购)。生产 webhook
  endpoint 已建（`we_1TsHyPDzmUuzRpRK4IFwjfau` → roomiepaw.vercel.app），
  whsec 已交用户配 Vercel。沙盒支付方式只有 Card/Klarna/Zip，
  **Afterpay 与 Stripe Tax 需 Dashboard 手动开**（runbook checklist）。
- Supabase：项目 `wfqhqxojuaudycdrkjpy`（悉尼），迁移记录在
  `schema_migrations`；本地迁移 `npm run db:migrate`（直连是 IPv6-only
  会 ENOTFOUND，脚本自动退 `aws-0-ap-southeast-2.pooler` ✓）。
- Resend：域名未验证 → 只能从 `onboarding@resend.dev` 发给账户本人邮箱。
- 测试订单 **№ 1001**（paid→shipped→delivered 全走过，真实邮件已发）。
- **待用户**：把交付的 env 清单贴进 Vercel → 允许 push 部署。

猫屋当前 **waitlist-only**（选号预售已撤销）；开售步骤见 runbook「猫屋开售」。

---

## 7.5 商品数据与本地 Admin（admin-platform 分支，2026-07-13）

**为什么**：改价原来要「改代码 → 重跑 stripe:setup → 回填 → 部署」，库存概念
根本不存在。真库存（卖一减一）必须有可变存储 → 商品数据整体迁入 Supabase
`products` 表（迁移 `0005_products.sql`），主站从表读取；本地 admin 后台
点一下改价/补货，**约几秒内全站生效，不需要部署**。

**数据模型（R1 修订后，三层）**：

1. **组件库存 `stock_items`**（迁移 0006）：备货单位 = `frame` + `print-01..06`
   （id 序对齐 ARTWORKS）。`stock` 语义：`null` = 不限量/不跟踪（默认）、
   数字 = 严格跟踪、`0` = 售罄、负数 = 并发竞态信号（admin 红色 OVERSOLD；
   决策：不做预留锁，小店量级诚实模型）。`available=false` = **画作退役**
   （seasonal drop 下场）：购买动线（PDP 选择器/图库预览）彻底消失，
   与售罄（显示但标 out）不同；hero 换画交互是品牌艺术层不过滤。
   画框不可退役（admin 拦）。低库存阈值 **<10**（`LOW_STOCK_AT`，前台标
   low stock、后台红色警报；改要同步 `lib/inventory.ts` 与 `admin/lib/types.ts`）。
2. **BOM 可售判定**（`lib/inventory.ts componentsFor`，admin 侧
   `BOM_HANDLES` 同步）：Frame+print·画X = frame 可买 ∧ 画X 可买；
   Print only·画X = 画X 可买。→ 画框售罄 = Frame+print 整列 sold out、
   Print only 不受影响；某画售罄 = 两规格下该画都不可买。BOM 商品的
   `products.stock` 弃用置 null（admin 显示 by inventory units，防双重记账）。
3. **商品级 `products`**：`available` 总开关 + **`sellable`**（有完整购买
   流程才可上架；当前仅 scratcher/print。防猫屋误上架地雷：页面是候补
   表单而候补接口会拒 available=true）。`products(handle PK, title, tagline,
   price_cents, image, stripe_product_id, stripe_price_id, stock, available,
   sellable, numbered, sort)`，RLS 开零策略。

webhook 首次写单成功后按 BOM 展开调 `decrement_stock_item`（非 BOM 商品
调 `decrement_stock`）原子扣减（PostgREST update 不支持表达式，必须走
函数）；幂等由 `stripe_session_id` unique 保证。checkout 双层校验：
商品级（canBuy + products.stock）+ 组件级（BOM 聚合），409 报具体组件
（`{error:"sold_out", component, title}`）。

**下架/售罄的前端语义**：某规格下架 → PDP 对应 radio 禁用 + 说明；两规格
全下架 → 购买面板换候补表单（猫屋先例，waitlist API 对 !available 放行）；
售罄 ≠ 下架（不收邮箱，显示 sold out）。landing 清单卡/门户卡/FinalCta/
TheShelf 链接的 meta 文案全部跟随状态（waitlist open / sold out ·
restocking / 价格）。**What's next 只放 `!sellable` 且无专页的商品**
（`TheShelf HAS_OWN_PAGE` 排除 scratcher/print/house——迁移曾让猫屋混入
该区，R1 修复）。

**主站读取链**：root layout `force-dynamic`（**必须显式**——否则构建时
预渲染把旧价烧进静态 HTML）+ 查表注入 `CartProvider`（客户端购物车只拿
展示快照：handle/title/price/image/numbered/soldOut）；页面价格全部
服务端查表（landing 刊头/门户卡/FinalCta/TheShelf/两 PDP/care/hero
ctaNote——hero 的 ctaNote 现在是 `(price) => string` 函数）。结算金额
永远服务端 re-derive，快照只管显示。

**admin 应用**（`admin/` 独立 Next app，**永不部署**）：

- 启动：`npm --prefix admin install`（一次）→ 日常 `npm run admin:fast`
  （prod build+start，页面切换 ~50ms）或开发 `npm run admin`（Turbopack dev）
  → http://127.0.0.1:3100，口令 = `ADMIN_SECRET`（30 天 cookie）。
  两种模式共用 `admin/.next`，**不可同时开**（同主站 §9.1 坑）。
- **UI（2026-07-14 重设计）**：与主站同一 design system——Baloo 2/Nunito Sans
  （next/font）、cream/paper/橙蓝 token、暖棕阴影、色点软底状态徽章、虚线
  时间线。骨架 = 侧栏（(app) route group 内，登录页无导航）+ 内容；侧栏
  Orders 项带待发货角标（layout head-count 查询）。每路由有 loading.tsx
  骨架屏；`experimental.staleTimes.dynamic=30` 让 30s 内切回走客户端缓存
  （server action 后 router.refresh() 仍强制拉新——改这个值要想清楚这两者）。
- 五页（2026-07-14 订单管理全面化，spec
  `docs/superpowers/specs/2026-07-14-admin-order-management-design.md`）：
  - **Dashboard（/）**：净营收 KPI（今日/7d/30d，已扣退款）/单量/AOV/
    累计退款、30 天 SVG 柱状图、Top products、库存警报、最近订单、候补数、
    待办行（待发货/退货中）。全部服务端 JS 聚合（jsonb 不上 PostgREST 过滤）。
  - **Orders**：搜索（ref/邮箱/姓名/运单/商品）+ 状态 chips + 分组工作台。
    每单：明细/地址/支付（Stripe Dashboard 直链，test/live 感知）/时间线/
    内部备注（orders.admin_note）/按状态动作。动作 = 发货、送达、
    **取消（退款先行，失败不落库；可选回补库存）**、**部分/全额退款**
    （Stripe by payment intent，refunded_cents 回读 charge 权威值）、
    **退货流**（start → mark returned[可选退款+回补] / cancel return）、
    **联系客户**（自由主题+正文，品牌壳）、重发确认/发货邮件、装箱单
    （/orders/[ref]/slip 可打印，ABN TODO）、Export CSV（对账列）。
  - **Products（/products）**：原首页整体平移（改价/上下架/文案/库存，机制不变）。
  - **Customers**：按 email 聚合（单数/累计净消费/每单状态/waitlist 交叉）。
  - **Waitlist**（分组 + CSV 导出）。
- **订单状态机**：paid → shipped → delivered 主线；paid → cancelled（退单）；
  shipped/delivered → return_requested → returned（退货）。退款独立于状态
  （refunded_cents 累计，部分退款只加徽章）。里程碑时间戳全在 orders 列上，
  `order_events` 表只记流水（refund/email/restock/return_cancelled）——
  时间线 = 列派生 + 事件合并，防双写漂移。回补库存走 restock_item/
  restock_product RPC（decrement 的对偶），只记真实回补（untracked 单元
  是 RPC 静默 no-op，代码先查跟踪集再回补）。
- **改价机制**：Stripe Price 金额不可变 → admin 自动「建新 Price → DB 回写
  → 归档旧 Price」（旧价保持 active 到最后一步，改价过程结算不断档；
  DB 写失败自动归档新价回滚）。
- **安全四层**：只绑 127.0.0.1（局域网不可达）/ middleware Host 白名单
  （防 DNS rebinding）/ ADMIN_SECRET 口令 cookie（sha256 派生，无状态）/
  密钥只在 server actions（读根 `.env.local`，零拷贝）。主站 tsconfig
  `exclude: ["admin"]`，admin 代码物理不进生产构建。
- 发货目标：默认打生产 `/api/shipping`；根 `.env.local` 设
  `SHIPPING_API_ORIGIN=http://localhost:3000` 可改打本地 dev（同一个
  Supabase/Resend，功能等价；本地主站 dev 得起着）。

**切 live Stripe 那天**（补充 runbook checklist）：换 live key 后，products
表里的 `stripe_price_id` 仍是 test mode 值——在 admin 里对每个在售商品
「改价」一次（同价即可）就会在 live 侧重建 Price 并回写；占位商品用
Create in Stripe。**不再需要重跑 stripe:setup 回填代码。**

**已知缺口（2026-07-13）**：Vercel 生产的 `ADMIN_SECRET` 与本地
`.env.local` **不一致**（生产 shipping API 回 401，旧 curl 发货流程同样
受影响）——用户需在 Vercel env 里把 `ADMIN_SECRET` 对齐成 `.env.local`
的值（或反向），admin 发货即通。

---

## 8. 密钥与环境

| 位置 | 内容 |
|---|---|
| `.env.local`（gitignored） | 全部真实密钥（Stripe test sk / Supabase secret + DB 密码 / Resend / ADMIN_SECRET / 本地 whsec） |
| `.env.example`（入库） | 模板 + 每个变量的注释 |
| Vercel Production env | 上线同名变量（生产 whsec 与本地不同！生产值只存在于交付给用户的文件里） |

本地全流程联调：`stripe listen --api-key $STRIPE_SECRET_KEY
--forward-to localhost:3000/api/webhook`，把打印的 whsec 写进
`.env.local` 再起 dev。

---

## 9. 工程习惯与已踩坑（新 agent 最容易在这翻车）

1. **dev server 运行中绝不跑 `next build`**——共用 `.next`，会把 dev 缓存
   打坏（vendor-chunks ENOENT、全站裸 HTML）。恢复：停服 → `rm -rf .next`
   → 重启。
2. **视觉验证用 Playwright**（scratchpad 装 playwright + chromium），
   不要信 Claude in-app Browser pane 滚动后的截图（合成层过期，只有
   整页首帧可靠）。断言 computed style / DOM 文本 + 截图双保险，
   **截图必须实际用 Read 看**，别只看断言过了。
3. Stripe 托管页自动化：支付方式是折叠 radio
   `input[name='payment-method-accordion-item-title']`（样式隐藏 →
   `check({force:true})`），选完等 `#cardNumber` visible 再填 4242。
4. Filmstrip / scroll-snap：索引和 scrollTo 都要减 `kids[0].offsetLeft`
   基准，否则 snap 回吸让计数卡死。
5. `mask-image` 只认 **alpha 通道**——灰度 PNG 蒙版等于没有；验证要验
   "效果"而不是"样式已应用"。
6. 覆盖类资产 2× 超采样输出，否则 Retina 上直线出锯齿。
7. Supabase jsonb 的对象数组 containment（`.contains`）在 PostgREST 侧
   易翻车——小表直接取列 JS 过滤。
8. Reveal 的 `as` 联合类型不全时直接扩（已含 p/div/section/li/figure）。
9. 改 `.env.local` 后要重启 dev server 才生效。
10. 新页面用到 `useSearchParams` 必须包 `<Suspense>`（success 页先例）。
11. Webhook 签名密钥**只在创建 endpoint 时返回一次**，拿到立刻落盘，
    别让它进终端管道（丢过一次，删了重建才拿回）。
12. 根 tsconfig 的 `include: ["**/*.ts"]` 会把 `admin/` 卷进主站类型检查
    ——必须 `exclude: ["admin"]`；`.gitignore` 的 `/node_modules` 带根锚定，
    admin 的要单独加。
13. admin 表格里"受控 checkbox + server action + router.refresh"会闪回旧态
    （React 受控值等 refresh 才变）——状态切换用明确的按钮，别用 checkbox。
14. 商品数据进表后，**新页面/组件里的价格一律服务端查表传 props**，
    别再写死 AU$ 字面量（landing/PDP/care/hero 都已参数化，grep
    `AU\$[0-9]` 应只剩运费常量语境）。

---

## 10. 决策日志（为什么是现在这样）

| 时间 | 决策 | 备注 |
|---|---|---|
| 07-07 | 建站，hero 剧场 + 换画交互定型 | jimeng 生成 4:3 影片 |
| 07-11 早 | 集合店架构 v3：landing 引流 + PDP 承接 | commit `d7bf9ea` |
| 07-11 晚 | **去集合店化**：自有宠物家居店叙事；供应商品牌全清除 | commit `7311cc4`，红线定死 |
| 07-11 深夜 | 六幅真画替换手绘占位（extract_flats 管线） | `4b03891` |
| 07-12 | 画芯单卖 + 选画→预览单向联动 | `bd4bacf` |
| 07-12 | P2 真实电商：Stripe/Supabase/Resend；猫屋改结算即收款 | `4ca870b`，Shopify 方案正式退役 |
| 07-12 深夜 | 购物篮抽屉；**猫屋撤销选号预售改 waitlist**（问邮箱+校验） | `16daf28`，用户拍板 |
| 07-12 深夜 | Nav 12px 上底修字叠 | `3988020` |
| 07-13 | **商品数据迁 Supabase products 表 + 本地 admin 后台**（改价/库存/发货/waitlist 全后台化；推翻"商品数据用代码常量"决策——真库存必须可变存储） | admin-platform 分支，spec `docs/superpowers/specs/2026-07-13-local-admin-design.md` |
| 07-14 | **admin 订单管理全面化**：六态状态机（+取消/退货流）、Stripe 退款（部分/全额，refunded_cents 存权威累计值）、order_events 时间线、联系客户/重发邮件、Dashboard 统计、Customers、订单 CSV、装箱单。原则：退款先行（退款失败则取消/收货不落库）、里程碑不双写 | 用户全权委托；spec `2026-07-14-admin-order-management-design.md`，25 项 e2e 验证含真实 test-mode 退款 |

---

## 11. 上手 15 分钟（新 agent 自检清单）

```bash
npm install
# .env.local：向用户要，或按 .env.example 填（缺 key 也能起，功能降级）
npm run dev                      # localhost:3000
npx tsc --noEmit                 # 应零错误
```

1. 首页看 hero 全程：影片 → 定格 → 文字/CTA/吊牌错峰浮现 → 点备用画芯换画。
2. /scratcher：切 Print only → 选 Window Glow → 主图跳框内预览 →
   点别的缩略图 → 右侧选择不动（单向联动 ✓）。
3. 加购 → Nav 篮子 → 抽屉滑入 → Checkout securely → 到 Stripe 页即证明
   `/api/checkout` 通（不必付款）。付款全链路要先起 `stripe listen`（§8）。
4. /house：waitlist 输错邮箱看行内报错，输对看成功态。
5. 翻一遍 §1 红线，然后放心动手。

有不确定的先问用户（中文），小事自己定但在交付说明里讲清楚。
