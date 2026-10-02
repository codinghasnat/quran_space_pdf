"""Summarise every built page into web/public/pages/lines.json for the planner and heatmap.

Usage: .venv/bin/python tools/build_line_index.py
Writes {"<page>": [[line, surah, firstAyah, lastAyah, words], ...]} for each line that holds Qur'an text.
Surah headers and basmalah lines carry no words and are left out, so every listed line belongs to one surah.
"""
import json
from pathlib import Path

PAGES = Path(__file__).parent.parent / "web" / "public" / "pages"


def main():
    out = {}
    for path in sorted(PAGES.glob("*.json"), key=lambda p: (not p.stem.isdigit(), int(p.stem) if p.stem.isdigit() else 0)):
        if not path.stem.isdigit():
            continue
        data = json.loads(path.read_text())
        lines = []
        for ln in data["lines"]:
            words = [w for w in ln["words"] if w["type"] == "word"]
            if not words:
                continue
            ayahs = [(int(s), int(a)) for s, a, _ in (w["key"].split(":") for w in words)]
            surahs = {s for s, _ in ayahs}
            assert len(surahs) == 1, f"page {data['page']} line {ln['line']} spans surahs {surahs}"
            lines.append([ln["line"], ayahs[0][0], ayahs[0][1], ayahs[-1][1], len(words)])
        out[str(data["page"])] = lines
    (PAGES / "lines.json").write_text(json.dumps(out, separators=(",", ":")))
    print(f"{len(out)} pages, {sum(len(v) for v in out.values())} lines")


if __name__ == "__main__":
    main()
