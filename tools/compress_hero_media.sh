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
