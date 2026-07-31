# Hero 首屏可预测性 UX 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把首屏 14MB 的自伤加载砍到 ~2MB，并把"第 11.5 秒才出现的换画 feature"改造成从第 7 秒起就看得见的送货过程，让用户有理由等下去。

**Architecture:** 三块互相独立的改动。(1) 性能：art 大图推迟到视频起播后再挂、视频重压、文案时机从 `video.currentTime` 解耦到页面时钟。(2) 重构：把时间轴状态机从 `Hero.tsx` 抽进 `useHeroSequence()`。(3) 叙事：新增 `beats.delivery` 驱动画芯从舞台左缘滑入的去饱和态，定格后 `CatDelivery` 推入第 6 张完成落定；`SkipDial` 提供进度可见性与逃生舱。

**Tech Stack:** Next.js 15 (App Router) · React 19 · CSS Modules · 原生 `<video>` · ffmpeg（资产处理）

## 本仓库没有测试框架

`package.json` 只有 `dev` / `build` / `db:migrate` / `stripe:setup` / `admin`。没有 jest、vitest、playwright。

**因此每个任务的验收关卡是浏览器实跑验证**，依据是已批准 spec 的第五节。为此需要一个 dev server 启动配置（Task 0）。每条验收都写成了具体命令 + 预期观察，不是"手动检查一下"。

不为这次改动引入测试框架：它是纯视觉时序功能，单测测不到"去饱和读起来像不像还没准备好"这类真正的判据，而装框架是本次范围外的事。

## Global Constraints

- 所有可调时间常量集中在 `lib/heroConfig.ts` 的 `HERO_TIMINGS`，保持"调体验不碰组件逻辑"的既有约定
- 桌面端 `object-fit: cover` 各视口均为上下裁切、左右不裁；叠加层坐标一律基于 `useVideoRect` 返回的**视频内容矩形**，不是容器矩形
- `prefers-reduced-motion` 与移动端 `≤760px`（staticMode）下：猫送货不播、SkipDial 不出现、`beats.delivery` 与 `steps.plaque` 同时置 true 直接进落定态
- 不改视频的固定机位与落幅帧 —— `FRAME_RECT` 坐标以此为基准
- 保持 `Hero.tsx` 顶部备忘里 HeroCarousel 的升级路径可行
- 中文注释，与现有代码风格一致
- 每个任务结束即 commit

## 文件结构

| 文件 | 责任 | 动作 |
|---|---|---|
| `.claude/launch.json` | dev server 启动配置，供浏览器验证 | 新建 |
| `lib/heroConfig.ts` | 全部可调参数 | 修改：新增 `delivery` / `fallback` / `loadTimeout` / `dialMs`，重排 `freeze` |
| `components/Hero/useHeroSequence.ts` | 时间轴状态机：staticMode 判定、beats、steps、skip、定时器清理 | 新建 |
| `components/Hero/Hero.tsx` | 只负责渲染与布局 | 修改：状态机搬走，挂载新组件 |
| `components/Hero/ArtworkSwitcher.tsx` | 画框图层 + 画芯架 + 吊牌 | 修改：新增 `loadArt` / `delivering` prop |
| `components/Hero/ArtworkSwitcher.module.css` | 上者样式 | 修改：新增送货态 |
| `components/Hero/SkipDial.tsx` + `.module.css` | 爪印进度环 + 跳过 | 新建 |
| `components/Hero/CatDelivery.tsx` + `.module.css` | 猫推货层 | 新建 |
| `public/hero/` | 视频与静帧资产 | 修改：重压视频、画作转 JPEG |

---

### Task 0: 采集改动前的网络基线

后续每个任务都要用浏览器验证。`.claude/launch.json` 里**已有** `roomie-dev` 配置（port 3000），无需新建。

**Files:** 无（只采数据）

- [ ] **Step 1: 启动并确认首屏可达**

用 `preview_start({name: "roomie-dev"})` 启动，然后 `read_page`。

Expected: 页面加载，能看到 `aria-label="The Canvas Scratcher"` 的 section。

- [ ] **Step 2: 记录改动前的网络基线**

```js
performance.getEntriesByType('resource')
  .filter(r => r.name.includes('/hero/'))
  .map(r => ({
    f: r.name.split('/').pop(),
    kb: Math.round((r.encodedBodySize || 0) / 1024),
    startMs: Math.round(r.startTime),
  }))
  .sort((a, b) => a.startMs - b.startMs)
```

Expected（这是要修掉的现状，先存证）：`cat-scratcher-10s.mp4` 与 6 个 `art-0X.png` 的 `startMs` 几乎相同。记下总字节数与 art-01.png 的发起时刻，Task 1 与 Task 8 都要拿它作对比。

---

### Task 1: art 大图推迟到视频起播后再挂

首屏最大的一处自伤：6 张 `art-0X.png`（7.1MB）在挂载首帧就和 6.7MB 的视频抢带宽，而它们要到第 11 秒才用得上。

**Files:**
- Modify: `components/Hero/ArtworkSwitcher.tsx`
- Modify: `components/Hero/Hero.tsx`

**Interfaces:**
- Produces: `ArtworkSwitcher` 新增必填 prop `loadArt: boolean`；Hero 导出的行为不变

- [ ] **Step 1: ArtworkSwitcher 接受 loadArt**

`components/Hero/ArtworkSwitcher.tsx`，把 `Props` 改成：

```tsx
interface Props {
  rect: ContentRect; // 视频内容矩形（px，相对舞台）
  active: boolean; // 定格后才可交互
  revealed: boolean; // 吊牌/画芯架错峰浮现的时机
  /** 视频起播后才 true。在此之前不挂 art 大图 —— 7.1MB 的画会和
   *  视频抢首屏带宽，而它们要到第 11 秒才用得上。 */
  loadArt: boolean;
}
```

同一文件的函数签名：

```tsx
export default function ArtworkSwitcher({ rect, active, revealed, loadArt }: Props) {
```

- [ ] **Step 2: 画框图层按 loadArt 挂载**

同一文件，把画框图层里的 `{ARTWORKS.map(...)}` 整块包起来。找到这一行：

```tsx
        {ARTWORKS.map((a, i) => {
```

改成：

```tsx
        {loadArt &&
          ARTWORKS.map((a, i) => {
```

并把该 map 的收尾从：

```tsx
        })}
      </div>
```

改成：

```tsx
          })}
      </div>
```

- [ ] **Step 3: Hero 在视频起播时置 loadArt**

`components/Hero/Hero.tsx`，在 `const [steps, setSteps] = useState<FreezeSteps>(NO_STEPS);` 之后加一行状态：

```tsx
  // art 大图的放行闸：视频起播后才下，避开与视频抢首屏带宽
  const [loadArt, setLoadArt] = useState(false);
```

在视频模式的 effect 里，`const onError = () => setStaticMode(true);` 之后加：

```tsx
    const onPlaying = () => setLoadArt(true);
```

并在监听注册处加上（`v.addEventListener("error", onError);` 之后）：

```tsx
    v.addEventListener("playing", onPlaying, { once: true });
```

在清理函数里对应加上（`v.removeEventListener("error", onError);` 之后）：

```tsx
      v.removeEventListener("playing", onPlaying);
```

- [ ] **Step 4: staticMode 下立即放行**

同一文件，静态模式的 effect 里，在 `if (staticMode !== true) return;` 之后紧接着加：

```tsx
    setLoadArt(true); // 无视频可等，画作 350ms 后就要用
```

- [ ] **Step 5: 传给 ArtworkSwitcher**

同一文件，找到：

```tsx
          <ArtworkSwitcher rect={rect} active={frozen} revealed={steps.plaque} />
```

改成：

```tsx
          <ArtworkSwitcher
            rect={rect}
            active={frozen}
            revealed={steps.plaque}
            loadArt={loadArt}
          />
```

- [ ] **Step 6: 验证网络顺序**

重载页面后 `read_network_requests({urlPattern: "hero"})`。

Expected：`cat-scratcher-10s.mp4` 的请求发起时刻**早于**全部 `art-0X.png`。对比 Task 0 Step 3 记下的基线，art-01.png 的发起应明显后移。

若 art 仍与视频同时发起，说明 `playing` 事件没触发 —— 检查是否走进了 staticMode（桌面视口应为 `staticMode === false`）。

- [ ] **Step 7: 验证定格后画作正常显示**

等视频播完定格（约 12 秒），`computer({action: "screenshot"})`。

Expected：画框里是《晴野》，没有闪白、没有空框。点画框能换画。

- [ ] **Step 8: Commit**

```bash
git add components/Hero/ArtworkSwitcher.tsx components/Hero/Hero.tsx
git commit -m "art 大图不再和视频抢首屏带宽

6 张 art-0X.png 合计 7.1MB，原先在挂载首帧就全下，而它们要到
第 11 秒定格后才用得上。改成视频 playing 后才挂 src。
staticMode 无视频可等，仍立即放行。"
```

---

### Task 2: 文案时机从视频时间解耦 + 弱网兜底

`beats` 绑在 `video.currentTime` 上，视频不起播则恒为 0，标题、副标题、CTA 全部不出现 —— 加载期间首屏是真的没有内容。

**Files:**
- Modify: `lib/heroConfig.ts`
- Modify: `components/Hero/Hero.tsx`

**Interfaces:**
- Consumes: Task 1 的 `loadArt` 状态
- Produces: `HERO_TIMINGS.fallback: { title: number; subtitle: number }`（毫秒）、`HERO_TIMINGS.loadTimeout: number`（毫秒）

- [ ] **Step 1: 新增兜底时间常量**

`lib/heroConfig.ts`，把 `HERO_TIMINGS` 整块替换为：

```ts
/** 文字与视频叙事咬合的时间轴（秒）。onEnded 后的编排见 freeze 部分（毫秒） */
export const HERO_TIMINGS = {
  title: 0.6, // 空镜稳定后，标题淡入
  subtitle: 2.6, // 猫走进画面时，副标题跟进
  /**
   * 页面时钟兜底（毫秒）——— 与上面两拍是「先到者生效」的关系。
   * beats 原本只绑 video.currentTime，视频不起播就恒为 0，
   * 于是加载期间首屏连标题都没有。这两个值保证文案不等视频。
   */
  fallback: { title: 400, subtitle: 2000 },
  /** 迟迟不 canplay 就放弃视频走静态定格（毫秒），否则弱网永远卡在 poster */
  loadTimeout: 8000,
  // 定格后的错峰浮现（相对 onEnded 的毫秒数）
  freeze: {
    settle: 0, // 文字轻轻上移收拢
    cta: 680, // 停一拍 → CTA 上浮
    plaque: 1500, // 再停一拍 → 换画铭牌最后浮现
    scrollCue: 2300, // 页脚滚动提示，最轻的一笔
  },
};
```

（`freeze` 的重排留到 Task 7，那时猫送货才需要新的排期。）

- [ ] **Step 2: Hero 加页面时钟兜底**

`components/Hero/Hero.tsx`，在视频模式 effect（`useEffect(() => { if (staticMode !== false) return; ...`）**之后**、静态模式 effect **之前**，插入一个新 effect：

```tsx
  // 文案的页面时钟兜底 —— beats 平时由视频时间驱动，但视频不起播时
  // currentTime 恒为 0，首屏会一个字都没有。两条轨先到者生效。
  useEffect(() => {
    if (staticMode !== false) return;
    const f = HERO_TIMINGS.fallback;
    timers.current.push(
      setTimeout(
        () => setBeats((b) => (b.title ? b : { ...b, title: true })),
        f.title,
      ),
      setTimeout(
        () => setBeats((b) => (b.subtitle ? b : { ...b, subtitle: true })),
        f.subtitle,
      ),
    );
  }, [staticMode]);
```

- [ ] **Step 3: 加视频加载超时降级**

同一文件，视频模式 effect 内，在 `if (v.readyState >= 2) tryPlay();` 之后加：

```tsx
    // 弱网兜底：迟迟拿不到可播数据就放弃视频，让用户至少拿到完整的静态首屏
    const loadGuard = setTimeout(() => {
      if (v.readyState < 2) setStaticMode(true);
    }, HERO_TIMINGS.loadTimeout);
```

并在同一 effect 的清理函数最前面加：

```tsx
      clearTimeout(loadGuard);
```

- [ ] **Step 4: 验证正常网速下不改变观感**

重载页面，全程录像式观察：`computer({action: "screenshot"})` 在页面加载后约 1 秒抓一张。

Expected：标题已出现。若视频起播正常，标题出现的时机与改动前无肉眼差别（400ms 兜底 vs 视频 0.6s，两者接近）。

- [ ] **Step 5: 验证慢网下标题不再缺席**

用 `javascript_tool` 在页面里阻断视频加载，模拟视频永远不来：

```js
document.querySelector('video')?.setAttribute('src', '/hero/does-not-exist.mp4');
location.reload();
```

更可靠的做法是直接验证兜底计时器本身 —— 重载后立刻抓取 500ms 时的标题状态：

```js
(async () => {
  const t0 = performance.now();
  await new Promise(r => setTimeout(r, 600));
  const h1 = document.querySelector('h1');
  return {
    elapsed: Math.round(performance.now() - t0),
    titleOpacity: h1 ? getComputedStyle(h1).opacity : 'no h1',
  };
})()
```

Expected：`titleOpacity` 为 `1`（或正在向 1 过渡的非 0 值）。改动前在视频未起播时这里恒为 `0`。

- [ ] **Step 6: Commit**

```bash
git add lib/heroConfig.ts components/Hero/Hero.tsx
git commit -m "标题不再等视频

beats 只绑 video.currentTime，视频不起播就恒为 0，于是加载期间
首屏一个字都没有 —— 用户看到的是静止 poster 加半边空白。
加一条页面时钟轨，与视频轨先到者生效；另加 8 秒 canplay 兜底，
弱网不再永远卡在 poster。"
```

---

### Task 3: 视频重压与画作转 JPEG

**Files:**
- Create: `tools/compress_hero_media.sh`
- Modify: `public/hero/cat-scratcher-10s.mp4`（重压覆盖）
- Create: `public/hero/cat-scratcher-10s.webm`
- Create: `public/hero/art/art-0{1..6}.jpg`
- Modify: `components/Hero/Hero.tsx`（`<source>` 标签）
- Modify: `lib/heroConfig.ts`（`ARTWORKS[].src` 指向 jpg）

**Interfaces:**
- Produces: `public/hero/cat-scratcher-10s.webm`；`ARTWORKS[i].src` 改为 `.jpg` 路径

**为什么是 JPEG 而不是 WebP**（执行前实测改的档）：

1. 这台机器上**没有任何可用的 WebP 编码器** —— ffmpeg 只有 WebP muxer
   没有 libwebp encoder，`cwebp` 没装，ImageMagick 没装，`sips -s format webp`
   也失败。
2. 这些 PNG **本来就没有 alpha 通道**（实测 IHDR colortype=2，纯 RGB，
   734×1010）。羽化边缘是 CSS 的 `frame-mask.png` 做的，画作层不需要透明。
   用 PNG 存不透明的绘画内容纯属格式用错。
3. 缩略图 `flat-0X-s.jpg` 本来就是 JPEG，格式上一致。

实测 art-02：PNG 1265KB → q=2 285KB / q=4 183KB。2 倍放大裁切对比下
q=4 与原图已看不出差别。**取 q=2（视觉无损档）**：经 Task 1 之后画作
已不在关键路径上（视频起播后才下），字节该花在画质上 —— 画作本身就是商品。

**视频档位不预设**，下面 CRF 27 是起点，必须肉眼比对后定档。

**事后改档（执行完 Task 3 后用高倍放大裁切复核才发现）**：下面 Step 2
里 `scale=1280:960` + WebM 首选的两个决定都是错的，已在后续提交中撤销：

1. 当初肉眼比对只看了块状噪点和条带，没看纹理——`1280x960/CRF27`
   把画布的织物纹理（天空编织颗粒、油彩笔触、猫须细节）磨平了，而
   纹理才是这个商品的卖点。且 1440 视口下 `object-fit: cover` 的
   内容矩形约 1440x1080，比 1280 还宽，等于在最常见的桌面尺寸下
   把视频放大着看。改回原生 1664x1248、CRF 26：2.12MB，纹理保住。
2. VP9 WebM 压出来 1.96MB，比 H.264 的 1.01MB 还大，而 WebM 是
   `<source>` 里的第一条，等于让 Chrome（多数用户）多下将近 1MB。
   已整条移除，`<video>` 改回单一 `src`。

下面 Step 2/3/5 的脚本与代码片段是**原始决定**，保留作记录；实际生效
的版本见 `tools/compress_hero_media.sh` 与 `components/Hero/Hero.tsx`。

- [ ] **Step 1: 把原始视频移出 public/，作为可重复压制的母版**

压制脚本必须有一个**durable 的源**。原先设想的 `/tmp` 备份不算数 —— tmp 一清就再也压不了第二次，而换画作、调 CRF 都要重跑。

母版移出 `public/` 后 Vercel 不再部署它（省 6.7MB 部署体积），但仓库里留着，脚本随时可用：

```bash
mkdir -p assets/hero
git mv public/hero/cat-scratcher-10s.mp4 assets/hero/cat-scratcher-10s.master.mp4
ls -la assets/hero/
```

Expected：`cat-scratcher-10s.master.mp4`，约 6.7MB。

画作 PNG **不动** —— 它们是 `make_artworks.py` 的产物，是 JPEG 的源。留在 `public/hero/art/` 里（浏览器不会请求它们，因为 `ARTWORKS[].src` 指向 `.jpg`），脚本每次从它们重新生成，管线可重复。

- [ ] **Step 2: 写压制脚本**

`tools/compress_hero_media.sh`:

```bash
#!/usr/bin/env bash
# Hero 首屏资产压制。原始素材体积是首屏最大的负担：
#   视频 6.7MB（1664x1248 / 5.4Mbps）+ 6 张画 7.1MB = 13.8MB
# 目标：视频 ~1.8MB，画作合计 ~1.7MB。
#
# 源都在仓库里，本脚本可反复重跑：
#   视频母版 assets/hero/cat-scratcher-10s.master.mp4（不在 public/，不部署）
#   画作 public/hero/art/art-0X.png（make_artworks.py 的产物，浏览器不请求）
# 输出才是浏览器真正下载的东西。
#
# 画作转 JPEG 而非 WebP：这些 PNG 没有 alpha（羽化边缘由 CSS 的
# frame-mask.png 负责），而本机没有可用的 WebP 编码器。JPEG q=2 是
# 视觉无损档，1265KB → 285KB。
#
# 用法：bash tools/compress_hero_media.sh [CRF] [JPEG_Q]
# CRF 默认 27（越小越清晰）；JPEG_Q 默认 2（ffmpeg 的 -q:v，2 最好、31 最差）。
# 改完必须肉眼比对 —— 这是画作商品页，画质是产品本身。
set -euo pipefail
cd "$(dirname "$0")/.."

CRF="${1:-27}"
JPEG_Q="${2:-2}"
SRC=assets/hero/cat-scratcher-10s.master.mp4

if [ ! -f "$SRC" ]; then
  echo "找不到视频母版 $SRC" >&2
  echo "它应当在仓库里。若被误删，从 git 历史恢复：" >&2
  echo "  git log --all --oneline -- '*cat-scratcher-10s*'" >&2
  exit 1
fi

echo "== H.264 (CRF $CRF, 1280x960) =="
ffmpeg -v error -y -i "$SRC" \
  -vf scale=1280:960 -c:v libx264 -crf "$CRF" -preset slow \
  -profile:v high -pix_fmt yuv420p -movflags +faststart -an \
  public/hero/cat-scratcher-10s.mp4

echo "== VP9 WebM (CRF $CRF, 1280x960) =="
ffmpeg -v error -y -i "$SRC" \
  -vf scale=1280:960 -c:v libvpx-vp9 -crf "$CRF" -b:v 0 \
  -row-mt 1 -an \
  public/hero/cat-scratcher-10s.webm

echo "== 画作转 JPEG (q=$JPEG_Q) =="
for i in 1 2 3 4 5 6; do
  ffmpeg -v error -y -i "public/hero/art/art-0$i.png" \
    -q:v "$JPEG_Q" "public/hero/art/art-0$i.jpg"
done

echo
echo "== 结果 =="
ls -la public/hero/cat-scratcher-10s.mp4 public/hero/cat-scratcher-10s.webm
ls -la public/hero/art/art-0*.jpg
```

- [ ] **Step 3: 跑一遍并看体积**

```bash
bash tools/compress_hero_media.sh 27
```

Expected：mp4 落在 1.5–2.5MB，webm 更小，6 个 jpg 合计约 1.7MB。

若 mp4 超过 3MB，用 `bash tools/compress_hero_media.sh 30` 重跑；若肉眼发现画面有块状噪点，用 `24` 重跑。

- [ ] **Step 4: 肉眼比对画质**

抽同一帧对比母版与压制结果：

```bash
ffmpeg -v error -ss 9.9 -i assets/hero/cat-scratcher-10s.master.mp4 -frames:v 1 -q:v 2 /tmp/before.jpg -y
ffmpeg -v error -ss 9.9 -i public/hero/cat-scratcher-10s.mp4 -frames:v 1 -q:v 2 /tmp/after.jpg -y
echo "对比 /tmp/before.jpg 与 /tmp/after.jpg"
```

用 Read 工具读这两张图对比。

Expected：画框里的《晴野》色块边缘干净，猫的黑白毛发交界处没有明显色块化，墙面渐变没有条带。任一项不满足 → 回 Step 3 降 CRF 重跑。

- [ ] **Step 5: 视频改用 source 标签**

`components/Hero/Hero.tsx`，把 `<video>` 那一段替换为：

```tsx
          <video
            ref={videoRef}
            className={styles.media}
            style={{ objectPosition }}
            poster="/hero/poster-first.jpg"
            muted
            playsInline
            preload="auto"
            aria-label="A cat walks into a sunny living room, scratches a framed canvas leaning on the wall, then sits beside it"
          >
            {/* VP9 优先，H.264 兜底 —— Safari 不吃 VP9 会自动落到下一条 */}
            <source src="/hero/cat-scratcher-10s.webm" type="video/webm" />
            <source src="/hero/cat-scratcher-10s.mp4" type="video/mp4" />
          </video>
```

注意 `src` 属性已移除，改由 `<source>` 提供。

- [ ] **Step 6: ARTWORKS 指向 jpg**

`lib/heroConfig.ts`，把 `ARTWORKS` 数组里 6 处 `src` 的扩展名从 `.png` 改为 `.jpg`：

```ts
    src: "/hero/art/art-01.jpg",
```

依此类推到 `art-06.jpg`。其余字段不动。

- [ ] **Step 7: 更新管线注释**

`lib/heroConfig.ts`，`ARTWORKS` 上方的注释块里，找到这一行：

```
 * 上新画作 = 放入源图 → 两个脚本各跑一次 → 在这里加一项。
```

改成：

```
 * 上新画作 = 放入源图 → 两个脚本各跑一次 → 跑 tools/compress_hero_media.sh
 * 转 JPEG → 在这里加一项。
```

- [ ] **Step 8: 验证仍能播放且体积下来了**

重载页面，`read_network_requests({urlPattern: "hero"})`。

Expected：加载的是 `.webm`（Chrome）；art 请求的是 `.jpg`；hero 相关请求总字节数从约 13.8MB 降到 4MB 以内。

再 `read_console_messages({onlyErrors: true})`。

Expected：无 404、无媒体解码错误。

- [ ] **Step 9: 验证定格画面与画作切换**

等定格后 `computer({action: "screenshot"})`，再点画框换一张，再截一张。

Expected：两张都正常，画作清晰，换画过渡无闪白。

- [ ] **Step 10: 确认 PNG 不再被浏览器请求**

`art-0X.png` 保留在仓库里（它们是 JPEG 的源），但浏览器不该再下它们。重载页面后：

```js
performance.getEntriesByType('resource')
  .filter(r => r.name.includes('/art/'))
  .map(r => r.name.split('/').pop())
```

Expected：只有 `art-0X.jpg` 与 `flat-0X-s.jpg`，**没有** `art-0X.png`。

- [ ] **Step 11: Commit**

```bash
git add -A assets public/hero tools/compress_hero_media.sh components/Hero/Hero.tsx lib/heroConfig.ts
git commit -m "首屏资产从 14MB 压到 3MB 以内

视频 1664x1248/5.4Mbps 对一个 hero 是过配的，降到 1280x960 并出
一条 VP9 作首选；6 张画作 PNG 转 JPEG（本机无可用 WebP 编码器，且这些 PNG 无 alpha）。

母版移到 assets/hero/（不在 public/ 下，不部署，但留在仓库里），
画作 PNG 原地保留作 JPEG 的源 —— 压制脚本要能反复重跑，换画作
和调 CRF 都得从源头再来一遍。"
```

---

### Task 4: 抽出 useHeroSequence（纯重构，行为不变）

`Hero.tsx` 已 216 行且同时管状态机、布局和四个装饰层。后面三个任务都要往状态机里加东西，先腾地方。

**Files:**
- Create: `components/Hero/useHeroSequence.ts`
- Modify: `components/Hero/Hero.tsx`

**Interfaces:**
- Produces:
  ```ts
  export interface FreezeSteps { settled: boolean; cta: boolean; plaque: boolean; cue: boolean }
  export interface HeroBeats { title: boolean; subtitle: boolean }
  export interface HeroSequence {
    staticMode: boolean | null;
    frozen: boolean;
    beats: HeroBeats;
    steps: FreezeSteps;
    loadArt: boolean;
    videoRef: React.RefObject<HTMLVideoElement | null>;
  }
  export function useHeroSequence(): HeroSequence
  ```
- 后续任务会往 `HeroSequence` 上加 `skip` 与 `beats.delivery`

- [ ] **Step 1: 新建 hook 文件**

`components/Hero/useHeroSequence.ts`：

```ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { HERO_TIMINGS } from "@/lib/heroConfig";

export interface FreezeSteps {
  settled: boolean;
  cta: boolean;
  plaque: boolean;
  cue: boolean;
}

export interface HeroBeats {
  title: boolean;
  subtitle: boolean;
}

export interface HeroSequence {
  /** null = 还没判定；true = 无视频路径（reduced-motion / 移动端 / 播放失败） */
  staticMode: boolean | null;
  frozen: boolean;
  beats: HeroBeats;
  steps: FreezeSteps;
  /** art 大图的放行闸 —— 视频起播后才下，避开与视频抢首屏带宽 */
  loadArt: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

const NO_STEPS: FreezeSteps = {
  settled: false,
  cta: false,
  plaque: false,
  cue: false,
};
const ALL_STEPS: FreezeSteps = {
  settled: true,
  cta: true,
  plaque: true,
  cue: true,
};

/**
 * 首屏剧场的时间轴状态机。
 *
 * 两条轨并行推进 beats：视频轨（video.currentTime，与画面叙事咬合）
 * 和页面轨（HERO_TIMINGS.fallback，保证视频不来时首屏也有内容），
 * 先到者生效。定格后由 freeze 序列错峰驱动 steps。
 */
export function useHeroSequence(): HeroSequence {
  const videoRef = useRef<HTMLVideoElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const [staticMode, setStaticMode] = useState<boolean | null>(null);
  const [frozen, setFrozen] = useState(false);
  const [beats, setBeats] = useState<HeroBeats>({
    title: false,
    subtitle: false,
  });
  const [steps, setSteps] = useState<FreezeSteps>(NO_STEPS);
  const [loadArt, setLoadArt] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const small = window.matchMedia("(max-width: 760px)");
    setStaticMode(reduced.matches || small.matches);
  }, []);

  const runFreezeSequence = useCallback((instant: boolean) => {
    setFrozen(true);
    setBeats({ title: true, subtitle: true });
    if (instant) {
      setSteps(ALL_STEPS);
      return;
    }
    const t = HERO_TIMINGS.freeze;
    const plan: [number, keyof FreezeSteps][] = [
      [t.settle, "settled"],
      [t.cta, "cta"],
      [t.plaque, "plaque"],
      [t.scrollCue, "cue"],
    ];
    for (const [delay, key] of plan) {
      timers.current.push(
        setTimeout(() => setSteps((s) => ({ ...s, [key]: true })), delay),
      );
    }
  }, []);

  // 视频模式：起播 + 与叙事咬合的文字节拍
  useEffect(() => {
    if (staticMode !== false) return;
    const v = videoRef.current;
    if (!v) return;

    const tryPlay = () => {
      const p = v.play();
      if (p) p.catch(() => setStaticMode(true)); // autoplay 被拒 → 静态降级
    };
    if (v.readyState >= 2) tryPlay();

    // 弱网兜底：迟迟拿不到可播数据就放弃视频，让用户至少拿到完整的静态首屏
    const loadGuard = setTimeout(() => {
      if (v.readyState < 2) setStaticMode(true);
    }, HERO_TIMINGS.loadTimeout);

    const onTime = () => {
      const t = v.currentTime;
      setBeats((b) => {
        const title = b.title || t >= HERO_TIMINGS.title;
        const subtitle = b.subtitle || t >= HERO_TIMINGS.subtitle;
        return title === b.title && subtitle === b.subtitle
          ? b
          : { title, subtitle };
      });
    };
    const onEnded = () => {
      v.pause(); // 定格最后一帧
      runFreezeSequence(false);
    };
    const onError = () => setStaticMode(true);
    const onPlaying = () => setLoadArt(true);

    v.addEventListener("canplay", tryPlay, { once: true });
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("ended", onEnded);
    v.addEventListener("error", onError);
    v.addEventListener("playing", onPlaying, { once: true });
    return () => {
      clearTimeout(loadGuard);
      v.removeEventListener("canplay", tryPlay);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("ended", onEnded);
      v.removeEventListener("error", onError);
      v.removeEventListener("playing", onPlaying);
    };
  }, [staticMode, runFreezeSequence]);

  // 文案的页面时钟兜底 —— 视频轨不来时首屏也不会一个字都没有
  useEffect(() => {
    if (staticMode !== false) return;
    const f = HERO_TIMINGS.fallback;
    timers.current.push(
      setTimeout(
        () => setBeats((b) => (b.title ? b : { ...b, title: true })),
        f.title,
      ),
      setTimeout(
        () => setBeats((b) => (b.subtitle ? b : { ...b, subtitle: true })),
        f.subtitle,
      ),
    );
  }, [staticMode]);

  // 静态模式：reduced-motion 全量直呈；小屏走一遍快速错峰
  useEffect(() => {
    if (staticMode !== true) return;
    setLoadArt(true); // 无视频可等，画作 350ms 后就要用
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced) {
      runFreezeSequence(true);
    } else {
      setBeats({ title: true, subtitle: false });
      timers.current.push(setTimeout(() => runFreezeSequence(false), 350));
    }
  }, [staticMode, runFreezeSequence]);

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
    },
    [],
  );

  return { staticMode, frozen, beats, steps, loadArt, videoRef };
}
```

- [ ] **Step 2: Hero.tsx 改用 hook**

`components/Hero/Hero.tsx`，把从 `import { useCallback, useEffect, useRef, useState } from "react";` 到 `useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);` 之间的**全部内容**（即所有 import 之后的 `FreezeSteps` 定义、常量、状态、四个 effect）替换为：

```tsx
import { useRef } from "react";
import { COVER_FOCUS } from "@/lib/heroConfig";
import { useVideoRect } from "./useVideoRect";
import { useHeroSequence } from "./useHeroSequence";
import HeroCopy from "./HeroCopy";
import ArtworkSwitcher from "./ArtworkSwitcher";
import styles from "./Hero.module.css";

export type { FreezeSteps } from "./useHeroSequence";

const objectPosition = `${COVER_FOCUS.x * 100}% ${COVER_FOCUS.y * 100}%`;

export default function Hero({
  priceText,
}: {
  /** 流式节点，晚于本组件到达 —— 不能是 string，否则 Hero 得等价格 */
  priceText: React.ReactNode;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const rect = useVideoRect(stageRef);
  const { staticMode, frozen, beats, steps, loadArt, videoRef } =
    useHeroSequence();
```

保留文件顶部那段 HeroCarousel 备忘注释与 `"use client";` 不动。`return (...)` 之后的 JSX 全部不动。

- [ ] **Step 3: 修正 HeroCopy 的类型来源**

`components/Hero/HeroCopy.tsx`，把：

```tsx
import type { FreezeSteps } from "./Hero";
```

改成：

```tsx
import type { FreezeSteps } from "./useHeroSequence";
```

- [ ] **Step 4: 类型检查**

```bash
npx tsc --noEmit
```

Expected：无报错。若报 `FreezeSteps` 找不到，检查 Step 2 的 `export type` 转发是否写上。

- [ ] **Step 5: 验证行为完全不变**

重载页面，完整看一遍 12 秒时间轴，在定格后 `computer({action: "screenshot"})`。

Expected：与 Task 3 结束时的截图无差别 —— 标题、副标题、CTA、画芯架、吊牌、滚动提示全部到位，换画可点。这是纯重构，任何观感差异都是 bug。

- [ ] **Step 6: Commit**

```bash
git add components/Hero/useHeroSequence.ts components/Hero/Hero.tsx components/Hero/HeroCopy.tsx
git commit -m "时间轴状态机搬进 useHeroSequence

Hero.tsx 同时管状态机、布局和四个装饰层，216 行且还要再加三样
东西。状态机搬走后 Hero.tsx 只剩渲染。纯重构，行为不变。"
```

---

### Task 5: SkipDial —— 爪印进度环与逃生舱

一个控件干两件事：环本身是可预测性（看得见终点），hover 是控制权（不想等的人不用等）。

**Files:**
- Create: `components/Hero/SkipDial.tsx`
- Create: `components/Hero/SkipDial.module.css`
- Modify: `lib/heroConfig.ts`
- Modify: `components/Hero/useHeroSequence.ts`
- Modify: `components/Hero/Hero.tsx`

**Interfaces:**
- Consumes: Task 4 的 `useHeroSequence()`
- Produces:
  - `HERO_TIMINGS.dialMs: number` —— 环的长度（毫秒）= 起播到可交互
  - `HeroSequence` 新增 `skip: () => void`
  - `SkipDial` props：`{ mode: "buffering" | "running"; durationMs: number; onSkip: () => void }`

- [ ] **Step 1: 新增环长度常量**

`lib/heroConfig.ts`，在 `HERO_TIMINGS` 的 `loadTimeout` 之后、`freeze` 之前插入：

```ts
  /**
   * SkipDial 进度环的长度（毫秒）= 起播 → 可交互。
   * 必须等于 视频时长(10s) + freeze.plaque —— 环走完的那一刻正是
   * 画芯落定可点的那一刻。改 freeze.plaque 时这里要跟着改。
   */
  dialMs: 11000,
```

- [ ] **Step 2: 状态机暴露 skip**

`components/Hero/useHeroSequence.ts`，在 `HeroSequence` 接口里加：

```ts
  /** 跳过整场演出，直接进可交互的定格态 */
  skip: () => void;
```

在 `const [loadArt, setLoadArt] = useState(false);` 之后加一个防重入 ref：

```ts
  // skip 会把视频 seek 到末尾，这会触发 ended —— 若不拦，
  // runFreezeSequence 会被 (true) 和 (false) 各跑一遍，错峰序列打架
  const skipped = useRef(false);
```

在 `onEnded` 里最前面加一行守卫：

```ts
    const onEnded = () => {
      if (skipped.current) return;
      v.pause(); // 定格最后一帧
      runFreezeSequence(false);
    };
```

在 `runFreezeSequence` 定义之后加 `skip` 的实现：

```ts
  const skip = useCallback(() => {
    if (skipped.current) return;
    skipped.current = true;
    setLoadArt(true); // 立刻要用画作了，不能再等 playing
    const v = videoRef.current;
    if (v && v.readyState >= 2) {
      // 有可播数据：停在末帧，画面与正常结束一致
      v.pause();
      try {
        v.currentTime = v.duration || 0;
      } catch {
        // duration 尚不可用时忽略，下面的静态降级会接住
      }
      runFreezeSequence(true);
    } else {
      // 视频还没来：直接走静态定格，staticMode 的 effect 会补齐其余
      setStaticMode(true);
    }
  }, [runFreezeSequence]);
```

把 return 改成：

```ts
  return { staticMode, frozen, beats, steps, loadArt, videoRef, skip };
```

注意 `useRef` 已在文件顶部 import，无需改 import。

- [ ] **Step 3: 写 SkipDial 组件**

`components/Hero/SkipDial.tsx`：

```tsx
"use client";

import styles from "./SkipDial.module.css";

interface Props {
  /** buffering = 视频还没来（时长未知）；running = 演出进行中（时长确定） */
  mode: "buffering" | "running";
  /** running 模式下环走完一圈的毫秒数 */
  durationMs: number;
  onSkip: () => void;
}

const R = 15; // 环半径
const C = 2 * Math.PI * R; // 周长，用作 dasharray

/**
 * 首屏右下角的爪印进度环，一个控件两件事：
 *   环 = 可预测性。有终点的进度告诉用户「再等 3 秒就好」——
 *        无限转圈说的是「天知道要多久」，那是促使人划走的东西。
 *   hover = 控制权。不想等的人不必等。
 * 移动端不挂载（见 Hero.tsx）—— staticMode 本来就没有可跳过的等待。
 */
export default function SkipDial({ mode, durationMs, onSkip }: Props) {
  return (
    <button
      type="button"
      className={styles.dial}
      onClick={onSkip}
      aria-label="Skip the intro and go straight to swapping prints"
    >
      <svg viewBox="0 0 40 40" className={styles.ring} aria-hidden>
        <circle className={styles.track} cx="20" cy="20" r={R} />
        <circle
          className={mode === "running" ? styles.arcRun : styles.arcWait}
          cx="20"
          cy="20"
          r={R}
          style={
            {
              strokeDasharray: C,
              "--dur": `${durationMs}ms`,
              "--circ": C,
            } as React.CSSProperties
          }
        />
      </svg>

      {/* 静息态：爪印（几何与 Hero 的滚动提示同源） */}
      <svg className={styles.paw} viewBox="0 0 16 14" aria-hidden>
        <ellipse cx="8" cy="9.4" rx="3.6" ry="3" />
        <ellipse cx="3.6" cy="5" rx="1.5" ry="1.9" />
        <ellipse cx="8" cy="3.4" rx="1.5" ry="1.9" />
        <ellipse cx="12.4" cy="5" rx="1.5" ry="1.9" />
      </svg>

      {/* hover 态：换成 Skip */}
      <span className={styles.label} aria-hidden>
        Skip
      </span>
    </button>
  );
}
```

- [ ] **Step 4: 写 SkipDial 样式**

`components/Hero/SkipDial.module.css`：

```css
/* 右下角的进度环。够小、够淡，不跟画面抢注意力；
   但一直在走，所以「还有内容」这件事一直在被说着。 */

.dial {
  position: absolute;
  right: clamp(1.1rem, 2.4vw, 2rem);
  bottom: clamp(1.1rem, 2.4vh, 2rem);
  z-index: 6;
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: rgba(248, 240, 222, 0.42);
  backdrop-filter: blur(3px);
  cursor: pointer;
  pointer-events: auto;
  -webkit-tap-highlight-color: transparent;
  transition:
    background 260ms var(--ease-out),
    transform 260ms var(--ease-soft);
  /* 演出结束后由 Hero 卸载，这里只管淡入 */
  animation: dialIn 700ms var(--ease-out) 500ms both;
}

@keyframes dialIn {
  from {
    opacity: 0;
    transform: scale(0.86);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.dial:hover,
.dial:focus-visible {
  background: rgba(248, 240, 222, 0.92);
  transform: scale(1.06);
}

.ring,
.paw,
.label {
  grid-area: 1 / 1;
}

.ring {
  width: 40px;
  height: 40px;
  transform: rotate(-90deg); /* 12 点方向起步 */
}

.track {
  fill: none;
  stroke: rgba(58, 91, 199, 0.16);
  stroke-width: 2.2;
}

.arcRun,
.arcWait {
  fill: none;
  stroke: var(--orange-deep);
  stroke-width: 2.2;
  stroke-linecap: round;
}

/* 演出进行中：确定进度，一圈走完 = 可交互 */
.arcRun {
  animation: arcSweep var(--dur) linear both;
}

@keyframes arcSweep {
  from {
    stroke-dashoffset: var(--circ);
  }
  to {
    stroke-dashoffset: 0;
  }
}

/* 视频还没来：此时确实不知道要多久，用一段慢弧诚实表达 */
.arcWait {
  stroke-dasharray: 18 200;
  animation: arcSpin 1.5s linear infinite;
}

@keyframes arcSpin {
  to {
    transform: rotate(360deg);
  }
}

.arcWait {
  transform-origin: 20px 20px;
}

.paw {
  width: 16px;
  height: 14px;
  fill: rgba(58, 91, 199, 0.72);
  transition:
    opacity 180ms var(--ease-out),
    transform 180ms var(--ease-out);
}

.label {
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: var(--blue-deep);
  opacity: 0;
  transform: translateY(3px);
  transition:
    opacity 180ms var(--ease-out),
    transform 180ms var(--ease-out);
}

.dial:hover .paw,
.dial:focus-visible .paw {
  opacity: 0;
  transform: scale(0.8);
}

.dial:hover .label,
.dial:focus-visible .label {
  opacity: 1;
  transform: translateY(0);
}

@media (prefers-reduced-motion: reduce) {
  .dial {
    animation: none;
  }
  .arcWait {
    animation: none;
    stroke-dasharray: none;
  }
}
```

- [ ] **Step 5: 挂进 Hero**

`components/Hero/Hero.tsx`，import 区加：

```tsx
import SkipDial from "./SkipDial";
```

并把 `COVER_FOCUS` 那行 import 改为同时取 `HERO_TIMINGS`：

```tsx
import { COVER_FOCUS, HERO_TIMINGS } from "@/lib/heroConfig";
```

解构处加上 `skip`：

```tsx
  const { staticMode, frozen, beats, steps, loadArt, videoRef, skip } =
    useHeroSequence();
```

在 JSX 里，`{/* 滚动提示 ... */}` 那个 div **之前**插入：

```tsx
        {/* 进度环 + 逃生舱。只在视频路径下出现 —— staticMode 本来就
            只有 350ms 错峰，没有可跳过的等待；定格后演出结束即卸载。 */}
        {staticMode === false && !frozen && (
          <SkipDial
            mode={loadArt ? "running" : "buffering"}
            durationMs={HERO_TIMINGS.dialMs}
            onSkip={skip}
          />
        )}
```

- [ ] **Step 6: 类型检查**

```bash
npx tsc --noEmit
```

Expected：无报错。

- [ ] **Step 7: 验证环在走**

重载页面，等约 3 秒后：

```js
(() => {
  const arc = document.querySelector('svg circle:nth-of-type(2)');
  if (!arc) return 'no arc';
  const cs = getComputedStyle(arc);
  return { dashoffset: cs.strokeDashoffset, animation: cs.animationName };
})()
```

Expected：`animation` 为 `arcSweep`，`dashoffset` 是一个介于 0 和周长（约 94.2）之间的中间值 —— 说明环在确定进度地走。

- [ ] **Step 8: 验证 hover 变 Skip**

`computer({action: "hover", coordinate: [<右下角环的坐标>]})`，然后截图。先用 `read_page` 找到按钮的 ref 定位。

Expected：爪印消失，"Skip" 字样出现，底色变实。

- [ ] **Step 9: 验证点击跳过且不重入**

重载后在视频播放中（约第 4 秒）点击环，然后：

```js
(async () => {
  await new Promise(r => setTimeout(r, 900));
  const v = document.querySelector('video');
  const rack = document.querySelector('[role="radiogroup"]');
  const minis = rack ? rack.querySelectorAll('button') : [];
  return {
    videoPaused: v ? v.paused : 'no video',
    videoAtEnd: v ? Math.abs(v.currentTime - v.duration) < 0.5 : null,
    rackOpacity: minis[0] ? getComputedStyle(minis[0]).opacity : 'no minis',
    dialGone: !document.querySelector('button[aria-label^="Skip the intro"]'),
  };
})()
```

Expected：`videoPaused: true`、`videoAtEnd: true`、`rackOpacity: "1"`、`dialGone: true`。全部立刻到位，没有二次错峰造成的闪动。

这一条验的正是 spec 里点名的那个最容易漏的坑 —— `skipped` ref 若忘了写，`ended` 会让 `runFreezeSequence` 跑第二遍。

- [ ] **Step 10: 验证移动端不出现**

`resize_window({preset: "mobile"})` 后重载，`read_page`。

Expected：找不到 `aria-label` 以 "Skip the intro" 开头的按钮。

改回 `resize_window({preset: "desktop"})`。

- [ ] **Step 11: Commit**

```bash
git add components/Hero/SkipDial.tsx components/Hero/SkipDial.module.css components/Hero/useHeroSequence.ts components/Hero/Hero.tsx lib/heroConfig.ts
git commit -m "SkipDial：看得见终点的等待，外加一个逃生舱

一个控件两件事。环是可预测性 —— 有终点的进度说的是「再 3 秒就好」，
无限转圈说的是「天知道」，后者恰恰是促使人划走的东西。hover 是
控制权，不想等的人不必等；弱网点它直接进静态定格态。

skip 会 seek 到末尾从而触发 ended，用 skipped ref 拦住，否则
runFreezeSequence 会被 (true) 和 (false) 各跑一遍。"
```

---

### Task 6: 画芯提前滑入的送货态

让画芯在第 7 秒就从舞台左缘进场，去饱和、不可点。用户提前 4 秒知道有东西在来。

**Files:**
- Modify: `lib/heroConfig.ts`
- Modify: `components/Hero/useHeroSequence.ts`
- Modify: `components/Hero/ArtworkSwitcher.tsx`
- Modify: `components/Hero/ArtworkSwitcher.module.css`
- Modify: `components/Hero/Hero.tsx`

**Interfaces:**
- Consumes: Task 4 的 `HeroBeats`
- Produces: `HeroBeats` 新增 `delivery: boolean`；`ArtworkSwitcher` 新增必填 prop `delivering: boolean`

- [ ] **Step 1: 新增 delivery 时刻**

`lib/heroConfig.ts`，在 `HERO_TIMINGS` 的 `subtitle` 之后加：

```ts
  /**
   * 画芯开始从舞台左缘滑入（视频秒）。定格前 3 秒就让用户看见
   * 「有东西正在被推进来」—— 换画 feature 原先要到第 11.5 秒才露面，
   * 这中间没有任何理由让人留下。
   */
  delivery: 7.0,
```

- [ ] **Step 2: 状态机加 delivery 拍**

`components/Hero/useHeroSequence.ts`，`HeroBeats` 接口加一项：

```ts
export interface HeroBeats {
  title: boolean;
  subtitle: boolean;
  /** 画芯开始滑入（去饱和、不可交互）。落定由 steps.plaque 接手 */
  delivery: boolean;
}
```

初始状态改为：

```ts
  const [beats, setBeats] = useState<HeroBeats>({
    title: false,
    subtitle: false,
    delivery: false,
  });
```

`runFreezeSequence` 里把 `setBeats({ title: true, subtitle: true });` 改为：

```ts
    setBeats({ title: true, subtitle: true, delivery: true });
```

`onTime` 整体替换为：

```ts
    const onTime = () => {
      const t = v.currentTime;
      setBeats((b) => {
        const title = b.title || t >= HERO_TIMINGS.title;
        const subtitle = b.subtitle || t >= HERO_TIMINGS.subtitle;
        const delivery = b.delivery || t >= HERO_TIMINGS.delivery;
        return title === b.title &&
          subtitle === b.subtitle &&
          delivery === b.delivery
          ? b
          : { title, subtitle, delivery };
      });
    };
```

静态模式 effect 里的 `setBeats({ title: true, subtitle: false });` 改为：

```ts
      setBeats({ title: true, subtitle: false, delivery: true });
```

- [ ] **Step 3: ArtworkSwitcher 接受 delivering**

`components/Hero/ArtworkSwitcher.tsx`，`Props` 加一项：

```tsx
  /** 送货中：画芯已在场但还没落定 —— 去饱和、不可点 */
  delivering: boolean;
```

函数签名：

```tsx
export default function ArtworkSwitcher({
  rect,
  active,
  revealed,
  loadArt,
  delivering,
}: Props) {
```

rack 的 className 从：

```tsx
        className={`${styles.rack} ${revealed ? styles.rackOn : ""}`}
```

改成：

```tsx
        className={[
          styles.rack,
          delivering && !revealed ? styles.rackDelivering : "",
          revealed ? styles.rackOn : "",
        ].join(" ")}
```

- [ ] **Step 4: 写送货态样式**

`components/Hero/ArtworkSwitcher.module.css`，在 `.rackOn { pointer-events: auto; }` 之后插入：

```css
/* ---------- 送货态：画芯在场，但还没落定 ----------
   从舞台左缘推进来（推手在画面外），去饱和 + 没有落地阴影。
   读作「还在被搬运」而不是「坏了/禁用」—— 关键是它在动，
   动着的东西没人会去点。落定那一下才上色、投影、可交互。
   第 6 张留空位给猫推（见 CatDelivery）。 */

.rackDelivering .mini {
  filter: saturate(0.22) brightness(0.86);
  animation: miniSlideIn 760ms var(--ease-out) calc(var(--i) * 130ms) both;
}

/* 起点在舞台左缘之外：--rack-left 是画芯架距舞台左边的距离，
   取负再多退两个画芯宽度就完全出画。 */
@keyframes miniSlideIn {
  from {
    opacity: 0;
    translate: calc(-1 * var(--rack-left) - var(--mini-w) * 2) 0;
  }
  to {
    opacity: 1;
    translate: 0 0;
  }
}

.rackDelivering .mini::after {
  opacity: 0; /* 还没落地，就没有落地阴影 */
}

/* 第 6 张不在送货批次里 —— 它由猫推进来 */
.rackDelivering .mini:nth-child(6) {
  animation: none;
  opacity: 0;
}
```

- [ ] **Step 5: 落定时解除去饱和**

同一文件，把 `.rackOn .mini` 改为：

```css
.rackOn .mini {
  opacity: 1;
  translate: 0 0;
  filter: none;
  animation: none;
}
```

并给 `.mini` 的 `transition` 加上 filter（找到 `.mini` 规则里的 transition 块，整体替换）：

```css
  transition:
    opacity 560ms var(--ease-out) calc(var(--i) * 95ms + 80ms),
    translate 620ms var(--ease-soft) calc(var(--i) * 95ms + 80ms),
    filter 620ms var(--ease-out),
    transform 220ms var(--ease-soft) 0s;
```

- [ ] **Step 6: reduced-motion 下直接落定**

同一文件，`@media (prefers-reduced-motion: reduce)` 块内加：

```css
  .rackDelivering .mini {
    animation: none;
    opacity: 1;
    translate: 0 0;
    filter: none;
  }
  .rackDelivering .mini:nth-child(6) {
    opacity: 1;
  }
```

- [ ] **Step 7: Hero 传 delivering**

`components/Hero/Hero.tsx`，`<ArtworkSwitcher>` 加一个 prop：

```tsx
          <ArtworkSwitcher
            rect={rect}
            active={frozen}
            revealed={steps.plaque}
            loadArt={loadArt}
            delivering={beats.delivery}
          />
```

- [ ] **Step 8: 类型检查**

```bash
npx tsc --noEmit
```

Expected：无报错。

- [ ] **Step 9: 验证 7 秒的送货态**

重载页面后跳到第 7.5 秒并截图：

```js
(async () => {
  const v = document.querySelector('video');
  v.currentTime = 7.5;
  await new Promise(r => setTimeout(r, 1200));
  const minis = document.querySelectorAll('[role="radiogroup"] button');
  return {
    count: minis.length,
    first: minis[0] ? {
      opacity: getComputedStyle(minis[0]).opacity,
      filter: getComputedStyle(minis[0]).filter,
    } : null,
    sixth: minis[5] ? getComputedStyle(minis[5]).opacity : null,
  };
})()
```

Expected：`count: 6`；`first.opacity` 为 `1`、`first.filter` 含 `saturate(0.22)`；`sixth` 为 `0`（第 6 张留给猫）。

然后 `computer({action: "screenshot"})`。

Expected：画框左侧墙脚有 5 张明显去饱和的画芯靠着，读起来像"还没摆好的东西"，不像坏掉或灰掉的 UI。**若看起来像 disabled 报错态，调 `saturate` / `brightness` 直到读感对为止** —— 判据见 spec，宁可欠一点。

- [ ] **Step 10: 验证不可点**

在送货态下尝试点第一张画芯，然后确认画框里的画没变：

```js
(async () => {
  const v = document.querySelector('video');
  v.currentTime = 7.5;
  await new Promise(r => setTimeout(r, 900));
  const rack = document.querySelector('[role="radiogroup"]');
  const pe = getComputedStyle(rack).pointerEvents;
  const before = document.querySelector('[role="radiogroup"] button[aria-checked="true"]')?.getAttribute('aria-label');
  rack.querySelectorAll('button')[2]?.click();
  await new Promise(r => setTimeout(r, 500));
  const after = document.querySelector('[role="radiogroup"] button[aria-checked="true"]')?.getAttribute('aria-label');
  return { pointerEvents: pe, before, after, changed: before !== after };
})()
```

Expected：`pointerEvents: "none"`、`changed: false`。

- [ ] **Step 11: 验证落定后可点**

等视频播完定格后（或点 SkipDial），确认 rack 恢复彩色且可点：

```js
(() => {
  const minis = document.querySelectorAll('[role="radiogroup"] button');
  return {
    filter: getComputedStyle(minis[0]).filter,
    pointerEvents: getComputedStyle(minis[0].parentElement).pointerEvents,
    sixthOpacity: getComputedStyle(minis[5]).opacity,
  };
})()
```

Expected：`filter: "none"`、`pointerEvents: "auto"`、`sixthOpacity: "1"`。

- [ ] **Step 12: Commit**

```bash
git add lib/heroConfig.ts components/Hero/useHeroSequence.ts components/Hero/ArtworkSwitcher.tsx components/Hero/ArtworkSwitcher.module.css components/Hero/Hero.tsx
git commit -m "画芯提前 4 秒进场：送货态

换画 feature 原先要到第 11.5 秒才露面，这中间没有任何理由让人
留下。现在第 7 秒画芯就从舞台左缘推进来 —— 去饱和、无落地阴影、
不可点。关键是它在动：动着的东西没人会去点，也就不需要任何
disabled 态的说明。第 6 张留空位给猫。"
```

---

### Task 7: CatDelivery —— 猫推最后一张进来

定格后猫从左缘柜子后探出，把第 6 张推到位。猫的登场是 payoff 而非铺垫 —— 这也是它必须在定格后才出现的原因：视频里那只写实的猫全程在动，两只黑白猫同框会打架。

**Files:**
- Create: `components/Hero/CatDelivery.tsx`
- Create: `components/Hero/CatDelivery.module.css`
- Modify: `lib/heroConfig.ts`
- Modify: `components/Hero/ArtworkSwitcher.module.css`
- Modify: `components/Hero/Hero.tsx`

**Interfaces:**
- Consumes: `useVideoRect` 的 `ContentRect`；Task 6 的 rack 送货态
- Produces: `CatDelivery` props `{ rect: ContentRect; play: boolean }`

- [ ] **Step 1: 重排定格时间轴**

`lib/heroConfig.ts`，把 `freeze` 块替换为：

```ts
  // 定格后的错峰浮现（相对 onEnded 的毫秒数）
  freeze: {
    settle: 0, // 文字轻轻上移收拢
    cta: 550, // CTA 上浮 —— 与猫推货并行，不排队
    plaque: 1000, // 猫推到位 → 画芯落定 + 铭牌浮现 + 可交互
    scrollCue: 1500, // 页脚滚动提示，最轻的一笔
  },
```

同一文件，在 `delivery` 之后加猫的动画时长：

```ts
  /** 猫从画外推到位的时长（毫秒）。必须与 freeze.plaque 对齐 ——
   *  猫推到的那一刻正是画芯落定的那一刻。 */
  catPushMs: 1000,
```

`dialMs` 的注释里提到过它等于视频时长加 `freeze.plaque`，现在 plaque 从 1500 变 1000，把 `dialMs` 从 `11000` 改为：

```ts
  dialMs: 11000, // 10s 视频 + freeze.plaque(1000)
```

（数值不变，补上算式说明。）

- [ ] **Step 2: 写 CatDelivery 组件**

`components/Hero/CatDelivery.tsx`：

```tsx
"use client";

import Image from "next/image";
import { HERO_TIMINGS } from "@/lib/heroConfig";
import type { ContentRect } from "./useVideoRect";
import styles from "./CatDelivery.module.css";

interface Props {
  rect: ContentRect; // 视频内容矩形（px，相对舞台）
  /** false → true 时播一次进场→推到位→退场，此后不再响应 */
  play: boolean;
}

/**
 * 猫把最后一张画芯推到墙边。
 *
 * 为什么在定格后才出现：视频里那只猫全程在动（走进 → 抓画 → 坐下），
 * 若插画猫同时出场，画面里会有两只黑白猫。所以货先行、猫后到 ——
 * 前 5 张自己滑进来（推手在画外，悬念更足），猫留到定格后登场，
 * 成为 payoff 而不是铺垫。
 *
 * 猫的行进与 rack 第 6 张的滑入是两条独立动画，靠同一个时长
 * (HERO_TIMINGS.catPushMs) 对齐，看起来就是猫在推它。
 */
export default function CatDelivery({ rect, play }: Props) {
  if (!play) return null;

  // 猫立在墙脚线上（与画芯架同一条地面），身宽约画面的 14%
  const catW = rect.width * 0.14;
  const vars = {
    "--cat-w": `${catW}px`,
    "--cat-bottom-y": `${rect.top + rect.height * 0.708}px`,
    "--cat-end-x": `${rect.left + rect.width * 0.129 - catW * 0.62}px`,
    "--cat-dur": `${HERO_TIMINGS.catPushMs}ms`,
  } as React.CSSProperties;

  return (
    <div className={styles.cat} style={vars} aria-hidden>
      <Image
        src="/interaction/roomie-pushing-cat.png"
        alt=""
        width={720}
        height={405}
        priority={false}
      />
    </div>
  );
}
```

- [ ] **Step 3: 写 CatDelivery 样式**

`components/Hero/CatDelivery.module.css`：

```css
/* 猫从舞台左缘外进来，推到画芯架位置，停一拍，退回画外。
   进 + 停 + 退共 --cat-dur * 2.1，但「推到位」发生在 --cat-dur，
   与 rack 第 6 张的落位同刻。 */

.cat {
  position: absolute;
  z-index: 6;
  left: 0;
  top: calc(var(--cat-bottom-y) - var(--cat-w) * 0.5625);
  width: var(--cat-w);
  pointer-events: none;
  animation: catPush calc(var(--cat-dur) * 2.1) var(--ease-out) both;
}

.cat img {
  display: block;
  width: 100%;
  height: auto;
  /* 手绘猫叠在写实画面上，压一点对比并给个落地阴影，
     免得像贴纸浮在半空 */
  filter: drop-shadow(0 6px 10px rgba(60, 36, 12, 0.34)) saturate(0.92);
}

@keyframes catPush {
  /* 出画外 */
  0% {
    transform: translateX(calc(-1 * var(--cat-w) * 1.3));
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  /* 推到位 —— 与 rack 第 6 张落位同刻 */
  47.6% {
    transform: translateX(var(--cat-end-x));
    opacity: 1;
  }
  /* 停一拍，看一眼自己的成果 */
  66% {
    transform: translateX(var(--cat-end-x));
    opacity: 1;
  }
  /* 退回画外 */
  95% {
    opacity: 1;
  }
  100% {
    transform: translateX(calc(-1 * var(--cat-w) * 1.3));
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .cat {
    display: none;
  }
}
```

- [ ] **Step 4: 把猫的推货时长喂给 CSS**

第 6 张画芯的滑入必须和猫的行进同时长，否则猫和它推的画会脱节。CSS 读不到 JS 常量，所以**用自定义属性传下去**，而不是在两处各写一个 1000ms —— 那种手动对齐迟早失步。

`components/Hero/ArtworkSwitcher.tsx`，把 heroConfig 的 import 加上 `HERO_TIMINGS`：

```tsx
import { ARTWORKS, FRAME_RECT, HERO_COPY, HERO_TIMINGS } from "@/lib/heroConfig";
```

在 `rackVars` 里加一项：

```tsx
  const rackVars = {
    "--mini-w": px(miniW),
    "--rack-left": px(rect.left + rect.width * 0.129),
    "--rack-bottom-y": px(rect.top + rect.height * 0.708),
    "--rack-m-left": px(fLeft + 2),
    "--rack-m-top": px(fTop + fH + rect.height * 0.03),
    // 第 6 张由猫推进来，时长必须与 CatDelivery 一致 —— 单一来源
    "--push-dur": `${HERO_TIMINGS.catPushMs}ms`,
  } as React.CSSProperties;
```

- [ ] **Step 5: 第 6 张画芯的推入动画**

`components/Hero/ArtworkSwitcher.module.css`，在 `.rackOn .mini { ... }` 规则**之后**加：

```css
/* 第 6 张不走常规错峰 —— 它是被猫推进来的。
   --push-dur 由组件从 HERO_TIMINGS.catPushMs 传入，
   与 CatDelivery 的行进同一个来源，不会失步。 */
.rackOn .mini:nth-child(6) {
  animation: miniPushedIn var(--push-dur) var(--ease-out) both;
}

@keyframes miniPushedIn {
  from {
    opacity: 0;
    translate: calc(-1 * var(--rack-left) - var(--mini-w) * 2) 0;
  }
  to {
    opacity: 1;
    translate: 0 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .rackOn .mini:nth-child(6) {
    animation: none;
  }
}
```

- [ ] **Step 6: 挂进 Hero**

`components/Hero/Hero.tsx`，import 区加：

```tsx
import CatDelivery from "./CatDelivery";
```

在 JSX 里 `{rect && (<ArtworkSwitcher ... />)}` 之后加：

```tsx
        {/* 猫推最后一张进来。只在视频路径下播 —— 静图上没有铺垫，
            凭空来只猫推货会很突兀。 */}
        {rect && staticMode === false && (
          <CatDelivery rect={rect} play={frozen} />
        )}
```

- [ ] **Step 7: 类型检查**

```bash
npx tsc --noEmit
```

Expected：无报错。

- [ ] **Step 8: 验证猫在定格后登场**

重载页面，跳到视频末尾触发定格，然后在猫行进中截图：

```js
(async () => {
  const v = document.querySelector('video');
  v.currentTime = v.duration - 0.2;
  await new Promise(r => setTimeout(r, 900));
  return 'ready';
})()
```

紧接着 `computer({action: "screenshot"})`。

Expected：画面左侧有一只手绘黑白猫正推着第 6 张画芯向画芯架移动；视频里那只写实的猫坐在画框右侧不动。两只猫空间上分开，不重叠。

- [ ] **Step 9: 验证落定后猫已退场**

再等 1.5 秒后截图。

Expected：猫已退出画面，6 张画芯彩色齐整靠墙，吊牌浮现。

- [ ] **Step 10: 验证不与视频里的猫同框**

```js
(async () => {
  const v = document.querySelector('video');
  v.currentTime = 6;
  await new Promise(r => setTimeout(r, 600));
  return { catLayerPresent: !!document.querySelector('img[src*="roomie-pushing-cat"][alt=""]') };
})()
```

注意 CTA 里也有一张同名图，需按 DOM 位置区分。更可靠的做法：

```js
(async () => {
  const v = document.querySelector('video');
  v.currentTime = 6;
  await new Promise(r => setTimeout(r, 600));
  const stage = document.querySelector('section[aria-label="The Canvas Scratcher"] > div');
  const imgs = [...stage.querySelectorAll('img')].map(i => i.getAttribute('src'));
  return { stageImgs: imgs };
})()
```

Expected：`stageImgs` 里**没有** `roomie-pushing-cat` —— 视频播放中舞台层不该有猫。

- [ ] **Step 11: 验证 reduced-motion 下猫不播**

```js
// 无法在页面里改 media query，改用 CSS 检查规则是否生效
matchMedia('(prefers-reduced-motion: reduce)').matches
```

若为 false，用浏览器工具的 `resize_window({colorScheme: ...})` 无法改 reduced-motion。改为直接核对样式表里存在 `@media (prefers-reduced-motion: reduce) { .cat { display: none } }`：

```bash
grep -A2 "prefers-reduced-motion" components/Hero/CatDelivery.module.css
```

Expected：输出包含 `display: none`。

- [ ] **Step 12: 验证移动端不挂载**

`resize_window({preset: "mobile"})` 后重载：

```js
(() => {
  const stage = document.querySelector('section[aria-label="The Canvas Scratcher"] > div');
  return { hasCat: !!stage.querySelector('img[src*="roomie-pushing-cat"]') };
})()
```

Expected：`hasCat: false`。

改回 `resize_window({preset: "desktop"})`。

- [ ] **Step 13: 完整走一遍时间轴**

重载页面，什么都不做，从头看到尾，在 7.5s / 10.5s / 12s 各截一张。

Expected：
- 7.5s — 5 张去饱和画芯靠墙，环走到约 68%
- 10.5s — 猫推第 6 张进来，CTA 已浮现
- 12s — 画芯全彩齐整、吊牌在、滚动提示在、环已消失、可换画

- [ ] **Step 14: Commit**

```bash
git add components/Hero/CatDelivery.tsx components/Hero/CatDelivery.module.css lib/heroConfig.ts components/Hero/ArtworkSwitcher.tsx components/Hero/ArtworkSwitcher.module.css components/Hero/Hero.tsx
git commit -m "猫推最后一张进来

复用 CTA 里已有的 roomie-pushing-cat —— 猫推画等于换画，这个
视觉语汇全站已经建立。猫留到定格后登场：视频里那只写实的猫全程
在动，两只黑白猫同框会打架，所以货先行、猫后到，猫的出场是
payoff 而不是铺垫。

定格时间轴同时压紧：cta 680→550、plaque 1500→1000、
cue 2300→1500，演出总长 12.3s → 11.5s。"
```

---

### Task 8: 收尾核对与文档

**Files:**
- Modify: `docs/HANDOVER.md`
- Modify: `components/Hero/Hero.tsx`（顶部备忘）

- [ ] **Step 1: 生产构建通过**

```bash
BUILD_DIR=.next-build npm run build
```

Expected：构建成功，无类型错误、无 lint 错误。

（用 `BUILD_DIR` 隔离，避免覆盖 dev 的 `.next` 缓存 —— 见 next.config.ts 的注释。）

- [ ] **Step 2: 核对首屏体积收益**

重载页面后：

```js
(() => {
  const hero = performance.getEntriesByType('resource')
    .filter(r => r.name.includes('/hero/') || r.name.includes('roomie-pushing-cat'));
  const total = hero.reduce((s, r) => s + (r.encodedBodySize || 0), 0);
  return {
    count: hero.length,
    totalMB: (total / 1048576).toFixed(2),
    largest: hero.map(r => ({
      f: r.name.split('/').pop(),
      kb: Math.round((r.encodedBodySize || 0) / 1024),
      startMs: Math.round(r.startTime),
    })).sort((a, b) => b.kb - a.kb).slice(0, 6),
  };
})()
```

Expected：`totalMB` 在 3 以内（改动前约 14）；`largest` 里视频的 `startMs` 早于全部 art 文件。

- [ ] **Step 3: 更新 Hero.tsx 顶部备忘**

`components/Hero/Hero.tsx`，在顶部注释块的第 3 条之后加一条：

```
 *   4. 时间轴状态机已抽进 useHeroSequence()，Carousel 化时每屏
 *      各自持有一个实例即可；SkipDial / CatDelivery 只服务第 1 屏。
```

- [ ] **Step 4: 更新 HANDOVER**

`docs/HANDOVER.md` 里追加一节（放在文件末尾）：

```markdown
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

调时间轴只改 `lib/heroConfig.ts` 的 `HERO_TIMINGS`。两条必须手动
维持的等式：`dialMs` = 视频时长 + `freeze.plaque`；`catPushMs` =
`freeze.plaque`。（CSS 侧不需要跟着改 —— `--push-dur` 与
`--cat-dur` 都由组件从 `catPushMs` 传入。）

资产重压：`bash tools/compress_hero_media.sh [CRF]`。源是
`assets/hero/cat-scratcher-10s.master.mp4`（不在 public/ 下，
不部署）与 `public/hero/art/art-0X.png`，两者都留在仓库里，
脚本可反复重跑。
```

- [ ] **Step 5: Commit**

```bash
git add docs/HANDOVER.md components/Hero/Hero.tsx
git commit -m "Hero 首屏改动的交接说明

记下三个必须同步的常量关系：dialMs = 视频时长 + freeze.plaque，
catPushMs = freeze.plaque。改时间轴时最容易在这里失步。"
```

---

## 自查记录

**Spec 覆盖**：第一节时间轴 → Task 2/5/6/7；SkipDial → Task 5；第二节性能 → Task 1/3；第三节组件结构 → Task 4/5/6/7；第四节降级与边界（reduced-motion / 移动端 / autoplay 拒绝 / 8 秒超时 / skip 重入）→ Task 2 Step 3、Task 5 Step 2+9+10、Task 6 Step 6、Task 7 Step 10+11；第五节五条验证 → 分散在各任务的验收步骤，Task 8 Step 2 做总核对。

**类型一致性**：`FreezeSteps` 在 Task 4 定义于 `useHeroSequence.ts`，`Hero.tsx` 转发导出以免 `HeroCopy.tsx` 断链（Task 4 Step 2/3）。`HeroBeats` 在 Task 6 加 `delivery`，三处 `setBeats` 全量赋值处同步更新（Step 2）。`ArtworkSwitcher` 的 props 分两次增补：`loadArt`（Task 1）、`delivering`（Task 6），两次都改了函数签名与调用点。

**常量耦合**（最易失步处，已写进 HANDOVER）：`dialMs` = 视频时长 + `freeze.plaque`；`catPushMs` = `freeze.plaque`。这两条是 JS 内部的，只能靠注释与 HANDOVER 守住。

CSS 侧不设第二份真值：猫的行进（`--cat-dur`）与第 6 张画芯的滑入（`--push-dur`）都由组件从 `HERO_TIMINGS.catPushMs` 传成自定义属性。初稿在两处各写了一个 1000ms 手动对齐，那种写法迟早失步，已改掉。

**预检修正**（执行前发现的三处计划自身问题，已改）：① 压制脚本原先从 `/tmp` 备份读源，tmp 一清就再也压不了第二次 —— 改为视频母版移到 `assets/hero/`（不部署但留仓库）、画作 PNG 原地保留作 JPEG 的源；② 原先要删掉 art PNG，那会切断可重复生成路径，且对用户下载量毫无影响（浏览器本就不请求它们）—— 改为保留并验证浏览器不再请求；③ 上述 CSS 常量重复。
