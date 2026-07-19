"""
Roomie hero artwork pipeline — matte (绿幕) edition.

原理：把视频末帧里「画布的真实像素区域」按颜色键出来得到逐像素蒙版，
新画作经透视变形 + 光照/纹理匹配后，只在蒙版内部合成 —— 蒙版之外
保持末帧原像素。几何拟合的小误差不再可能溢出到木框上。

产出：
  public/hero/art/art-0X.png   （末帧画框区域的完整合成图）
  lib/frame-rect.json          （画框外接矩形百分比，heroConfig 自动引用）
  tools/matte.png / edges_check.png（人工复核用）
"""
import json
import pathlib
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SP = str(pathlib.Path(__file__).parent)
ROOT = pathlib.Path(__file__).parent.parent
OUT = str(ROOT / 'public' / 'hero' / 'art')

W, H = 1664, 1248
CALIB = np.array([2.53, 0.23, -0.32])  # 浏览器视频解码色彩校正

img = Image.open(SP + '/last-frame.png').convert('RGB')
full = np.asarray(img).astype(float)

# ---------------- 1. 颜色键出画布蒙版（在画框邻域窗口内） ----------------
WIN = (355, 395, 715, 925)  # x0,y0,x1,y1 搜索窗口（避开右侧猫须与下方地毯）
r, g, b = full[..., 0], full[..., 1], full[..., 2]

# 蒙版键色用「比例判据」，深阴影中依然成立：
# 画布橙 g/r≈0.35-0.68 且 b/r<0.42（暗木框 g/r≈0.7-0.85、b/r≈0.5-0.65 不命中）
navy = (b > r + 20) & (b > 35) & (g < b * 1.15)
Lfull = 0.299 * r + 0.587 * g + 0.114 * b
# 亮区宽松；暗区（L<70）收紧 —— 深阴影中的木头 g/r≈0.62-0.7 会向橙色靠拢
orange_lit = (Lfull >= 70) & (r > 55) & (g > r * 0.30) & (g < r * 0.62) & (b < r * 0.36)
orange_dark = (Lfull < 70) & (r > 45) & (g < r * 0.60) & (b < r * 0.30)
orange = orange_lit | orange_dark
red = (r > 90) & (g < r * 0.45) & (b < r * 0.40)
white = (r > 170) & (g > 155) & (b > 140) & ((r - b) < 62)

key = navy | orange | red | white
win = np.zeros((H, W), bool)
win[WIN[1]:WIN[3], WIN[0]:WIN[2]] = True
key &= win

# 形态学开运算：掐断猫须/杂点等细连接
key_im = Image.fromarray((key * 255).astype(np.uint8))
key_open = np.asarray(key_im.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))) > 128

# 大块连通域之并集 = 画布本体（天空与田野被地平线暗带隔开，各自成块）
def components_over(mask, min_px):
    from collections import deque
    seen = np.zeros(mask.shape, bool)
    out = np.zeros(mask.shape, bool)
    ys, xs = np.where(mask)
    for y0, x0 in zip(ys.tolist(), xs.tolist()):
        if seen[y0, x0]:
            continue
        q = deque([(y0, x0)])
        seen[y0, x0] = True
        cells = []
        while q:
            y, x = q.popleft()
            cells.append((y, x))
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                yy, xx = y + dy, x + dx
                if 0 <= yy < mask.shape[0] and 0 <= xx < mask.shape[1] \
                        and mask[yy, xx] and not seen[yy, xx]:
                    seen[yy, xx] = True
                    q.append((yy, xx))
        if len(cells) >= min_px:
            yy, xx = zip(*cells)
            out[list(yy), list(xx)] = True
            print('  component kept: %d px' % len(cells))
    return out

body = components_over(key_open, 15000)

# 行/列跨度填充（画布是凸四边形）：补上房子/太阳/阴影角等内部空洞
def span_fill(mask, axis, min_count=8):
    out = np.zeros_like(mask)
    if axis == 0:
        for y in range(mask.shape[0]):
            xs2 = np.where(mask[y])[0]
            if len(xs2) >= min_count:
                out[y, xs2.min():xs2.max() + 1] = True
    else:
        for x in range(mask.shape[1]):
            ys2 = np.where(mask[:, x])[0]
            if len(ys2) >= min_count:
                out[ys2.min():ys2.max() + 1, x] = True
    return out

matte_full = span_fill(body, 0) & span_fill(body, 1)
# 闭运算封住地平线暗带等细缝
mf_im = Image.fromarray((matte_full * 255).astype(np.uint8))
matte_full = np.asarray(mf_im.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5))) > 128
# 护栏膨胀 3px：吃进画布与木框之间的混合过渡带，真木色像素挡路
woodish = (r > 60) & (g > r * 0.62) & (b > r * 0.33) & (g < r * 0.95)
for _ in range(3):
    grown = np.asarray(Image.fromarray((matte_full * 255).astype(np.uint8))
                       .filter(ImageFilter.MaxFilter(3))) > 128
    matte_full = matte_full | (grown & ~woodish & win)

ys, xs = np.where(matte_full)
print('matte bbox x:[%d,%d] y:[%d,%d]  px=%d' % (xs.min(), xs.max(), ys.min(), ys.max(), matte_full.sum()))

# ---------------- 2. 外接矩形（+pad）与蒙版裁剪 ----------------
PAD = 30  # 须容纳边界弯曲（右下角外凸约 20px）+羽化
X0, Y0 = int(xs.min()) - PAD, int(ys.min()) - PAD
X1, Y1 = int(xs.max()) + 1 + PAD, int(ys.max()) + 1 + PAD
BW, BH = X1 - X0, Y1 - Y0
print('bbox: X0=%d Y0=%d  %dx%d' % (X0, Y0, BW, BH))

# frame-rect.json 在边界线计算后统一导出（含吊牌钉点）

base = img.crop((X0, Y0, X1, Y1))
im = np.asarray(base).astype(float)
matte = matte_full[Y0:Y1, X0:X1]
Image.fromarray((matte * 255).astype(np.uint8)).save(SP + '/matte_raw.png')

# 注：art-01 不再输出视频裁剪版（2026-07-13 起与 02–06 同走真画合成，
# 视频帧色调 ≠ 实物，定格后由前端 1.2s 溶解盖上真色画作）

# ---------------- 3. 变形目标四边形：蒙版边缘拟合 + 向外过扫 ----------------
rowsL, rowsR, colsT, colsB = [], [], [], []
for y in range(BH):
    x = np.where(matte[y])[0]
    if len(x) > 40:
        rowsL.append((y, x.min())); rowsR.append((y, x.max()))
for x in range(BW):
    yy = np.where(matte[:, x])[0]
    if len(yy) > 40:
        colsT.append((x, yy.min())); colsB.append((x, yy.max()))

def mid(a, f=0.12):
    n = len(a); k = int(n * f)
    return np.array(a[k:n - k], float)

def fit(pairs):
    a = mid(pairs)
    m, c = np.polyfit(a[:, 0], a[:, 1], 1)
    res = np.abs(a[:, 1] - (m * a[:, 0] + c))
    keep = res < max(2.0, np.percentile(res, 75))
    return np.polyfit(a[keep, 0], a[keep, 1], 1)

mL, cL = fit(rowsL); mR, cR = fit(rowsR)
mT, cT = fit(colsT); mB, cB = fit(colsB)

def isect(mv, cv, mh, ch):
    y = (mh * cv + ch) / (1 - mh * mv)
    return np.array([mv * y + cv, y])

# 掩膜 = 键色蒙版的「平滑边界曲线」围成的区域：
# 蒙版宏观正确但边缘有 ±3px 键色抖动/阶梯，对四条边界序列做
# 中值+高斯平滑还原真实的连续边缘（含弯曲），角区由端部线性外推相交。
# 边界 = 梯度吸附：画布与框条间隔着暗缝，缝→框条是陡峭的上升沿。
# 沿每条扫描线在键色拟合线附近的候选带内找「第一个强上升沿」，
# 与颜色/明暗无关，深阴影同样成立。
GRAD_L = 0.299 * im[..., 0] + 0.587 * im[..., 1] + 0.114 * im[..., 2]

def snap_edge(axis, side, m_fit, c_fit, t_lo, t_hi, band_in=9, band_out=26):
    """axis=0: 边界是 x(y)（左右边）；axis=1: 边界是 y(x)（上下边）。
    side=0 向负方向为外（左/上），side=1 向正方向为外（右/下）。"""
    ts, vs = [], []
    for t in range(int(t_lo) + 10, int(t_hi) - 10):
        v_line = m_fit * t + c_fit
        lo = int(v_line - (band_in if side == 1 else band_out))
        hi = int(v_line + (band_out if side == 1 else band_in))
        if axis == 0:
            prof = GRAD_L[t, max(0, lo):hi] if 0 <= t < BH else None
        else:
            prof = GRAD_L[max(0, lo):hi, t] if 0 <= t < BW else None
        if prof is None or len(prof) < 8:
            continue
        grad = np.diff(prof)
        if side == 0:
            grad = -grad[::-1]  # 向外=负方向：反转后找上升沿
        gmax = grad.max()
        if gmax < 6:  # 无明显边缘（不应发生）
            continue
        cands = np.where(grad > max(6.0, 0.50 * gmax))[0]

        def pos_of(j):
            return (max(0, lo) + j) if side == 1 else (hi - 1 - j)

        def woodish_after(j):
            # 上升沿之后 2-5px 必须是木色平台（排除画布上的光束明暗沿）
            hits = 0
            for dd in (2, 3, 5):
                p = pos_of(j) + (dd if side == 1 else -dd)
                px = im[t, p] if axis == 0 else im[p, t]
                r0, g0, b0 = px
                if r0 > 55 and 0.60 * r0 < g0 < 0.92 * r0 and 0.34 * r0 < b0 < 0.80 * r0:
                    hits += 1
            return hits >= 2

        j = None
        for jc in cands:
            if woodish_after(jc):
                j = jc
                break
        if j is None:
            j = cands[-1]
        pos = pos_of(j)
        # 边界放在上升沿起点略内侧（暗缝属于画布侧）
        vs.append(pos + 0.4 if side == 1 else pos - 0.4)
        ts.append(t)
    t = np.array(ts, float); v = np.array(vs, float)
    # 中值（窗7）压离群 + 轻高斯
    pad = np.pad(v, 3, mode='edge')
    v = np.array([np.median(pad[i:i + 7]) for i in range(len(v))])
    k = np.exp(-0.5 * (np.arange(-4, 5) / 2.0) ** 2); k /= k.sum()
    v = np.convolve(np.pad(v, 4, mode='edge'), k, mode='valid')
    # 物理钳制：框条投影近似直线，残差 >3.5px 视为吸附失误压回直线
    mfit, cfit = np.polyfit(t, v, 1)
    res = v - (mfit * t + cfit)
    keep = np.abs(res) < np.percentile(np.abs(res), 80)
    mfit, cfit = np.polyfit(t[keep], v[keep], 1)
    line = mfit * t + cfit
    v = line  # 刚体框投影为直线：吸附点仅用于稳健拟合，波纹全部压平
    v = np.convolve(np.pad(v, 4, mode='edge'), k, mode='valid')
    # 端部线性外推覆盖角区
    kfit = min(16, len(t) // 3)
    m0, c0 = np.polyfit(t[:kfit], v[:kfit], 1)
    m1, c1 = np.polyfit(t[-kfit:], v[-kfit:], 1)
    n = BH if axis == 0 else BW
    full_t = np.arange(n, dtype=float)
    out = np.interp(full_t, t, v)
    out[full_t < t[0]] = m0 * full_t[full_t < t[0]] + c0
    out[full_t > t[-1]] = m1 * full_t[full_t > t[-1]] + c1
    return out

ys0, xs0 = np.where(matte)
left_f = snap_edge(0, 0, mL, cL, ys0.min(), ys0.max())
right_f = snap_edge(0, 1, mR, cR, ys0.min(), ys0.max())
top_f = snap_edge(1, 0, mT, cT, xs0.min(), xs0.max())
bot_f = snap_edge(1, 1, mB, cB, xs0.min(), xs0.max(), band_in=9, band_out=20)
print('right boundary: x@top=%.0f mid=%.0f bottom=%.0f (global %.0f→%.0f)' % (
    right_f[30], right_f[BH // 2], right_f[-40], right_f[30] + X0, right_f[-40] + X0))
print('bottom boundary: y@left=%.0f mid=%.0f right=%.0f (global %.0f→%.0f)' % (
    bot_f[40], bot_f[BW // 2], bot_f[-40], bot_f[40] + Y0, bot_f[-40] + Y0))

# 画布左上角（两线交点，迭代两轮收敛）
_tlx = left_f[60]
for _ in range(3):
    _tly = top_f[int(np.clip(_tlx, 0, BW - 1))]
    _tlx = left_f[int(np.clip(_tly, 0, BH - 1))]
PIN_X = X0 + _tlx - 7   # 钉在木框左上角的木条上
PIN_Y = Y0 + _tly - 9
json.dump({
    'left': round(X0 / W * 100, 3),
    'top': round(Y0 / H * 100, 3),
    'width': round(BW / W * 100, 3),
    'height': round(BH / H * 100, 3),
    'pinLeft': round(PIN_X / W * 100, 3),
    'pinTop': round(PIN_Y / H * 100, 3),
}, open(str(ROOT / 'lib' / 'frame-rect.json'), 'w'), indent=2)
print('frame-rect.json written (pin at %.0f, %.0f)' % (PIN_X, PIN_Y))

# 边界再外移：羽化坡道的中心落在中性暗缝上，而不是骑在
# 饱和色内容上（坡道与深蓝混色会产生 1-2px 的灰蓝发丝线）
top_f = top_f - 1.2
left_f = left_f - 1.2
right_f = right_f + 1.2
ys_all = np.arange(BH, dtype=float)[:, None]
xs_all = np.arange(BW, dtype=float)[None, :]
mask_lines = ((ys_all > top_f[None, :] - 0.2) & (ys_all < bot_f[None, :] + 0.2) &
              (xs_all > left_f[:, None] - 0.2) & (xs_all < right_f[:, None] + 0.2))
# 纯直线蒙版：直边干净利落（内容并集/膨胀会引入锯齿，已撤销）
mask_bool = mask_lines
matte_f = np.asarray(
    Image.fromarray((mask_bool * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
).astype(float) / 255.0
Image.fromarray((matte_f * 255).astype(np.uint8)).save(SP + '/matte.png')

# ---- 2x 超采样输出（大屏 >1x 显示时边缘依旧丝滑）----
# 边界是解析直线，直接在 2x 网格上重栅格化（无损）；羽化 2.2 ≈ 原生 1.1px
SS = 2
BW2, BH2 = BW * SS, BH * SS
xs2 = np.arange(BW2, dtype=float) / SS
ys2 = np.arange(BH2, dtype=float) / SS
top2 = np.interp(xs2, np.arange(BW, dtype=float), top_f) * SS
bot2 = np.interp(xs2, np.arange(BW, dtype=float), bot_f) * SS
left2 = np.interp(ys2, np.arange(BH, dtype=float), left_f) * SS
right2 = np.interp(ys2, np.arange(BH, dtype=float), right_f) * SS
mask2 = ((np.arange(BH2, dtype=float)[:, None] > top2[None, :] - 0.4) &
         (np.arange(BH2, dtype=float)[:, None] < bot2[None, :] + 0.4) &
         (np.arange(BW2, dtype=float)[None, :] > left2[:, None] - 0.4) &
         (np.arange(BW2, dtype=float)[None, :] < right2[:, None] + 0.4))
matte_f2 = np.asarray(
    Image.fromarray((mask2 * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2.2))
).astype(float) / 255.0
_a = (matte_f2 * 255).astype(np.uint8)
_rgba = np.dstack([np.full_like(_a, 255), np.full_like(_a, 255), np.full_like(_a, 255), _a])
Image.fromarray(_rgba, 'RGBA').save(OUT + '/frame-mask.png')

base2 = base.resize((BW2, BH2), Image.LANCZOS)
im2 = np.asarray(base2).astype(float)

def up_field(arr):
    return np.asarray(Image.fromarray(arr.astype(np.float32), 'F')
                      .resize((BW2, BH2), Image.BILINEAR)).astype(float)

# 变形四边形：四条拟合线各自外推到「完全罩住蒙版 + 4px」，
# 保持透视倾斜的同时保证蒙版内处处有画可采样（杜绝黑边渗出）
rL = np.array(rowsL, float); rR = np.array(rowsR, float)
cTt = np.array(colsT, float); cBb = np.array(colsB, float)
cL2 = cL - (np.max((mL * rL[:, 0] + cL) - rL[:, 1]) + 4)
cR2 = cR + (np.max(rR[:, 1] - (mR * rR[:, 0] + cR)) + 4)
cT2 = cT - (np.max((mT * cTt[:, 0] + cT) - cTt[:, 1]) + 4)
cB2 = cB + (np.max(cBb[:, 1] - (mB * cBb[:, 0] + cB)) + 4)
qTL = tuple(isect(mL, cL2, mT, cT2)); qTR = tuple(isect(mR, cR2, mT, cT2))
qBR = tuple(isect(mR, cR2, mB, cB2)); qBL = tuple(isect(mL, cL2, mB, cB2))
print('warp quad:', [f'({p[0]:.1f},{p[1]:.1f})' for p in (qTL, qTR, qBR, qBL)])

# debug：蒙版边界叠原图
dbg = base.copy()
edge = np.abs(matte_f - 0.5) < 0.35
dd = ImageDraw.Draw(dbg)
ys_e, xs_e = np.where(edge)
for yy, xx in zip(ys_e.tolist()[::3], xs_e.tolist()[::3]):
    dd.point((xx, yy), fill=(255, 0, 255))
dbg.resize((BW * 2, BH * 2), Image.NEAREST).save(SP + '/matte_edge_on_base.png')

# ---------------- 4. 光照图与画布纹理 ----------------
L = 0.299 * im[..., 0] + 0.587 * im[..., 1] + 0.114 * im[..., 2]
rb, gb, bb = im[..., 0], im[..., 1], im[..., 2]
navy_l = (bb > 55) & (bb > rb + 45) & (gb < 90)
orange_l = ((rb - bb) > 105) & (gb > 70) & (gb < 165) & (rb > 120)

valid = (navy_l | orange_l) & mask_bool
valid_er = np.asarray(
    Image.fromarray((valid * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(5))
) > 128

K = 14.0
N = np.ones_like(L)
conf = np.full_like(L, 0.7)
for m, cw in ((navy_l, 0.25), (orange_l, 1.0)):
    me = m & valid_er
    if me.sum() > 100:
        mean = L[me].mean()
        N[m] = (L[m] + K) / (mean + K)
        conf[m] = cw
N = np.clip(N, 0.62, 1.38)

def gauss(arr, sigma):
    return np.asarray(Image.fromarray(np.clip(arr * 128, 0, 255).astype(np.uint8)).filter(
        ImageFilter.GaussianBlur(sigma))).astype(float) / 128.0

# 掩膜边缘 9px 环带：框沿阴影是真实信号，置信度拉满以完整继承
poly_bin = matte_f > 0.5
poly_er = np.asarray(
    Image.fromarray((poly_bin * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(19))
) > 128
ring = poly_bin & ~poly_er
# 环带内亮度归一化基于同区域色（navy/orange 已各自归一），直接提升权重
conf = np.where(ring, 1.0, conf)

vm = valid_er.astype(float)
fillmap = gauss(N * vm, 24) / np.maximum(gauss(vm, 24), 1e-4)
combined = np.where(valid_er, N, fillmap)
lightmap = gauss(combined, 3.5)
broad = gauss(lightmap, 14)
lightmap = broad + (lightmap - broad) * gauss(conf, 8)
np.save(SP + '/lightmap.npy', lightmap)
Image.fromarray(np.clip(lightmap * 128, 0, 255).astype(np.uint8)).save(SP + '/lightmap_preview.png')

Lb = gauss(L / 128.0, 2.2) * 128.0
hf = (L - Lb) / np.maximum(L[orange_l & valid_er].mean(), 30)
hf = np.clip(hf, -0.22, 0.22)
grain = np.where(orange_l & valid_er, hf, np.nan)
for dx, dy in ((91, 53), (177, 131), (37, 211), (140, 20)):
    rolled = np.roll(np.roll(grain, dy, axis=0), dx, axis=1)
    grain = np.where(np.isnan(grain), rolled, grain)
grain = np.nan_to_num(grain, nan=0.0)
np.save(SP + '/grain.npy', grain)

# ---------------- 5. 变形 + 蒙版合成 ----------------
def find_coeffs(pa, pb):
    M = []
    for p1, p2 in zip(pa, pb):
        M.append([p1[0], p1[1], 1, 0, 0, 0, -p2[0] * p1[0], -p2[0] * p1[1]])
        M.append([0, 0, 0, p1[0], p1[1], 1, -p2[1] * p1[0], -p2[1] * p1[1]])
    A = np.array(M, float)
    B = np.array([c for p in pb for c in p], float)
    return np.linalg.solve(A, B).tolist()

FA_W, FA_H = 1400, 2000  # 平面稿原生 2x 分辨率，直接喂给 2x 变形
quad2 = [tuple(np.array(p) * SS) for p in (qTL, qTR, qBR, qBL)]
coeffs2 = find_coeffs(quad2,
                      [(0, 0), (FA_W, 0), (FA_W, FA_H), (0, FA_H)])
lightmap2 = up_field(lightmap)
grain2 = up_field(grain)
def composite(flat_img, name):
    warped = flat_img.transform((BW2, BH2), Image.PERSPECTIVE, coeffs2, Image.BICUBIC)
    wa = np.asarray(warped).astype(float)
    lit = np.clip(wa * lightmap2[..., None] * (1.0 + grain2[..., None] * 0.85), 0, 255)
    out = im2 * (1 - matte_f2[..., None]) + lit * matte_f2[..., None]
    out = np.clip(out + CALIB, 0, 255).astype(np.uint8)
    Image.fromarray(out).save(f'{OUT}/{name}.png')
    print('wrote', name, out.shape)

# ---------------- 6. 真实画作平面稿 → 合成 ----------------
# 平面稿由 tools/extract_flats.py 从供应商产品图提取（1400×2000 = FA_W×FA_H）。
# 全部 6 张（含 art-01 晴野）走透视+光照+纹理合成 —— 视频帧色调与实物
# 有偏差，定格后前端用溶解把真色画作盖上（用户反馈 2026-07-13）。
# 注：平面稿自带真实圈绒纹理，视频烘焙的 grain 叠加系数在 composite 内为 0.85，
# 若观感过密可在此处对 flat 轻微高斯（0.6）预柔化。
FLAT_DIR = ROOT / 'tools' / 'flats'
for _i in range(1, 7):
    _flat = Image.open(str(FLAT_DIR / f'flat-0{_i}.png')).convert('RGB')
    if _flat.size != (FA_W, FA_H):
        _flat = _flat.resize((FA_W, FA_H), Image.LANCZOS)
    composite(_flat, f'art-0{_i}')


# ---------------- 7. 边缘复核图：四幅画的四边 3x 放大条 ----------------
def edge_sheet():
    arts = [Image.open(f'{OUT}/art-0{i}.png') for i in range(1, 7)]
    Z = 3
    strips = []
    for a in arts:
        aw, ah = a.size
        edges = [
            a.crop((0, 0, aw, 30)),
            a.crop((aw - 30, 0, aw, ah)).rotate(90, expand=True),
            a.crop((0, ah - 30, aw, ah)),
            a.crop((0, 0, 30, ah)).rotate(90, expand=True),
        ]
        colw = max(e.width for e in edges) * Z
        col = Image.new('RGB', (colw, (30 * Z + 6) * 4), (245, 245, 245))
        for i, e in enumerate(edges):
            e = e.resize((e.width * Z, 30 * Z), Image.NEAREST)
            col.paste(e, (0, i * (30 * Z + 6)))
        strips.append(col)
    sheet = Image.new('RGB', (sum(s.width + 10 for s in strips), strips[0].height), (245, 245, 245))
    x = 0
    for s in strips:
        sheet.paste(s, (x, 0)); x += s.width + 10
    sheet.save(SP + '/edges_check.png')
    print('edges_check.png written')

edge_sheet()
print('done')
