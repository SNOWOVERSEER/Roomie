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
Supabase 订单/候补 + Resend 邮件，Vercel（syd1）经 GitHub CI/CD 部署，
正典域名 **https://roomiepaw.com.au**（2026-07-19 绑定；roomiepaw.vercel.app
仍作别名服务，Stripe webhook 端点留在其上）。本地一笔沙盒订单（№ 1001）
已全流程走通。

---

## 1. 红线（违反 = 事故，先读这节）

1. **供应商品牌（GlugGlug）只以「partner workshop」身份低调露出**
   （2026-07-19 用户拍板，推翻 07-11 的全禁版）。允许且**仅允许**两处：
   footer 的 Partners 列 + 各 PDP 的品牌铭牌行（`components/PartnerMark.tsx`，
   位置规范见 `docs/PDP_TEMPLATE.md`）。其余照旧全禁：产品图/视频**像素里**
   的 logo（de-logo 管线不变，§6，新素材上站前仍须目检）、hero/标题/卖点
   等首要宣传位、metadata/OG、邮件。理由：产品确属 GlugGlug（中国小众
   品牌，AU 无认知），提及是诚实姿态但不做首要宣传。
   历史摇摆：07-11 早"logo 没事"→ 07-11 晚全禁 → 07-19 松绑为本口径。
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
  猫屋开售时间/价、footer 帮助页链接是 `#`；Resend 发件域名 07-21 已就绪，见 §7）。
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
  share with your pets*。
- **品牌层 vs 产品层的物种口径（2026-07-15 用户纠偏，红线级）**：
  RoomiePaw 是**宠物**家居店（狗等品类都会做），**品牌层文案不许锁死在
  cat**——metadata/OG、页脚、BrandStory、What's next、政策页、邮件壳
  一律说 pets；只有**产品本身是猫产品**的地方（Canvas Series 的 hero
  标题、/scratcher、/house、照片 alt/caption 的事实描述）才允许 cat。
  新增品类/文案时按这条自检。
- 文案声线：克制的幽默 + 拟猫视角旁白。例句（保持这个味道）：
  - "A framed print your cat is allowed to ruin — slowly, and with great ceremony."
  - "The daily shred, honoured in full."
  - "straight off the set — no actors, just residents"
  - 空购物篮："The wall is still bare — and somebody has claws."
- 计数/编号用 `№`（№ 01 / 06），全站统一。
- 价格写法 `AU$89`；**税话术：无**（店主未注册 GST，2026-07-21 起全站
  不出现 GST 字样、单据不称 tax invoice、Stripe Tax 不开；注册 GST 后
  才恢复——届时装箱单补 ABN+GST 行、STRIPE_TAX_ENABLED 才可开）；
  运费话术**分层**（07-19 定稿）：
  品牌层（footer/FinalCta/页面 metadata/terms 概述）只说 "ships
  Australia-wide" / "shown before you pay"，**不出现金额**；26/188 只
  出现在购买流程事实层（PDP 面板、购物车抽屉、checkout）与政策页
  （callout 带 "for our current pieces" 限定）。常量见 `lib/catalog.ts`
  SHIPPING，对客页面 /shipping-returns；多档模型定稿见 §7 运费段。
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
- 进场统一走 `components/Reveal.tsx`（IntersectionObserver 一次性上浮浮现，
  视口下方 10% 预热触发），同组元素 delay 错峰 **80–120ms**。
  唯一例外 FinalCta：深色整幅收束段，文案直出不走进场（原因见组件内注释）。
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
| 合作品牌标 | `components/PartnerMark.tsx`（官方猫耳 g 圆标=内嵌 SVG path，PIL 几何重建+potrace 矢量化，**evenodd** 挖洞透底色、fill=currentColor 任意底自适应；字标 Georgia 栈；主色变量 `--pm-mark`；铭牌行样式 `pdp.provenance`） |
| 纸吊牌 | hero 的 tagCard（`ArtworkSwitcher.module.css`） |
| 画芯选择器 | `ScratcherShop.module.css` `.picks/.pick/.picked`（橙描边选中） |
| 规格双卡 | `.formats/.format/.formatOn` |
| 数量步进器 | `CartView.module.css` / `CartDrawer.module.css` `.stepper` |
| 抽屉 | `components/cart/CartDrawer.*`（backdrop blur + visibility 延迟收尾） |
| toast | `CartContext.module.css`（勾 + 标题 + line + note 双行语义） |
| 空态 | `CartView` / `CartDrawer` 空态（大标题 + 一句幽默 + 主 CTA） |
| 行内表单 | `components/WaitlistForm.*`（胶囊输入 + 蓝色提交 + 行内报错） |
| 活动栏位 | `components/promo/PromoBar.*`（夜蓝细条，grid-rows 0fr/1fr 收放） |
| 居中弹层/底部抽屉 | `components/promo/SubscribeDialog.*`（纸卡 + 移动端 sheet + 焦点圈闭） |
| 优惠票券 | `SubscribeDialog.module.css` `.ticket`（虚线橙框 + 微倾 + user-select: all） |
| 图片加载微光 | `components/SmartImg.*`（无包装层，背景微光 + 解码后落定；轮播类自管加载态勿用） |

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
2. `tools/extract_flats.py` 加一行映射 → 跑 → 产出 `tools/flats/flat-0X.png`
   （1400×2000；饱和度掩膜找画布内沿；检测不合理自动回退共识框——波光
   这种浅色闪光画面必踩），随后跑 `tools/make_flat_thumbs.py` 生成
   `flat-0X-s.jpg`（420×600 缩略版）。**两种都必须在 public/hero/art/**：
   全尺寸 png 是 make_artworks 的合成输入；`-s.jpg` 是站点缩略资产——
   hero 备用画芯堆（ArtworkSwitcher）、购物车行缩略图（cart/
   lineImage.ts）、邮件 itemThumb（lib/email.ts）都按 `flat-0${i+1}-s.jpg`
   模板拼接引用（jpg 不用 webp 是迁就 Outlook 邮件端）。教训（07-19 清理
   曾据字面 grep 误判 flat"未引用"挪走 → 生产 404 事故）：**判死资产必须
   grep 文件名前缀**，模板拼接抓不到完整文件名；
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
- **多档运费模型（2026-07-19 用户拍板，首个大件 SKU 进库时才实现，
  别提前建）**：每商品自带运费值（products 表加字段，admin 可编辑），
  订单运费 = **订单内运费最高那一件的运费**（max 规则，不逐件叠加）；
  免邮线 188 **只对纯标准件订单生效**，含大件订单不参与免邮。实现时把
  `SHIPPING` 常量升级成 `quoteShipping(items)` 单点函数（购物车运费行、
  免邮差额提示、Stripe shipping_options、orders.shipping_cents、邮件行
  全部走它）；大件 PDP 面板价格旁标 "Delivery AU$XX"。已知取舍：同单
  两件大件按 max 会让掉一件运费，量小可接受，频繁出现再加"同档第二件
  附加费"。现售三件（抓板/替芯/house）全是标准档，模型退化为现状。
- **webhook 幂等**：`orders.stripe_session_id` unique + upsert
  ignoreDuplicates；写库失败 → 500（Stripe 重试），邮件失败只记日志。
- **orders / waitlist 两表 RLS 开、零策略**：只有 `sb_secret` 服务端可达。
- 邮件无 key 静默降级（`[email]` 日志），任何环境缺 env 都不崩页面。
- Afterpay 异步支付：completed 事件 `payment_status` 可能未付，只记已付；
  `async_payment_succeeded` 再落库。

现状快照（2026-07-15，admin-platform 已合并 main 并部署）：

- **生产已跑 DB 化代码**：全站 force-dynamic 从 products/stock_items 读，
  改价补货免部署生效。生产 Supabase env ✓（/api/order 探针 404 干净）；
  **Stripe checkout ✓**（test mode，真实 session 创建成功）。旧部署的结算
  故障根因是「07-13 改价事故归档掉的 price id 还硬编码在旧代码里」——
  DB 化代码读表里的现行 id，合并顺带自愈。
- **在售价格**（2026-07-30 实测生产）：scratcher **AU$159**、print
  **AU$49**。这条曾长期记着「149/42 是 07-13 测试残值、正典价 89/35」，
  已作废——07-21 店主确认表值就是定价，之后又自行改过。**定价以
  products 表为准，别信文档里的数字**；要看现值扫一眼线上页面即可。
- 生产 `ADMIN_SECRET` 与本地**一致**（2026-07-30 实测：带正确凭证 POST
  `/api/shipping` 空 body 得到 400 参数校验错误而非 401，证明配了且对得上；
  空 body 不触及任何订单，是个无副作用的探测法）。此条曾记着「不一致」，
  已作废。
- **webhook 全链路已通（07-15 晚）**：`charge.refunded` 已订阅；e2e 曾
  揭穿 Vercel 的 `STRIPE_WEBHOOK_SECRET` 装着本地 stripe listen 的 whsec
  （真实事件全被 bad signature 拒收 = 生产付款不入库不发信；历史测试全走
  本地转发从未暴露），店主已换成 Dashboard 端点签名密钥，合成退款实测
  **5 秒**同步回库。⚠️ 本地 `.env.local` 的 whsec 也被换成了生产端点值：
  下次本地 `stripe listen` 联调前，必须按 §8 把它换回 listen 打印的值，
  否则本地 webhook 验签会挂。
- 结算回跳 URL 已加固（`lib/env.ts publicOrigin()`）：生产上 NEXT_PUBLIC_URL
  误配 localhost 也不会把付完款的客户带去 localhost。

历史快照（2026-07-12）：

- Stripe **test mode**：scratcher `price_1TsHxoDzmUuzRpRKdgcL52kJ`(8900) /
  print `price_1TsHxpDzmUuzRpRKRnGBcpHp`(3500) / house
  `price_1TsHxqDzmUuzRpRKebu6oZDS`(18900，暂不可购)。生产 webhook
  endpoint 已建（`we_1TsHyPDzmUuzRpRK4IFwjfau` → roomiepaw.vercel.app；
  07-19 换正典域名后**故意保留在 vercel.app**——server-to-server 不受
  影响，换端点得重配 whsec），whsec 已交用户配 Vercel。沙盒支付方式只有 Card/Klarna/Zip，
  **Afterpay 需 Dashboard 手动开**（runbook checklist）；Stripe Tax
  在店主注册 GST 前**禁止开**（07-21 口径，见 §3）。
- Supabase：项目 `wfqhqxojuaudycdrkjpy`（悉尼），迁移记录在
  `schema_migrations`；本地迁移 `npm run db:migrate`（直连是 IPv6-only
  会 ENOTFOUND，脚本自动退 `aws-0-ap-southeast-2.pooler` ✓）。
- Resend（07-21 起新账户，旧账户绑了店主另一域名）：`roomiepaw.com.au` 已验证（东京区，DKIM/SPF 三条 DNS 在），发件人 `RoomiePaw <hello@roomiepaw.com.au>`，客户邮件可达；**根域 MX 已指向 Resend receive（07-27 店主自配，`inbound-smtp.ap-northeast-1` dig 实证）**：hello@ 来信落 Resend（dashboard 可查、webhook/Forward 可接）；**收件转发已上线 `app/api/inbound/route.ts`（07-27）**：验签（SDK `webhooks.verify`，Standard Webhooks；注意 headers 参数是 `{id,timestamp,signature}` 对象不是 web Headers）→ 守卫链（自域/退信机器人/仅 hello@/Auto-Submitted）→ 读原文重发（**不用 receiving.forward**：passthrough 会把 From 换成我们且无 Reply-To，回复会回到自己头上，07-27 实测）——From=`客户名 via RoomiePaw <inbox@域>`、To=hello@（Gmail 自动选中 send-as 身份）、Bcc=`INBOUND_FORWARD_TO`、Reply-To=客户、Subject 原样；转发副本回流 receiving 属预期（自域守卫挡二次转发）。店主 Gmail 用 send-as 以 hello@ 回信（SMTP smtp.resend.com:587，user `resend`，pass=专用 API key）；**MX 独占：将来上真邮箱服务需迁 MX，Resend 收件即停**；本地 .env.local 已换新 key+from，**Vercel env 的 RESEND_API_KEY/RESEND_FROM 由店主同步 + Redeploy**。首封实测邮件已从 hello@ 发出。
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

**主站读取链**（2026-07-30 重构，下面这套是现行事实）：

root layout 仍是 `force-dynamic`（**必须显式**——否则构建时预渲染把旧价
烧进静态 HTML），但**不再 await 目录**。它把一个未 await 的
`getCartSnapshot()` promise 交给 `CartProvider`，由客户端用 effect 解开
（**不能用 `use()`** ——那会让 provider 连同 children 一起挂起，等于没改）。
首页价格是 Suspense 包着的流式叶子，三个取数 section 各有自己的边界；
Hero 因此立刻挂载，入场动画不被打断。**为什么这么写**：从前那句 await
挡在所有 JSX 之前，Nav/Hero/Footer 这些根本不碰 DB 的东西也得等 Supabase，
冷进入表现为几秒纯白屏（实测 TTFB 18ms 而 HTML 主体流了 2379ms）。
A/B 实测：同样 3 秒后端延迟，首屏内容 3429ms → 54ms。

**三种读取，别用混**：

| 函数 | 缓存 | 失败行为 | 谁用 |
|---|---|---|---|
| `getCatalogSafe` / `getStockItemsSafe` | Data Cache | 返回 `null`（未知） | 渲染路径 |
| `getCatalog` / `getStockItems` | Data Cache | 抛错 | PDP 等仍抛错的渲染点、邮件、waitlist |
| `getCatalogFresh` / `getStockItemsFresh` | **绕过** | 抛错 | **只有 `/api/checkout`** |

Data Cache（`unstable_cache`，TTL `CATALOG_TTL_SECONDS` = 300s，tag
`CATALOG_TAG`）跨实例共享且持久，这正是它比 `lastGood` 那个进程内 Map
强的地方。**实测确认过两件事**：`unstable_cache` 与 `force-dynamic`
不冲突；**抛错不入缓存**——注入故障后移除，下一个请求立刻恢复，不用等
TTL（否则一次 3 秒的 JWT 抖动会变成 5 分钟降级）。主动失效只有一处：
webhook 扣完库存。admin 改价**没有**通知通道（曾经有过，因为不值那些
活动部件而拆掉），所以改完价最长等一个 TTL 才在站上可见。

**陈旧为什么不影响正确性——下单那一刻才是对账点**：`/api/checkout` 走
Fresh 读取直接问库，并**逐行比对客人页面上看到的单价**，不一致就返回
409 `price_changed` 让他刷新，而不是闷声按新价扣款。比单价不比小计：
服务端会归一化 qty（编号件恒 1、钳 1–9）并剔掉目录里没有的行，拿小计
对账会因为这些归一化差异误报，把真实结算挡住——那比不检查更伤。
口径由店主定：**改动本就不频繁，不需要即时同步，只要下单时对得上**。

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
  - **Dashboard（/）**：SaaS 式交互版（2026-07-15）。服务端一次下发全量
    lean 数据（orders 精简列 + refund 事件[join order_ref] + waitlist +
    stock + 商品图映射 + **now 时钟**），交互全在客户端
    `components/Dashboard.tsx`：周期切换（Today/7d/30d/90d/All，切换零往返）、
    六 KPI 带上一周期环比（退款/发货时效反向着色）、SVG 图表 Revenue/Orders
    双口径 + 逐列悬停 tooltip（Today 按小时、All>120 天按月桶）、
    Needs attention 行动卡（直达 /orders?status=X 预筛选——OrdersList 接
    initialFilter/initialQ，orders/page.tsx 读 searchParams）、Activity
    动态流（订单里程碑列派生 + refund 事件 + waitlist，相对时间元素
    suppressHydrationWarning）、周期化 Top products（画芯 variant 缩略图
    走 ARTWORKS→flat-0X 约定，同 email itemThumb）。**时间窗一律用服务端
    下发的 now**（SSR/水合一致，别在客户端 Date.now() 算窗口）。
  - **Orders**：搜索（ref/邮箱/姓名/运单/商品）+ 状态 chips + 分组工作台。
    每单：明细/地址/支付（Stripe Dashboard 直链，test/live 感知）/时间线/
    内部备注（orders.admin_note）/按状态动作。动作 = 发货、送达、
    **取消（退款先行，失败不落库；可选回补库存）**、**部分/全额退款**
    （Stripe by payment intent，refunded_cents 回读 charge 权威值）、
    **退货流**（start → mark returned[可选退款+回补] / cancel return）、
    **联系客户**（自由主题+正文，品牌壳）、重发确认/发货邮件、装箱单
    （/orders/[ref]/slip 可打印，ABN TODO）、Export CSV（对账列）。
  - **Products（/products）**：原首页整体平移（改价/上下架/文案/库存，机制不变）。
    **Stripe sync 面板（2026-07-26）**：只读体检每行 price/product（存在性、
    active、金额币种、product id 是否为 price 实际挂靠的 product）+ 按行
    Repair。口径 = **DB 为准，Stripe 跟随**：product id 回填真值 / product
    反归档 / price 依 DB 重建（顺序同 updatePrice：建新 → 回写 → 归档旧）；
    纯占位行不建对象，"有 product 无 price" 只整理 product 侧（建价仍走
    Create in Stripe，开售动作要显式）。权威说明在 admin/lib/actions.ts
    同步段注释；e2e 含漂移注入自愈（scratchpad e2e-stripe-sync.mjs 模式）。
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

## 7.6 活动栏位与 Roomie letter（2026-07-15，用户全权委托）

设计文档：`docs/superpowers/specs/2026-07-15-promo-slot-brand-voice-carousel-design.md`。

**活动栏位（promo bar）**
- 配置唯一事实源 `lib/promos.ts` CAMPAIGNS：限时活动排在常青位前面，
  窗口期自动顶上/让位（墨尔本 +10 粗算）；`kind: "subscribe" | "link"`。
  上/换活动 = 改数组 + push。换活动**必须换 id**（dismiss cookie 按 id 记 7 天）。
- 形态：夜蓝细条坐在固定导航栈顶（`Nav.tsx` 的 `.stack` 包 PromoBar +
  header）。只在页面顶部露脸，滚动即收起（grid-rows 0fr）、回顶回来；
  `/cart` 与 `/checkout/*` 不渲染。收起时挂 `inert`。
- SSR 无闪烁：layout 服务端读 cookie（`rp_promo_dismissed` /
  `rp_subscribed`）算好初始可见性传 `PromoProvider`；站点本就
  force-dynamic，零成本。PDP 顶部留白已从 5.4rem 提到 6.6rem 让开栈高。
- 自动邀请（仅 landing）：滚过 0.6 屏且到站 >6s 才弹，一生一次
  （localStorage `rp_letter_prompted`，手动打开过也算）；已订阅/已关栏
  位不弹。

**订阅发码链（/api/subscribe）**
- 落库顺序 self-healing：先占 `subscribers` 行（unique email）→ 懒建
  coupon `ROOMIE10`（10% once，固定 id 幂等，test/live 各自首次成立）→
  发唯一 promotion code `ROOMIE10-XXXXX`（无易混字符集，max_redemptions=1，
  metadata.email）→ 回填行。任一步失败，同邮箱下次提交自动补齐；重复
  订阅返回原码（幂等）。结算页 `allow_promotion_codes` 本来就开着，
  码在 Stripe 托管页直接可用。
- 蜜罐字段 `company`：有值即装作成功、零写入。
- 欢迎邮件 best-effort（`welcomeCouponEmail`）：失败只记日志，码已在
  页面票券上展示。**Resend 域名未验证前只能发到店主邮箱**（admin
  letter 表的 welcome_emailed 列会如实显示 not sent）。
- Admin：Waitlist 页新增 "The Roomie letter" 区（邮箱/码/邮件状态 +
  CSV `waitlist/letter-export`）。
- 留给店主/后续：营销退订目前是"回信 unsubscribe"人工处理；活动改
  DB 化（admin 编辑）按需再做。

**验证方法论（本轮沉淀）**
- Playwright 21 项 e2e：SSR 可见性/收起/关闭 cookie/订阅发码/幂等/
  自动邀请一生一次/结算动线免打扰/轮播交互/微光加载/移动端 sheet，
  合成订阅一律 `letter-e2e-9xxx@` 打标，测完删行 + 停用码。
- in-app Browser pane 的 fetch 提交在弹层里不可靠（点击后请求未达
  服务端），跟历史"截图过期"同类：**交互断言一律走 Playwright**。

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
3. **入场动画的 fill-mode 不许 forward 填充有 transform 的关键帧**
   （`both`/`forwards`）：动画结束后 transform 计算值恒等矩阵仍挂在
   元素上 → 该元素成了 fixed 后代的 containing block。实锤案例：
   `pdp .page` 的 pageIn 用 `both`，移动端粘性购买条 fixed 定位被圈进
   页面坐标、沉底永不可见（2026-07-15 修，改 `backwards` 即愈）。
   凡"fixed 元素不见了/位置怪"，先查祖先 transform/filter。
4. **Supabase 偶发 "JWT issued at future" 401**（2026-07-30 定稿，此前两版
   结论都是错的，见下）：**Supabase 内部两台机器的时钟分歧超过 30 秒。**
   我们发的 `sb_secret_` 是不透明字符串、不含任何时间；官方文档确认
   API key 会被**即时换成一张短命 JWT**（"transformed into a short-lived
   JWT"）；那张 JWT 由项目侧的 PostgREST 校验，而 PostgREST 只在
   `iat > now + 30s` 时拒绝（源码 `Auth/Jwt.hs` 写死 `allowedSkewSeconds
   = 30`，报错文案 `"JWT issued at future"` 出自 `Error.hs`）。签发方的
   钟比校验方快过 30 秒，签出来的证就成了「未来签发」。
   - **决定性推论：证会自己熬成合法。** 校验只查 iat 有没有超前，**从不
     查证有多旧**；证的 iat 冻住不动而校验方的钟一直走，所以一张证只要
     活过 `(分歧 − 30)` 秒就必然被放行。这解释了为什么服务端那 1.4 秒
     退避必死（证太新）而客户端 2 秒后的重跑几乎必成（证熬老了），也
     反推出 07-28 那次的分歧在 **31.6–35.5 秒**之间。
   - **两条已作废的旧结论，别再捡回来**：①「机器睡醒本机时钟落后」——
     本地 dev 下得的，生产不成立；②「网关层拒的、没进到 DB」—— 被
     `latency: 0` 误导，报错文案是 PostgREST 独有的，请求确实到了项目侧。
     ③ 还有「401 只打 stock_items」——那是 3 个样本的过度拟合，07-28
     的事故打的就是 `products`。4 个样本里 3:1 完全是随机波动。
   - **仍属推断**（别当已知机制）：那张证被复用而非每次重签、以及两条
     并发请求落到不同网关节点。外部观测不到，但「2 秒重跑稳定成功」这
     个事实要求存在某种复用。
   - **防线**：① 退避 400/1000ms（0/3 命中，留着只因为便宜）；
     ② `cache()` 请求内去重（9 次往返 → 2 次）；③ **Data Cache**
     （2026-07-30，见 §7 读取链）—— 绝大多数渲染一次网络都不发，这是
     目前削减暴露面最有效的一层；④ **渲染路径降级**（`lib/degrade.ts`）：
     读不到就回落快照，没快照按「未知」渲染，**绝不 500**；
     ⑤ **流式渲染**（2026-07-30）：shell 不等数据，所以这个故障最坏
     只是价格晚到，不再是白屏。
     注意 `lastGood` 是**进程内** Map，冷实例永远为空 —— 历次事故日志里
     的「无快照可用」就是这么来的；真正跨实例的快照是 ③。
   - **红线**：`null` = 未知，**不等于空**。当空集处理会退化成「AU$0 +
     满屏售罄」，比错误页更伤转化。库存未知一律不冤枉成售罄。
   - **边界**：见 §7 读取链——渲染吃缓存、结算读真库。
   - 新增 layout/landing 级读取时，用 `*Safe()` 版本并把 `null` 当未知。
   - 下次事故要取的证据：Dashboard 的 **PostgREST 日志**（不是 edge 日志）
     应有对应 401；以及「首次失败 → 最终成功」的耗时，熬证模型预测它是
     一条窄带（几秒、高度可重复），节点剔除模型则预测方差很大。
3. Stripe 托管页自动化：支付方式是折叠 radio
   `input[name='payment-method-accordion-item-title']`（样式隐藏 →
   `check({force:true})`），选完等 `#cardNumber` visible 再填 4242。
   **付款前必须取消勾选 `#enableStripePass`**（Link "Save my information"
   默认勾上，点 Pay 会转进手机号验证流程，页面永不跳转——07-15 实测）。
   地址填完按 Escape 收起 autocomplete 下拉再填城市/州。
4. Filmstrip / scroll-snap：索引和 scrollTo 都要减 `kids[0].offsetLeft`
   基准，否则 snap 回吸让计数卡死。
5. `mask-image` 只认 **alpha 通道**——灰度 PNG 蒙版等于没有；验证要验
   "效果"而不是"样式已应用"。
6. 覆盖类资产 2× 超采样输出，否则 Retina 上直线出锯齿。
7. Supabase jsonb 的对象数组 containment（`.contains`）在 PostgREST 侧
   易翻车——小表直接取列 JS 过滤。
8. Reveal 的 `as` 联合类型不全时直接扩（已含 p/div/section/li/figure）。
9. 改 `.env.local` 后要重启 dev server 才生效。**另：这个文件 shell
   `source` 不了** —— `RESEND_FROM` 的值含未加引号的 `<>`，shell 当成
   重定向，在那一行解析失败、其后所有变量（含 `ADMIN_SECRET`）全读不到，
   而且**静默失败**（`source` 退出码仍是 0）。应用不受影响（Next 和
   admin/next.config.ts 各用自己的正则解析器）。写脚本要取值就单行
   `grep '^KEY=' .env.local | cut -d= -f2-`，别整个 source。
10. 新页面用到 `useSearchParams` 必须包 `<Suspense>`（success 页先例）。
11. Webhook 签名密钥**只在创建 endpoint 时返回一次**，拿到立刻落盘，
    别让它进终端管道（丢过一次，删了重建才拿回）。
12. 根 tsconfig 的 `include: ["**/*.ts"]` 会把 `admin/` 卷进主站类型检查
    ——必须 `exclude: ["admin"]`；`.gitignore` 的 `/node_modules` 带根锚定，
    admin 的要单独加。**镜像坑（2026-07-30 踩到）**：admin 用相对路径
    import 主站的 `lib/`，于是主站那些文件会被 admin 的 tsc 检查，而
    admin 的 `@/*` 指向 `admin/` 自己 —— 主站 `lib/` 里只要出现
    `@/components/...` 就会在 admin 侧报 TS2307，主站自己却是绿的。
    **服务端与客户端共用的类型放 `lib/` 下的零依赖文件**（先例
    `lib/cartTypes.ts`），别放进 `components/`。
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
| 07-15 | **admin-platform 合并 main 上生产**（用户拍板）：全站 DB 化 + admin 后台 + SaaS Dashboard 一并落地；结算回跳 URL 加固（publicOrigin，生产拒信 localhost）。合并顺带修好生产结算（旧代码硬编码着 07-13 事故中被归档的 price id；DB 化后读现行 id 自愈）。发现在售价为 149/42（07-13 事故遗留的表值；07-21 店主确认 149/42 就是定价，无所谓恢复） | ff `c7d8e40..56f7ef7`；生产验证见 runbook 现状 |
| 07-15 晚 | **品牌口径纠偏（cat→pets，红线见 §3）+ 活动栏位与 Roomie letter 10% 发码上线（§7.6）+ 轮播/加载体验打磨**（门户卡同相位漂移交叉溶解、横滑翻页、进度胶囊；胶片惯性吸附+键盘；SmartImg 微光加载） | 用户全权委托；spec `2026-07-15-promo-slot-...-design.md`，21 项 Playwright e2e 全绿 |
| 07-15 深夜 | **手感返工（用户复评）**：胶片撤销 scroll-snap 改自由惯性（rAF 摩擦衰减，抓住即停，箭头才整张对齐）；门户卡拖拽改连续可逆（跟手位移+候选帧随进度渐显，过阈/甩动落定，否则平滑退回）；猫屋卡视频废除 hover 门控（各端进入视野即播）。顺带修两个存量 bug：pageIn fill-mode 吃掉移动端粘性购买条（§9.3）、Supabase 时钟抖动 500（§9.4，removeChild 报错根因）。移动端细化：BrandStory 提示按输入能力说 tap/hover、PDP 主 CTA 窄屏全宽、活动条关闭钮热区 36px | 24 项 e2e 全绿 |
| 07-19 | 模块间距/进场感知优化：section clamp 下限收紧（拉回 §4.3 规范量级）、Canvas→Shelf 断口独收（叙事最连续处最紧）、Reveal 预热触发（视口下方 10%）+ 时长归 `--dur-mid`、FinalCta 文案直出（唯一不走 Reveal 的进场，杜绝深底"整屏纯蓝"） | 移动端最大间隙 22%→16% 屏高 |
| 07-21 | **Stripe 切 live（用户换新账户）**：live Product+Price 按 products 表现值建好（scratcher 14900 `price_1TvbXOD8GWW1QP9nCvWJPkHk` / print 4200 `price_1TvbXPD8GWW1QP9nNn0mkxip` / house 18900 `price_1TvbXQD8GWW1QP9nonMKMYYe`，metadata roomie_handle 幂等约定不变）、live webhook 端点直接建在正典域名（`we_1TvbXgD8GWW1QP9nH4LMGAB0` → roomiepaw.com.au/api/webhook，4 事件）、products 表三行 price id 已回填、本地 .env.local 已换 live sk+prod whsec。本地 live session 创建实测通过。价格 149/42 即店主定价（07-21 确认）；要调价走 admin 改价自动重建；**结算行项目改 price_data 动态生成**（用户 live 首单截图指出行名/图不反映所选画芯）：行名 `title · variant`、图用对应画芯 print-0X.webp（host 固定 PROD_ORIGIN，Stripe 服务端抓图够不着 localhost）、金额仍服务端 re-derive——**products 表的 stripe_price_id 自此不再被结算引用**（admin 改价仍维护，预建 Price 仅作 Dashboard 参考）；pk 未被代码使用（托管 Checkout 只需 sk）；stripe-setup.mjs SKU 段价格已过时，加了警示注释。**Vercel env（sk+whsec）由店主配 + Redeploy，配好前生产结算断**（DB 已切新 price id 而生产 key 还是旧账户）。新账户 Afterpay 需 Dashboard 手动开 | test 账户退役 |
| 07-21 | **去 GST 化（店主未注册 GST，ABN 个体经营）**：全站客户可见处（footer/购物车整页与抽屉/success 页/terms 两处/订单邮件合计行）与 admin（装箱单、CSV 注释）的 "GST included" 全部移除，总额行只写 Total；装箱单不称 tax invoice；checkout 加注释禁开 STRIPE_TAX_ENABLED。注册 GST 后按 §3 恢复 | 合规修正 |
| 07-21 | **Resend 切新账户 + 发件域名就绪**：roomiepaw.com.au 已验证（东京区），发件人 hello@roomiepaw.com.au 实测发信成功；根域收信 MX 刻意未配（留给未来邮箱服务）；本地 .env.local 新 key+from 已配，Vercel env 两项由店主同步 | 客户邮件可达 |
| 07-26 | **切 live 遗留修复：products 表 `stripe_product_id` 仍是旧账户值**（07-21 只回填了 price id）——admin 改价是「同 product 下建新价」，拿旧 id 去新账户建价报 `No such product: 'prod_Us218uKr4ywrar'`；checkout 已 price_data 化不引用该列，生产结算全程无恙，此 bug 只挡店主改价。修复=DB-only 回填（从各行 live price 反查其真实 product，脚本反查不手抄）：scratcher `prod_Us218uKr4ywrar`→`prod_UvSSp7xlk8jfR7`、print `prod_Us214aGJ2LyHIm`→`prod_UvSSa1DmLZt3Jw`、house `null`→`prod_UvSS1XazSLXX1B`；只读审计三行 price/product 全绿。教训：**切 Stripe 账户时 price id 与 product id 要一起回填**（改价/建价路径吃的是 product id）。同日把该类问题产品化：**Products 页新增 Stripe sync 面板**（只读 check + 按行 Repair，DB 为准，详见 §7.5），Playwright e2e 10 项全绿（含漂移注入 → 检出 → Repair 自愈） | 数据回填 + 面板加装 |
| 07-27 | **店主为根域自配 Resend receive**（MX → `inbound-smtp.ap-northeast-1`，dig 实证）：hello@ 来信落 Resend。「根域 MX 留给未来邮箱服务」口径作废；MX 独占，将来上邮箱服务需迁走、Resend 收件即停。回信路线见 §7 Resend 条 | 收件闭环 |
| 07-27 | **Bot 防护体系立项**（用户上一站曾被 bot 流量打爆 edge 配额，要求防 bot 但保 SEO）：层 1=robots.ts 加 SEO 工具爬虫黑名单（Ahrefs/Semrush 等全站谢客，Google/Bing 全放行；AI 爬虫刻意留给 Firewall 统一决定）；层 2=Vercel Firewall（Bot Protection Challenge + AI Bots Deny + **/api/ bypass 必须先行**否则 Stripe/Resend webhook 会被挑战拦死），步骤沉淀 runbook「Bot 防护」节。关键事实：WAF 挡掉的流量不计费（官方 2026-05 口径）；已验证搜索爬虫自动豁免挑战；生产 headless e2e 可能被 Challenge——跑前临时切 Log | 层 2 待店主按 runbook 开关 |
| 07-27 | **收件转发上线**（用户拍板"做吧"）：`/api/inbound` 把 hello@ 来信转进店主 Gmail，Gmail send-as 以 hello@ 回信 = 完整客服收发闭环。关键实测：`receiving.forward` passthrough 会丢客户 From/无 Reply-To（不可用于人读转发）→ 改读原文重发；本地 10 项路由测试全绿（验签/守卫/真实转发头逐项断言）。env 新增 `RESEND_WEBHOOK_SECRET` + `INBOUND_FORWARD_TO`（runbook 表已更） | 罕见重投可能重复转发，无害 |
| 07-30 | **冷进入 4 秒白屏根治 + JWT 根因定稿**（店主报「冷进入白屏约 4 秒才出现」）。测出真因：根 layout 的 `await` 挡在所有 JSX 前，TTFB 18ms 而 HTML 主体流 2379ms——服务器开了连接然后挂着等 Supabase。① **流式化**：layout 传未 await 的 promise，首页价格改流式叶子（A/B：3 秒后端延迟下首屏 3429ms→54ms）；② **Data Cache**：两张周改两次的表不再每次访问现查（5 次请求 1 次真查，热 29ms）；③ 店主质疑设计过度，顺带暴露我引入的真缺陷——`/api/checkout` 也在读缓存，于是加 `*Fresh` 绕过缓存 + **逐行单价对账**（不一致 409 让客人刷新），并**拆掉** admin→生产的失效通道（改动不频繁，不值那些活动部件）。JWT 根因定为「Supabase 内部两钟分歧 >30s + 证随年龄熬成合法」，推翻此前两版结论与「只打 stock_items」的过拟合。装 `@vercel/speed-insights`；Next 补丁升 15.5.22（清掉 8 条 advisory，逐条核对后确认一条都打不到本站） | 口径：**改动本就不频繁，不需要即时同步，只要下单时对得上**（店主定） |
| 07-19 | **正典域名切到 roomiepaw.com.au**（用户在 Vercel 绑定后代码配套）：`lib/env.ts PROD_ORIGIN`（Stripe 回跳/邮件资产/metadataBase 的统一兜底）、admin 链接与 Dashboard SITE、stripe-setup 脚本 SITE、.env.example 注释全部切新域名；新增 `app/robots.ts` + `app/sitemap.ts`（API/cart/checkout 不进索引）。**Stripe webhook 端点故意留在 vercel.app**（server-to-server 不受域名切换影响，换端点要重配 whsec，不折腾）。待用户：Vercel env `NEXT_PUBLIC_URL` 改 `https://roomiepaw.com.au` 后 Redeploy（不改则 publicOrigin 仍信旧 env 值）；Resend 验证 roomiepaw.com.au 发件域名（验证前订单邮件只能发店主自己邮箱） | vercel.app 仍作别名 |
| 07-19 | BrandStory 换图两轮（用户两次复评）：两张独立 AI 图切换跳动 → v1 用 hero 视频首帧+末帧（3:2 裁切 top=70），但 10s AI 视频累积变形（画框推移/画芯漂移/光变）仍被看出 → **v2 根治：只用末帧做底，猫区域用首帧像素补**（补丁管线 scratchpad patch_cat.py：手描猫多边形 mask 含尾巴贴墙影、MaxFilter 21 外扩+高斯 9 羽化——羽化半透会透出高对比毛色，边界要吃足；非猫区 SSD 网格搜索平移对齐 dy=-9；mask 外环带每通道均值比光配 ~0.95；成品 room-empty-2.jpg，两图除猫外逐像素相同）。教训：AI 视频取"同景两帧"必须做补丁合成，跨 10s 直取两帧过不了眼；public/hero/poster-first.jpg 不是真首帧（单独生成的海报变体），提帧从视频本体取 | 切换零跳动 |
| 07-19 | **运费宣传收敛（用户指示，预备大件品类）**：26/188 从品牌层全部撤下（footer/FinalCta 去金额、cart 与 scratcher metadata 去金额、terms 概述句改"per-order shipping shown before you pay"），只留在购买流程事实层（PDP 面板价格旁、购物车抽屉、checkout 逻辑不动）；政策页 callout 加 "for our current pieces" 限定 + 大件"按商品页标注运费"预告句。**多档运费模型同日拍板**：按最高件计费 + 免邮线仅纯标准件订单，首个大件 SKU 进库时实现（口径全文见 §7 设计决策段） | 现售三件仍是 26/188，事实层不变 |
| 07-19 | **供应商红线松绑（用户拍板）**：GlugGlug 以 partner workshop 身份低调露出——footer Partners 列 + 两 PDP 铭牌行（PartnerMark 组件，字体栈重建字标不抠图）；像素级 de-logo 与首要宣传位禁令不变（§1.1）。**PDP 结构沉淀为模板** `docs/PDP_TEMPLATE.md`（A 在售购买型=/scratcher、B 预告候补型=/house，含铭牌规范与新商品接入 checklist） | 新商品详情页从模板起步 |

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
6. 要做新商品详情页：先读 `docs/PDP_TEMPLATE.md`，从模板 A/B 起步。

有不确定的先问用户（中文），小事自己定但在交付说明里讲清楚。

---

## Hero 首屏可预测性（2026-07-31）

设计：`docs/superpowers/specs/2026-07-31-hero-anticipation-ux-design.md`

改动前首屏要下 ~14MB，其中 6 张 art 大图（7.1MB）在挂载首帧就和
视频抢带宽；`beats` 只绑 `video.currentTime`，视频不起播则标题永不
出现；换画 feature 到第 11.5 秒才露面且中途零信号。

现在：
- art 大图推迟到视频 `playing` 后才挂 `src`；画作转 JPEG，视频重压
  （参数在 `tools/compress_hero_media.sh`，换画作时重跑）
- `beats` 由视频轨与页面轨双轨驱动，先到者生效；8 秒 `canplay` 兜底
- 第 7 秒起画芯从舞台左缘滑入的送货态（去饱和、不可点），定格后
  `CatDelivery` 推入第 6 张完成落定
- 右下角 `SkipDial`：确定进度环 + hover 跳过，移动端不出现

调时间轴只改 `lib/heroConfig.ts` 的 `HERO_TIMINGS`。三条约束：

1. `catPushMs` **必须等于** `freeze.plaque` —— 猫抵达的那一刻正是
   画芯落定的那一刻。
2. `dialMs` **必须小于** 视频时长(实测 10017ms) + `freeze.plaque`。
   SkipDial 在 `steps.plaque` 卸载，环若没走完就会被砍断 —— 那正是
   开发中修过一次的缺陷。当前 10800 对 11017，留 217ms 余量；宁可
   满环停一瞬，也不能砍断。
3. 画芯架的几何（`miniW` / `rackLeft` / 第 i 张的位置）一律走
   `rackGeometry()`。CatDelivery 要知道第 6 张停在哪，ArtworkSwitcher
   要摆放它们 —— 两边各算各的就会像开发中那样猫推空 65px。

CSS 侧不需要跟着改时长：`--push-dur` 与 `--cat-dur` 都由组件从
`catPushMs` 传入。

资产重压：`bash tools/compress_hero_media.sh [CRF]`。源是
`assets/hero/cat-scratcher-10s.master.mp4`（不在 public/ 下，
不部署）与 `public/hero/art/art-0X.png`，两者都留在仓库里，
脚本可反复重跑。

**Task 8 核对结果（收尾时补记）**：生产构建（`BUILD_DIR=.next-build
npm run build`）通过，零类型错、零 lint 错。首屏体积用浏览器
Performance API 复核时撞上两个环境干扰：dev 模式下 `<video>` 被
React Strict Mode 重复挂载导致重复下载一次（生产不会）；art/画芯缩略图
在这台机器上早被浏览器缓存命中，`encodedBodySize` 读成 0。剔除这两个
干扰、改用磁盘实际字节数核算：视频 2.12MB + 6 张 art JPEG 1.45MB +
6 张缩略图 0.42MB + poster 0.30MB + frame-mask 0.01MB ≈ **4.3MB**，
比改动前 13.83MB 降约 69%。`loadArt` 由 `playing` 事件放行（起播后
几乎立刻），6 张 art 一次性全挂载不做懒加载，所以“视频+全部画作”合计
（2.12+1.45=3.57MB）本身就过不了 3MB——本节末尾原计划文本写的
“totalMB 在 3 以内”对最终落地的资产尺寸不成立，仅“视频请求早于 art
请求”这条在实测中成立（startMs 346ms 对 393ms）。核心目标（首帧不再
抢带宽、视频优先）达成，但如果后续要卡紧到 3MB 硬指标，需要再收窄 art
JPEG 或改懒加载单张而非一次性挂载六张。
