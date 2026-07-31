# Hero 首屏可预测性 UX — 执行进度

Plan: `docs/superpowers/plans/2026-07-31-hero-anticipation-ux.md`
Spec: `docs/superpowers/specs/2026-07-31-hero-anticipation-ux-design.md`
Branch: `hero-anticipation-ux`（从 main 的 1dd37e5 起）

预检修正已提交 a0fe92d（压制脚本源改 durable、保留 art PNG、CSS 常量单一来源）。

## 改动前基线（实测，1440×900 视频路径，dev server）

| 资源 | 发起 | 体积 |
|---|---|---|
| art-0X.png ×6 | 314ms | 6.9MB |
| cat-scratcher-10s.mp4 | 318ms | 6.5MB |
| poster-first.jpg | 314ms | 305KB |
| flat-0X-s.jpg ×6 | 314ms | 434KB |
| **/hero/ 合计** | | **13.83MB** |

art PNG 比视频早 4ms 发起 —— 完全同步竞争。

## 取景器硬事实（每个任务的验证都受制于此，别再重新踩）

1. **视口默认报 `0x0`** → 命中 `max-width:760px` → Hero latch 进
   staticMode，跑不到视频路径。验证前必须
   `resize_window({width:1440, height:900})` 再 navigate。

2. **`document.visibilityState` 恒为 `hidden`，`document.timeline.currentTime`
   恒为 0。** CSS transition 被冻在时间零点（`playState: running` 但
   `currentTime: 0`），于是 **`getComputedStyle` 读 transition 类属性
   （opacity/transform）永远返回起始值**。
   - ❌ 不可信：`getComputedStyle(el).opacity` 判断"淡入了没有"
   - ✅ 可信：`el.className`（纯 React 状态）
   - ✅ 可信：`computer({action:"screenshot"})`（强制绘制，反映真实状态）
   曾据此误判 Task 2 引入了回归，实为假象。

3. **navigate → javascript_tool 之间有 ~9 秒 dev 编译延迟**，抓不到
   任何亚秒级窗口（如 400ms 的 fallback 计时器）。需要早期时序证据的
   验证在本环境做不了，只能靠代码审查 + 端到端结果。

4. **绝不能跑 `npm run build`**：与 live dev server 共用 `.next` 会把
   缓存覆盖坏（next.config.ts 已警告："样式崩"）。要构建必须
   `BUILD_DIR=.next-build`。Task 1 的 subagent 踩过一次。

**顺带观察（本次范围外）**：`staticMode` 在挂载时一次性判定，之后
不随 resize 重算。跨 760px 拖窗口不会切换模式。看起来是有意的
（中途切模式要拆掉正在播的视频），记录备查。

## 任务

- [x] Task 0: 采集改动前网络基线 — 完成，无代码改动
- [x] Task 1: art 大图推迟到视频起播后 — complete (e29046c..e8bb666, review clean)
      实测：视频 967ms 起、art 1053ms 起，顺序已翻转（基线是 art 早 4ms）
- [x] Task 2: 文案时机从视频时间解耦 + 弱网兜底 — complete (bee6fbf..c266e55, review clean)
      Reviewer 抓到真 bug（plan-mandated）：慢网下 fallback 2s 已显示副标题，
      8s 的 loadGuard 翻静态模式时无条件 setBeats 把它打回去，会淡出再淡入。
      c266e55 改成合并 updater 修掉，复审确认两条路径都正确。
- [x] Task 3: 视频重压与画作转 JPEG — complete (a3ab850..f2ffc65, review clean)
      两处执行中改档：① 画作 WebP → JPEG（本机无 WebP 编码器，且 PNG 无 alpha），
      q=2 视觉无损，6.9MB → 1.48MB；② 视频先按计划压到 1280×960/CRF27（1.01MB），
      我比对裁切发现**画布织物纹理被抹平**（subagent 只查了块状噪点/条带，
      没查纹理丢失），且 1440 视口 cover 后内容矩形 1440×1080，1280 编码在被放大。
      改回原生 1664×1248/CRF26 = 2.12MB，纹理保住。同时删掉 WebM
      （VP9 1.96MB 比 H.264 还大，却排在第一个 source，等于让 Chrome 多下 1MB）。
      **实测 hero 总量 13.83MB → 4.58MB，关键路径约 2.9MB。**
- [x] Task 4: 抽出 useHeroSequence（纯重构）— complete (dc5db6f..052e3c0, review clean)
      Hero.tsx 216 → 110 行；134 行删除中 132 行逐字移入 hook，另 2 行差异是
      结构性必需。计划片段里带着 Task 2 修掉的那行 bug，执行前已同步（dc5db6f）。
- [x] Task 5: SkipDial — complete (759a7fc..49065dc, review clean)
      Reviewer 抓到真缺陷：dial 在 `!frozen` 卸载（视频一停 10.02s），
      而环声明 11 秒 —— 每次都在 91% 处被砍断，一个"看得见终点"的环
      从没走到终点。49065dc 改成跟 `steps.plaque` 卸载。
      ⚠️ 复审留的前瞻警告已在计划里处理：Task 7 把 plaque 改 1000 后，
      环完成与卸载只差 17ms，已把 dialMs 改为 10800 留 217ms 余量。
- [x] Task 6: 画芯提前滑入的送货态 — complete (076c4e4..6ceb34f, 复审待回)
      Reviewer 抓到两条真缺陷，都是计划的 CSS 数学错：
      ① 滑入位移对所有画芯用同一个值，但 rack 是 -42% 叠压的 flex 行，
         第 i 张自然位置已右移 0.58i×mini-w，于是只有前两张真出画，
         第 5 张起点几乎贴着视口左缘"凭空淡出来"。改为按 --i 缩放。
      ② 移动端 delivery 立刻为真而 plaque 要 1.85s 后到，中间整段在放
         送货动画（spec 明说移动端不该经过），且移动端 rack 用
         --rack-m-left 定位而位移按 --rack-left 算，基准都是错的。
         在移动端媒体查询里把送货态压回"未出现"。
- [x] Task 7: CatDelivery — complete (0dd257d..4733704, 复审待回)
      Reviewer 的实证工作抓到两条推翻核心交付的缺陷（diff 与 brief 逐字一致，
      只有行为验证能发现）：
      ① --cat-end-x 瞄画芯架起点，但第 6 张因 -42% 叠压在起点右侧 2.9 个
         画芯宽处 —— 猫停在第 1、2 张旁边，差 65px。
      ② 第 6 张的推入动画挂 .rackOn，要到 plaque(t=1000ms) 才生效，正是猫
         已抵达之时。真实观感是猫走到空位比划完离开，画才自己滑进来。
      根因同一个：猫和画芯架各算各的几何。抽出 rackGeometry() 共用。
      修后爪子落点与第 6 张左缘相差 0.02px；rackPushing 在定格后 4.9ms
      生效、rackOn 在 1007ms 接手。

## 取景器新限制（Task 7 期间出现）

5. **`visibilityState: hidden` 下浏览器不给 `<video>` 分配加载**：
   readyState 卡在 0，而服务端 6ms 就返回 2.2MB。早期能跑通大概是
   标签曾被 front 过。几何验证只能靠代码 + 算术。
- [x] Task 8: 收尾核对与文档 — complete (9411242..0377852, review clean)
      构建通过；实测总量 13.83MB → 4.30MB（69%）。发现我计划里的"3MB 以内"
      期望不成立：目标定于把视频改回原生分辨率之前，是算术没跟上，已记入 HANDOVER。

## 整分支终审（opus）— 抓到八个逐任务审查都漏掉的 High

**画跑在猫前面。** `miniPushedIn` 仍用扁平的 `- mini-w * 2` 位移，
而第 6 张的自然位置是 `rackLeft + 2.9×miniW` —— 起点落在 **+44px（画内）**，
猫爪起点在 **−96.8px**。同缓动同时长，只在最后一帧才碰上：观感是画凭空
出现在舞台中间、猫在后面追。Task 6 为 `miniSlideIn` 修过同一个 bug，
`miniPushedIn` 写在那之前，没跟上。

**终点算术是对的（0.02px），但算术只能验终点，而时间线冻结让没人看过轨迹。**

另四条：`rackPushing` 在桌面降级路径上无猫却触发；**skip 反而多给 2.1 秒
的猫**（与按钮字面意思相反）；buffering 环因内联 `strokeDasharray` 压过
indeterminate 规则而渲染成**整圈**（读作 100% 完成）；猫的图片在它必须
出现的那一刻才开始下载。

修复取结构化路线：`CAT_GEOM` 进 heroConfig，两处几何经自定义属性同源；
`pushed` latch 分离自然定格与 instant；猫提前到 `beats.delivery` 挂载。
实测两个起点均为 −96.768px。

## Minor findings 累积（供最终整分支 review 分诊）

- **Task 1** — `components/Hero/ArtworkSwitcher.tsx:12-13`：`loadArt` 的
  prop 注释只写了"视频起播后才 true"，没提 staticMode 下也会立即置
  true。单独读 ArtworkSwitcher.tsx 会误以为只有视频路径会放行。
  （注释文本照抄自 brief，是计划的问题不是实现的问题。）

- **Task 2** — `components/Hero/Hero.tsx`：fallback effect 用两个独立的
  单字段 updater，而既有的 `onTime` 是一个合并 updater 同时推进
  title/subtitle。两种写法能正确共存（各自只 spread 自己的字段），
  只是同一文件里"推进 beats"有两种风格。

- **Task 2** — fallback 的两个计时器只在最终卸载时清理，`staticMode`
  从 false 翻走时不清。实际无害（只翻一次，且 updater 是 no-op 守卫），
  且与文件既有惯例一致，记录备查。

- **Task 5** — `components/Hero/SkipDial.module.css` 末尾的
  `@media (prefers-reduced-motion: reduce)` 块不可达：reduced-motion 下
  `staticMode` 已是 true，而挂载条件要求 `staticMode === false`，
  SkipDial 根本不会挂。无害的防御性冗余。

- **Task 5** — `useHeroSequence.ts` 的 `runFreezeSequence` 在 instant 分支
  不清 `timers.current` 里已排期的错峰计时器。它们稍后落到已是 true 的
  字段上，是 no-op（消费方只看布尔值不看对象引用），无可见影响，
  但会有几次无谓的 re-render。


## 终审结论：MERGE（8fa7a01 修完九条后）

Reviewer 独立重推几何，确认 Fix 1 是构造上正确：`miniLeft(5)` 代数上
抵消，起点锁定对任意 rect / miniW / rackLeft 成立，改 0.58 叠压系数
也不会破。6 种视口（含 rect.left 为负、761px 临界）Δ 全为精确 0。
轨迹偏差峰值 ~0.5px（源于 999.6 vs 1000ms 的 0.4ms 误差），不可见。

## 合并后的跟进项（都不阻塞）

1. **部署体积**：`public/hero/art/` 里 7.1MB 的画作 PNG 母版 + 21.7MB 的
   flat-0X.png 仍会部署到 Vercel（用户从不下载，只是部署重量）。视频母版
   已移到 assets/，画作没移是因为要同时改 make_artworks.py 的输出路径 ——
   那是管线改动，该独立成一次带自己验证的变更。
2. **`0.58` 有三份拷贝**：`miniSlideIn` 的 CSS、`rackGeometry()`、以及
   `.mini + .mini` 的 -42% margin（0.58 = 1 − 0.42）。这是本轮反复出问题
   的那个模式最后一处活标本，失效后果是 Task 6 那个 bug 重现（观感层面）。
3. **`HeroCopy.tsx:46,55`** 用 `priority` 渲染两张图，会在关键路径上发
   preload —— 正是这个分支要清空的那个位置。体积小且是既有代码，未动。
4. `CatDelivery` 的 `.catIdle` 可加 `visibility: hidden`，省掉 3 秒的
   drop-shadow 图层绘制。
5. `CatDelivery.module.css` 里 `2.1 × 47.6% = 0.9996` 必须等于 1，
   改停留/退场时长会静默失去与 `--push-dur` 的同步。CSS 侧，TS 断言够不到。
