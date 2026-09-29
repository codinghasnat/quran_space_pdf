"""Draw the word boxes from web/public/pages/<page>.json over its image, for eyeballing detection quality."""
import json, sys
from pathlib import Path
from PIL import Image, ImageDraw

page, out = int(sys.argv[1]), sys.argv[2]
d = Path(__file__).parent.parent / "web" / "public" / "pages"
im = Image.open(d / f"{page}.webp").convert("RGB")
meta = json.loads((d / f"{page}.json").read_text())
W, H = im.size
dr = ImageDraw.Draw(im)
for ln in meta["lines"]:
    for i, w in enumerate(ln["words"]):
        c = (220, 0, 0) if i % 2 else (0, 150, 0)
        dr.rectangle([w["x0"] * W, ln["y0"] * H, w["x1"] * W, ln["y1"] * H], outline=c, width=3)
        dr.line([w["x0"] * W, ln["ySplit"] * H, w["x1"] * W, ln["ySplit"] * H], fill=(0, 0, 255), width=1)
im.resize((W // 2, H // 2)).save(out)
