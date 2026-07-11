"""
从供应商产品截图（IMG_43XX.PNG，正面平拍 mockup）提取画布平面稿。

原理：截图模板一致（白底 + 浅木框 + 画布），画布是唯一的高饱和/深色大块。
逐图用「列/行饱和占比」找画布内缘；若某图检测失败（如波光上半部
浅色闪光区饱和度低），回退到其余图的共识框（模板逐像素对齐）。

产出：public/hero/art/flat-01..06.png（1400×2000，管线 composite 的原生输入尺寸）
顺序与 lib/heroConfig.ts ARTWORKS 对齐。
"""
import pathlib
import numpy as np
from PIL import Image, ImageFilter

ROOT = pathlib.Path(__file__).parent.parent
SRC = ROOT / 'GlugGlug30天发文计划'
OUT = ROOT / 'public' / 'hero' / 'art'

# (源文件, 输出名) —— 顺序 = ARTWORKS 顺序
ORDER = [
    ('IMG_4368.PNG', 'flat-01'),  # 晴野 Sunny Field（hero 视频内画作）
    ('IMG_4367.PNG', 'flat-02'),  # 波光 Wave Light
    ('IMG_4364.PNG', 'flat-03'),  # 叶舟 Leaf Boat
    ('IMG_4369.PNG', 'flat-04'),  # 森光 Forest Light
    ('IMG_4365.PNG', 'flat-05'),  # 窗影 Window Glow
    ('IMG_4366.PNG', 'flat-06'),  # 红果 Red Fruit
]
INSET = 4          # 内缩避开框内缘阴影线
FW, FH = 1400, 2000


def inner_range(frac, thresh=0.55):
    idx = np.where(frac > thresh)[0]
    if len(idx) == 0:
        return None
    runs = np.split(idx, np.where(np.diff(idx) > 3)[0] + 1)
    run = max(runs, key=len)
    return int(run.min()), int(run.max())


def detect_box(im):
    a = np.asarray(im).astype(int)
    sat = a.max(axis=2) - a.min(axis=2)
    L = (a[..., 0] * 299 + a[..., 1] * 587 + a[..., 2] * 114) // 1000
    strong = (sat > 45) | (L < 110)
    # 限定产品区（模板固定：上下黑条外側不看）
    strong[:900] = False
    strong[2000:] = False
    strong[:, :250] = False
    strong[:, 1060:] = False
    colfrac = strong.mean(axis=0) / max(strong.mean(axis=0).max(), 1e-6)
    xr = inner_range(colfrac)
    if xr is None:
        return None
    rows_in = strong[:, xr[0]:xr[1]]
    rowfrac = rows_in.mean(axis=1) / max(rows_in.mean(axis=1).max(), 1e-6)
    yr = inner_range(rowfrac)
    if yr is None:
        return None
    return (xr[0], yr[0], xr[1], yr[1])


def plausible(box):
    if box is None:
        return False
    w, h = box[2] - box[0], box[3] - box[1]
    return h > 0 and 0.60 < w / h < 0.72 and w > 500


boxes = {}
for f, name in ORDER:
    im = Image.open(SRC / f).convert('RGB')
    boxes[name] = (im, detect_box(im))

valid = [b for _, b in boxes.values() if plausible(b)]
consensus = tuple(int(np.median([b[i] for b in valid])) for i in range(4))
print('consensus box:', consensus, f'({len(valid)}/{len(ORDER)} valid)')

for f, name in ORDER:
    im, box = boxes[name]
    if not plausible(box):
        print(f'  {name}: detection implausible {box} -> consensus')
        box = consensus
    crop = im.crop((box[0] + INSET, box[1] + INSET, box[2] - INSET + 1, box[3] - INSET + 1))
    crop.resize((FW, FH), Image.LANCZOS).save(OUT / f'{name}.png')
    print(f'  {name}: box={box} -> {FW}x{FH}')
print('flats written to', OUT)
