import json, sys
from collections import defaultdict
from pathlib import Path
from PIL import Image, ImageDraw
import numpy as np
sys.path.insert(0, str(Path(__file__).parent))
from layout_lib import *

CACHE = Path(__file__).parent.parent / ".cache"

def line_tokens(page):
    toks = defaultdict(list)
    n = 1
    while n:
        d = json.loads((CACHE / f"words_{page}_{n}.json").read_text())
        for v in d["verses"]:
            for w in v["words"]:
                toks[w["line_number"]].append(w)
        n = d["pagination"]["next_page"]
    return toks

img_path, page, out = sys.argv[1], int(sys.argv[2]), sys.argv[3]
im = Image.open(img_path).convert("RGB")
rgb = np.asarray(im)
g = rgb.mean(axis=2)
x0, x1 = text_column(page, rgb.shape[1])
top, pitch, fit = fit_grid(dottedness(g, x0, x1))
toks = line_tokens(page)
dr = ImageDraw.Draw(im)
ink = ink_mask(rgb)
for k in range(LINES_PER_PAGE):
    y0, y1 = int(top + k * pitch) + 4, int(top + (k + 1) * pitch) - 4
    dr.rectangle([x0, y0, x1, y1], outline=(0, 0, 255), width=2)
    band = ink[y0:y1, x0:x1]
    n = len(toks.get(k + 1, []))
    spans, _ = split_words_colour(rgb[y0:y1, x0:x1], n)
    for i, (a, b) in enumerate(spans):
        dr.rectangle([x0 + a, y0 + 2, x0 + b, y1 - 2], outline=(255, 0, 0) if i % 2 else (0, 160, 0), width=3)
    print(k + 1, n, len(spans))
im.resize((im.width // 2, im.height // 2)).save(out)
