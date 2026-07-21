#!/usr/bin/env python3
"""
flat-0X.png（1400×2000 全尺寸，合成管线输入）→ flat-0X-s.jpg（420×600 缩略）。

站点三处小尺寸场景（hero 备用画芯堆 / 购物车行缩略图 / 邮件 itemThumb）
共用 -s.jpg：最大显示 ~130px @2x ≈ 260 物理像素，420 宽留足余量；
用 jpg 不用 webp 是因为邮件端（Outlook 桌面版）不认 webp。
上新画作时在 extract_flats.py 之后跑一次本脚本。
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / "public" / "hero" / "art"

for i in range(1, 7):
    src = ART / f"flat-0{i}.png"
    if not src.exists():
        print(f"skip flat-0{i}: missing")
        continue
    im = Image.open(src).convert("RGB").resize((420, 600), Image.LANCZOS)
    out = ART / f"flat-0{i}-s.jpg"
    im.save(out, quality=85, optimize=True, progressive=True)
    print(f"{out.name}: {out.stat().st_size // 1024}KB")
