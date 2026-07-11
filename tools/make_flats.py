"""Flat (un-warped) versions of the four prints, for UI thumbnails/selectors."""
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import importlib.util, sys

# reuse drawing code from make_artworks by re-executing its art blocks is messy;
# draw flats directly here with the same palette + a soft paper grain.
NAVY = (2, 37, 85); ORANGE = (196, 113, 15); RED = (170, 49, 6)
CREAM = (224, 206, 192); INK = (8, 22, 48)
S = 2; FW, FH = 700 * S, 1000 * S

def pt(x, y): return (x * S, y * S)

def canvas(color): return Image.new('RGB', (FW, FH), color)

def bezier(p0, p1, p2, n=32):
    return [((1-t)**2*p0[0] + 2*(1-t)*t*p1[0] + t**2*p2[0],
             (1-t)**2*p0[1] + 2*(1-t)*t*p1[1] + t**2*p2[1]) for t in (i/n for i in range(n+1))]

def tiny_house(d, cx, base_y, w=110):
    h = int(w * 0.62); x0, x1 = cx - w//2, cx + w//2
    d.polygon([pt(x0, base_y), pt(x1, base_y), pt(x1, base_y-h), pt(x0, base_y-h)], fill=CREAM)
    d.polygon([pt(x0-w*0.12, base_y-h), pt(x1+w*0.12, base_y-h), pt(cx, base_y-h-w*0.42)], fill=CREAM)
    lw = max(3*S, int(w*0.055)*S)
    d.line([pt(x0-w*0.14, base_y-h), pt(cx, base_y-h-w*0.44)], fill=RED, width=lw)
    d.line([pt(cx, base_y-h-w*0.44), pt(x1+w*0.14, base_y-h)], fill=RED, width=lw)
    d.line([pt(x0, base_y), pt(x1, base_y)], fill=RED, width=lw)
    ww = int(w*0.28); wx, wy = cx-ww//2, base_y-h+int(h*0.18)
    d.rectangle([pt(wx, wy), pt(wx+ww, wy+ww)], fill=ORANGE, outline=INK, width=2*S)
    d.line([pt(wx+ww/2, wy), pt(wx+ww/2, wy+ww)], fill=INK, width=2*S)
    d.line([pt(wx, wy+ww/2), pt(wx+ww, wy+ww/2)], fill=INK, width=2*S)

def grain(img):
    rng = np.random.default_rng(7)
    a = np.asarray(img).astype(float)
    n = rng.normal(0, 5.5, a.shape[:2])[..., None]
    n = np.asarray(Image.fromarray(np.clip(n[...,0]*8+128,0,255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))).astype(float)[...,None]
    a = a * (1 + (n-128)/128*0.10)
    return Image.fromarray(np.clip(a,0,255).astype(np.uint8))

# 01 晴野
a = canvas(NAVY); d = ImageDraw.Draw(a)
d.rectangle([pt(0,560), pt(700,1000)], fill=ORANGE)
d.ellipse([pt(115,105), pt(275,265)], fill=RED)
tiny_house(d, 430, 592, w=160)
flat1 = a

# 02 月夜
a = canvas(NAVY); d = ImageDraw.Draw(a)
d.ellipse([pt(375,135), pt(585,345)], fill=CREAM)
for sx, sy, sr in ((150,150,9),(240,380,7),(580,430,8),(100,480,6)):
    d.polygon([pt(sx,sy-sr),pt(sx+sr,sy),pt(sx,sy+sr),pt(sx-sr,sy)], fill=CREAM)
d.polygon([pt(0,1000), pt(700,1000), pt(700,740)] +
          [pt(x, 740-55*np.sin(np.pi*(x/700)*0.9+0.2)) for x in range(700,-1,-20)], fill=INK)
tiny_house(d, 560, 705, w=95)
cx, cy = 250, 690
d.ellipse([pt(cx-52,cy-95), pt(cx+52,cy)], fill=ORANGE)
d.ellipse([pt(cx-34,cy-148), pt(cx+34,cy-82)], fill=ORANGE)
d.polygon([pt(cx-30,cy-138), pt(cx-34,cy-172), pt(cx-8,cy-148)], fill=ORANGE)
d.polygon([pt(cx+30,cy-138), pt(cx+34,cy-172), pt(cx+8,cy-148)], fill=ORANGE)
tail = bezier((cx+46,cy-20),(cx+110,cy-10),(cx+104,cy-92))
d.line([pt(x,y) for x,y in tail], fill=ORANGE, width=16*S, joint='curve')
flat2 = a

# 03 波光
a = canvas(CREAM); d = ImageDraw.Draw(a)
d.ellipse([pt(455,105), pt(615,265)], fill=RED)
d.rectangle([pt(0,600), pt(700,1000)], fill=NAVY)
for i, wx in enumerate(range(-20, 740, 96)):
    rr = 34 if i % 2 == 0 else 26
    d.ellipse([pt(wx-rr,600-rr), pt(wx+rr,600+rr)], fill=NAVY)
for wy in (700, 800):
    for wx in range(-20, 740, 96):
        d.arc([pt(wx-34,wy-20), pt(wx+34,wy+20)], 200, 340, fill=CREAM, width=5*S)
bx, by = 300, 585
d.polygon([pt(bx-85,by), pt(bx+85,by), pt(bx+55,by+46), pt(bx-55,by+46)], fill=ORANGE)
d.line([pt(bx,by-8), pt(bx,by-150)], fill=INK, width=6*S)
d.polygon([pt(bx+6,by-148), pt(bx+96,by-16), pt(bx+6,by-16)], fill=CREAM)
d.polygon([pt(bx-6,by-128), pt(bx-78,by-16), pt(bx-6,by-16)], fill=CREAM)
d.line([pt(bx-78,by-16), pt(bx+96,by-16)], fill=RED, width=5*S)
flat3 = a

# 04 森光
a = canvas(ORANGE); d = ImageDraw.Draw(a)
d.ellipse([pt(160,320), pt(300,460)], fill=RED)
d.polygon([pt(0,1000), pt(700,1000), pt(700,690)] +
          [pt(x, 690-30*np.sin(np.pi*x/700+0.6)) for x in range(700,-1,-25)], fill=NAVY)
def fir(cx, base_y, w, h):
    d.polygon([pt(cx-w*0.5,base_y), pt(cx+w*0.5,base_y), pt(cx,base_y-h*0.62)], fill=NAVY)
    d.polygon([pt(cx-w*0.38,base_y-h*0.34), pt(cx+w*0.38,base_y-h*0.34), pt(cx,base_y-h)], fill=NAVY)
fir(120,700,200,330); fir(590,690,230,420); fir(455,672,150,250)
tiny_house(d, 300, 680, w=120)
flat4 = a

import os
import pathlib
ART = str(pathlib.Path(__file__).parent.parent / 'public' / 'hero' / 'art')
os.makedirs(ART, exist_ok=True)
for i, f in enumerate((flat1, flat2, flat3, flat4), 1):
    grain(f).resize((350, 500), Image.LANCZOS).save(f'{ART}/flat-0{i}.png')
print('flats written')
