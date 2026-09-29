"""Build page images + word geometry for the hifz web app from the Karya Bestari mushaf scan.

Usage: .venv/bin/python tools/build_web_data.py 1-21
Writes web/public/pages/<page>.webp and web/public/pages/<page>.json
"""
import json
import subprocess
import tempfile
import sys
from collections import defaultdict
from pathlib import Path

import httpx
import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from layout_lib import (LINES_PER_PAGE, PDF_PAGE_OFFSET, dottedness, fit_grid,
                        split_words_colour, text_column)

ROOT = Path(__file__).parent.parent
PDF = ROOT / "mushaf" / "karya_bestari.pdf"
CACHE = ROOT / ".cache"
OUT = ROOT / "web" / "public" / "pages"
WORDS_URL = ("https://api.quran.com/api/v4/verses/by_page/{page}?words=true&per_page=50&page={n}"
             "&word_fields=text_uthmani&translations=")

# Opening pages sit inside a decorative frame with a fixed column and first-line position. This edition also
# breaks their lines differently from quran.com's layout, so tokens are re-chunked with these per-line counts.
SPECIAL = {
    1: {"x": (405, 1195), "top": 449, "pitch": 137.0, "counts": [5, 6, 6, 5, 5, 5, 4]},
    2: {"x": (405, 1195), "top": 575, "pitch": 137.0, "counts": [8, 6, 5, 8, 7, 7]},
}
# Share of a line's height taken by the Arabic row; the English gloss sits below it
ARABIC_SHARE = 0.70


def page_image(page: int) -> Image.Image:
    """The page's embedded scan, extracted losslessly (each PDF page is a single JPEG)."""
    pdf_page = str(page + PDF_PAGE_OFFSET)
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(["pdfimages", "-f", pdf_page, "-l", pdf_page, "-j", str(PDF), f"{tmp}/p"], check=True)
        return Image.open(next(Path(tmp).glob("p-*"))).convert("RGB")


def page_words(client: httpx.Client, page: int) -> dict[int, list[dict]]:
    """line_number -> tokens (words and verse-end markers) in reading order."""
    by_line = defaultdict(list)
    n = 1
    while n:
        path = CACHE / f"wordsu_{page}_{n}.json"
        if path.exists():
            data = json.loads(path.read_text())
        else:
            r = client.get(WORDS_URL.format(page=page, n=n), timeout=40.0)
            r.raise_for_status()
            data = r.json()
            path.write_text(json.dumps(data, ensure_ascii=False))
        for v in data["verses"]:
            for w in v["words"]:
                by_line[w["line_number"]].append({
                    "key": f"{v['verse_key']}:{w['position']}",
                    "type": w["char_type_name"],
                    "ar": w.get("text_uthmani") or "",
                    "en": (w.get("translation") or {}).get("text") or "",
                    "juz": v["juz_number"],
                })
        n = data["pagination"]["next_page"]
    return by_line


def build_page(client: httpx.Client, page: int) -> dict:
    im = page_image(page)
    rgb = np.asarray(im)
    gray = rgb.mean(axis=2)

    if page in SPECIAL:
        cfg = SPECIAL[page]
        x0, x1 = cfg["x"]
        top, pitch = cfg["top"], cfg["pitch"]
    else:
        x0, x1 = text_column(page, rgb.shape[1])
        top, pitch, _fit = fit_grid(dottedness(gray, x0, x1))

    tokens = page_words(client, page)
    if page in SPECIAL:
        flat = [t for ln in sorted(tokens) for t in tokens[ln]]
        counts = SPECIAL[page]["counts"]
        assert sum(counts) == len(flat), f"page {page}: {len(flat)} tokens, counts sum to {sum(counts)}"
        starts = np.cumsum([0] + counts)
        tokens = {i + 1: flat[starts[i]:starts[i + 1]] for i in range(len(counts))}
    n_lines = len(tokens) if page in SPECIAL else LINES_PER_PAGE

    # Crop to the text column (keeping the header strip) so the page reads well on a phone
    cy0 = max(0, int(top) - (85 if page not in SPECIAL else 140))
    cy1 = min(rgb.shape[0], int(top + n_lines * pitch) + 12)
    cx0, cx1 = max(0, x0 - 6), min(rgb.shape[1], x1 + 6)
    crop = im.crop((cx0, cy0, cx1, cy1))
    cw, ch = crop.size
    OUT.mkdir(parents=True, exist_ok=True)
    crop.save(OUT / f"{page}.webp", "WEBP", quality=82, method=6)

    lines, mismatches = [], 0
    for k in range(n_lines):
        line_no = k + 1
        toks = tokens.get(line_no, [])
        y0, y1 = int(top + k * pitch) + 3, int(top + (k + 1) * pitch) - 3
        spans, raw = split_words_colour(rgb[y0:y1, x0:x1], len(toks)) if toks else ([], 0)
        if toks and raw != len(toks):
            mismatches += 1
        if spans:
            # Stretch the line's outer words to the column edges so no stray strokes peek out from under covers
            spans[0] = (spans[0][0], x1 - x0)
            spans[-1] = (0, spans[-1][1])
        # Covers run from dotted rule to dotted rule (harakat sit close to the rules)
        y0, y1 = y0 - 2, y1 + 2
        words = []
        for tok, (a, b) in zip(toks, spans):
            words.append({
                **{k2: tok[k2] for k2 in ("key", "type", "ar", "en")},
                "x0": round((x0 + a - cx0) / cw, 4),
                "x1": round((x0 + b - cx0) / cw, 4),
            })
        lines.append({
            "line": line_no,
            "y0": round((y0 - cy0) / ch, 4),
            "ySplit": round((y0 + ARABIC_SHARE * (y1 - y0) - cy0) / ch, 4),
            "y1": round((y1 - cy0) / ch, 4),
            "words": words,
        })

    juz = min((t["juz"] for ts in tokens.values() for t in ts), default=None)
    verses = [t["key"].rsplit(":", 1)[0] for ts in tokens.values() for t in ts]
    data = {
        "page": page,
        "juz": juz,
        "width": cw,
        "height": ch,
        "firstVerse": verses[0] if verses else None,
        "lastVerse": verses[-1] if verses else None,
        "lines": lines,
    }
    (OUT / f"{page}.json").write_text(json.dumps(data, ensure_ascii=False))
    print(f"page {page}: {len(lines)} lines, top={top:.0f} pitch={pitch:.2f}, word-count mismatches={mismatches}")
    return data


def main():
    a, _, b = sys.argv[1].partition("-")
    pages = range(int(a), int(b or a) + 1)
    CACHE.mkdir(exist_ok=True)
    index = []
    idx_path = OUT / "index.json"
    if idx_path.exists():
        index = [p for p in json.loads(idx_path.read_text()) if p["page"] not in pages]
    with httpx.Client() as client:
        for p in pages:
            d = build_page(client, p)
            index.append({"page": p, "juz": d["juz"], "firstVerse": d["firstVerse"], "lastVerse": d["lastVerse"]})
    index.sort(key=lambda p: p["page"])
    idx_path.write_text(json.dumps(index, ensure_ascii=False))


if __name__ == "__main__":
    main()
