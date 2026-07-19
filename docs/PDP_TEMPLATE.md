# PDP 结构模板（v1 · 2026-07-19）

新商品的详情页不从零设计，从这两套模板里挑一套起步。
参考实现就是现有两页，抄结构、换内容：

- **模板 A「在售购买型」** = `/scratcher`（`app/scratcher/page.tsx`）
- **模板 B「预告候补型」** = `/house`（`app/house/page.tsx`）

商品可下单（catalog 里 sellable 且 available）→ A；
未开售/占位（waitlist 承接）→ B。商品从 B 转 A（开售）时页面按 A 重排，
waitlist 面板换成购买面板，其余区块尽量保留。

两套不够用的时候（出现全新品类形态）再沉淀模板 C，别提前抽象。

## 模板 A：在售购买型（/scratcher 参考）

| # | 区块 | 必选 | 实现参考 | 备注 |
|---|---|---|---|---|
| 1 | Crumb 面包屑 | ★ | `pdp/Crumb.tsx` | "The Canvas Series — <piece>"，返回 `/#canvas` |
| 2 | Shop 主舞台 | ★ | `pdp/ScratcherShop.tsx` | 图库主图+缩略 / 粘性购买面板 / 移动端底部粘性购买条。每个商品写自己的 *Shop 客户端组件，面板与底条共享选中态。**品牌铭牌行 = 面板最后一行**（见下） |
| 3 | Why it works 卖点 | ★ | `pdp.points` | 2×2 编号 01–04，标题+短句 |
| 4 | Up close 工艺 |  | `pdp.craftGrid` | 微距实拍三联，中列下沉 |
| 5 | The blueprint 结构/尺寸 |  | `pdp.bpGrid` + `pdp/SpecDrawing.tsx` | 热点图+图例+自绘 SVG 规格线稿（规格图宁可自绘也不修供应商截图，见 HANDOVER §6） |
| 6 | 特色机制区 |  | scratcher 的 The swap | 讲该商品的核心机制（换画/折叠/清洗等），三步式+实拍 |
| 7 | Shot at home 胶片 |  | `sections/Filmstrip.tsx` | 实拍生活场景横滑 |
| 8 | CrossSell | ★ | `pdp/CrossSell.tsx` | 互指系列内另一商品，tone 按页面明暗选 |

## 模板 B：预告候补型（/house 参考）

| # | 区块 | 必选 | 实现参考 | 备注 |
|---|---|---|---|---|
| 1 | Crumb 面包屑 | ★ | 同上 | |
| 2 | Shop 主舞台 | ★ | `pdp/HouseShop.tsx` | 大媒体（进视口自动播视频）+ waitlist 面板（常开 WaitlistForm）。**品牌铭牌行 = 面板最后一行**（见下） |
| 3 | Off the set 剧照 |  | `HouseShop.module.css .stills` | 三联图+图注 |
| 4 | How the run works 流程 | ★ | `pdp.steps` | 三步：留邮箱 → 怎么造 → 怎么轮到你 |
| 5 | CrossSell | ★ | 同上 | 指回在售商品 |

## 品牌铭牌行（露出口径见 HANDOVER §1.1）

GlugGlug 制造的商品，PDP 放**一行**低调铭牌，组件
`components/PartnerMark.tsx`（衬线字标+g 圆徽，`--pm-mark`/`--pm-bg`
按底色配色），样式 `pdp.provenance`：

- 位置（两套模板一致，2026-07-19 用户定）：**Shop 主舞台面板的最后一行**
  （panelNotes 之后、面板收尾处），在售/下架分支之外——面板任何状态都带；
- 文案句式：`Made with our partner workshop + 字标`；
- **绝不**进 hero、标题、卖点、metadata/OG、邮件——那是首要宣传位；
- footer Partners 列是全站统一露出位，商品页不重复承担。

## 新商品接入 checklist（结构之外）

1. `lib/catalog.ts` 加 SKU（价格/Stripe price id，见 HANDOVER §7）；
2. 备货单位进 `stock_items`（BOM 映射 `lib/inventory.ts` componentsFor
   + admin `BOM_HANDLES` 同步）；
3. 素材过 de-logo 管线（HANDOVER §6）后进 `public/c01/`（新系列另开目录）;
4. 未开售商品：waitlist handle 即商品 handle，别进 `HAS_OWN_PAGE`
   过滤集（landing What's next 由 `!sellable && !available` 自动收录，
   有专页后加入 `TheShelf.tsx` 的 `HAS_OWN_PAGE`）；
5. 文案自检：物种口径（品牌层 pets / 产品层才许 cat，HANDOVER §3）、
   禁长破折号、纯英文；
6. landing 入口：`CanvasCollection` 门户卡或 What's next 卡，二选一。
