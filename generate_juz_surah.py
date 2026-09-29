"""Generate juz/juz_1..30.pdf and surah/1..114.pdf using the same layout as quran_with_notes_pdf.py."""
import argparse
import json
from collections import defaultdict
from pathlib import Path

import httpx
from weasyprint import HTML

from quran_with_notes_pdf import HTML_TMPL, API_URL_UTHMANI, LineData

API_URL_WORDS = "https://api.quran.com/api/v4/verses/by_page/{page}?words=true&per_page=50&page={n}"
API_URL_CHAPTERS = "https://api.quran.com/api/v4/chapters"
CACHE_DIR = Path(".cache")
BISMILLAH = "بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ"


def get_json(client: httpx.Client, url: str, cache_name: str) -> dict:
    path = CACHE_DIR / cache_name
    if path.exists():
        return json.loads(path.read_text())
    r = client.get(url, timeout=40.0)
    r.raise_for_status()
    data = r.json()
    path.write_text(json.dumps(data, ensure_ascii=False))
    return data


def fetch_page(client: httpx.Client, page_no: int) -> list[dict]:
    """Return the page's lines as [{"verses": [(verse_key, surah, juz, text), ...]}] in reading order."""
    uthmani = get_json(client, API_URL_UTHMANI.format(page=page_no), f"uthmani_{page_no}.json")
    verse_texts = {v["verse_key"]: v["text_uthmani"].strip() for v in uthmani["verses"]}

    verses = []
    n = 1
    while n:
        data = get_json(client, API_URL_WORDS.format(page=page_no, n=n), f"words_{page_no}_{n}.json")
        verses.extend(data["verses"])
        n = data["pagination"]["next_page"]

    # A verse is placed on the first line where one of its words appears
    line_verses = defaultdict(list)
    for v in verses:
        lines = [w["line_number"] for w in v["words"] if w.get("char_type_name") == "word" and w.get("line_number")]
        if lines:
            surah = int(v["verse_key"].split(":")[0])
            line_verses[min(lines)].append((v["verse_key"], surah, v["juz_number"], verse_texts[v["verse_key"]]))

    return [line_verses[ln] for ln in sorted(line_verses)]


def build_pdf(pages: dict[int, list[list[tuple]]], out_path: Path, chapter_names: dict[int, str], args):
    """pages: mushaf page -> list of lines, each a list of (verse_key, surah, juz, text)."""
    lines_by_page = {}
    surah_headers = {}
    for p, lines in pages.items():
        out_lines = []
        for line in lines:
            parts = []
            for verse_key, surah, _juz, text in line:
                if verse_key.endswith(":1"):
                    # A new surah starts here: flush the current line and add header/bismillah
                    if parts:
                        out_lines.append(LineData(" ".join(parts)))
                        parts = []
                    if not out_lines and p not in surah_headers:
                        surah_headers[p] = f"سُورَةُ {chapter_names[surah]}"
                    else:
                        out_lines.append(LineData(f"سُورَةُ {chapter_names[surah]}", is_bismillah=True))
                    if surah not in (1, 9):
                        out_lines.append(LineData(BISMILLAH, is_bismillah=True))
                parts.append(text)
            if parts:
                out_lines.append(LineData(" ".join(parts)))
        lines_by_page[p] = out_lines

    html = HTML_TMPL.render(
        pages=list(pages),
        lines=lines_by_page,
        surah_headers=surah_headers,
        font_filename=args.font,
        font_size_pt=args.fontsize,
        header_size_pt=20,
        note_line_em=args.notesize,
    )
    HTML(string=html, base_url=str(Path(".").resolve())).write_pdf(out_path)
    print(f"✓ {out_path}")


def select(all_pages: dict, keep) -> dict:
    """Filter all_pages down to verses matching keep(surah, juz), dropping empty lines/pages."""
    result = {}
    for p, lines in all_pages.items():
        kept = [[v for v in line if keep(v[1], v[2])] for line in lines]
        kept = [line for line in kept if line]
        if kept:
            result[p] = kept
    return result


def main():
    ap = argparse.ArgumentParser(description="Generate per-juz and per-surah Qur'an PDFs with note lines.")
    ap.add_argument("--font", type=str, default="uthmani_font.ttf")
    ap.add_argument("--fontsize", type=int, default=16)
    ap.add_argument("--notesize", type=float, default=2.5)
    ap.add_argument("--only", choices=["juz", "surah"], help="Generate only one set.")
    args = ap.parse_args()

    CACHE_DIR.mkdir(exist_ok=True)
    with httpx.Client() as client:
        chapters = get_json(client, API_URL_CHAPTERS, "chapters.json")["chapters"]
        chapter_names = {c["id"]: c["name_arabic"] for c in chapters}
        all_pages = {}
        for p in range(1, 605):
            all_pages[p] = fetch_page(client, p)
            print(f"\rFetched page {p}/604", end="", flush=True)
        print()

    if args.only in (None, "juz"):
        Path("juz").mkdir(exist_ok=True)
        for j in range(1, 31):
            build_pdf(select(all_pages, lambda s, jz: jz == j), Path("juz") / f"juz_{j}.pdf", chapter_names, args)

    if args.only in (None, "surah"):
        Path("surah").mkdir(exist_ok=True)
        for s in range(1, 115):
            build_pdf(select(all_pages, lambda su, jz: su == s), Path("surah") / f"{s}.pdf", chapter_names, args)


if __name__ == "__main__":
    main()
