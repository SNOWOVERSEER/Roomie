#!/usr/bin/env bash
# Hero 首屏资产压制。原始素材体积是首屏最大的负担：
#   视频 6.7MB（1664x1248 / 5.4Mbps）+ 6 张画 7.1MB = 13.8MB
# 目标：视频 ~2.1MB，画作合计 ~1.5MB。
#
# 视频保持原生 1664x1248，不做 scale：这是满屏 hero，`object-fit: cover`
# 在 1440 视口下的内容矩形约 1440x1080，比 1280 还宽 —— 降到 1280 编码
# 等于在常见桌面尺寸下被放大着看。更致命的是，降采样会把画布的织物
# 纹理磨平（天空的编织颗粒、油彩笔触、猫须的独根细节），而纹理正是
# 这个商品的卖点：一幅"看起来是真画"的猫抓布，纹理没了就成了印刷品。
# 实测对比 1280x960/CRF27（纹理被抹平）、1440x1080/CRF23（略软、更大）、
# 原生 1664x1248/CRF26（纹理最完整，2.12MB）—— 取最后一档。
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
# 只出 H.264，不出 WebM：VP9 在同样 CRF 下压出来是 1.96MB，比 H.264
# 的 1.01MB 还大，而 WebM 是 <source> 里的第一条，等于让 Chrome（多数
# 用户）多下将近 1MB。要让 VP9 反超 H.264 得单独跑一轮 CRF 扫描并肉眼
# 复核，换来的是两份编码永久维护——对一条 10 秒的 hero 视频不值。
#
# 用法：bash tools/compress_hero_media.sh [CRF] [JPEG_Q]
# CRF 默认 26（越小越清晰）；JPEG_Q 默认 2（ffmpeg 的 -q:v，2 最好、31 最差）。
# 改完必须肉眼比对 —— 这是画作商品页，画质是产品本身。
set -euo pipefail
cd "$(dirname "$0")/.."

CRF="${1:-26}"
JPEG_Q="${2:-2}"
SRC=assets/hero/cat-scratcher-10s.master.mp4

if [ ! -f "$SRC" ]; then
  echo "找不到视频母版 $SRC" >&2
  echo "它应当在仓库里。若被误删，从 git 历史恢复：" >&2
  echo "  git log --all --oneline -- '*cat-scratcher-10s*'" >&2
  exit 1
fi

echo "== H.264 (CRF $CRF, 原生分辨率) =="
ffmpeg -v error -y -i "$SRC" \
  -c:v libx264 -crf "$CRF" -preset slow \
  -profile:v high -pix_fmt yuv420p -movflags +faststart -an \
  public/hero/cat-scratcher-10s.mp4

echo "== 画作转 JPEG (q=$JPEG_Q) =="
for i in 1 2 3 4 5 6; do
  ffmpeg -v error -y -i "public/hero/art/art-0$i.png" \
    -q:v "$JPEG_Q" "public/hero/art/art-0$i.jpg"
done

echo
echo "== 结果 =="
ls -la public/hero/cat-scratcher-10s.mp4
ls -la public/hero/art/art-0*.jpg
