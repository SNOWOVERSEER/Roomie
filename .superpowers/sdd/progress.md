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

**验证环境注意**：浏览器窗格默认视口报 `0x0`，会命中 `max-width:760px`
从而 latch 进 staticMode，跑不到视频路径。每次验证前必须
`resize_window({width:1440, height:900})` 再 navigate。

**顺带观察（本次范围外）**：`staticMode` 在挂载时一次性判定，之后
不随 resize 重算。跨 760px 拖窗口不会切换模式。看起来是有意的
（中途切模式要拆掉正在播的视频），记录备查。

## 任务

- [x] Task 0: 采集改动前网络基线 — 完成，无代码改动
- [ ] Task 1: art 大图推迟到视频起播后
- [ ] Task 2: 文案时机从视频时间解耦 + 弱网兜底
- [ ] Task 3: 视频重压与画作 WebP
- [ ] Task 4: 抽出 useHeroSequence（纯重构）
- [ ] Task 5: SkipDial
- [ ] Task 6: 画芯提前滑入的送货态
- [ ] Task 7: CatDelivery
- [ ] Task 8: 收尾核对与文档

## Minor findings 累积（供最终整分支 review 分诊）

（暂无）
