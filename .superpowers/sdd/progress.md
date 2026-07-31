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
- [ ] Task 3: 视频重压与画作转 JPEG（原计划 WebP，见下）
- [ ] Task 4: 抽出 useHeroSequence（纯重构）
- [ ] Task 5: SkipDial
- [ ] Task 6: 画芯提前滑入的送货态
- [ ] Task 7: CatDelivery
- [ ] Task 8: 收尾核对与文档

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
