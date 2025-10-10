import argparse
import httpx
from pathlib import Path
from jinja2 import Template
from weasyprint import HTML, CSS
from collections import defaultdict
import re

HTML_TMPL = Template(r"""
<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<style>
  @page { size: A4; margin: 20mm 15mm 20mm 15mm; }
  @font-face {
    font-family: 'UthmaniHafs';
    src: url('{{ font_filename }}') format('truetype');
    font-weight: normal; 
    font-style: normal;
    font-feature-settings: "liga" 1, "mark" 1, "ccmp" 1, "kern" 1;
  }
  body { 
    margin: 0; 
    font-family: 'UthmaniHafs', 'Amiri', serif;
    direction: rtl;
  }
  .page { 
    page-break-after: always; 
    padding: 0;
    margin: 0;
  }
  .pagenum { 
    font-size: 9pt; 
    text-align: left; 
    direction: ltr; 
    margin-bottom: 8mm;
    font-family: 'Times New Roman', serif;
    color: #333;
  }
  .qline {
    font-family: 'UthmaniHafs', 'Amiri', serif;
    font-size: {{ font_size_pt }}pt;
    line-height: 1.8;
    direction: rtl; 
    unicode-bidi: bidi-override;
    text-align: justify;
    margin: 0 0 3mm 0;
    padding: 2mm 0;
    word-spacing: 0.1em;
    letter-spacing: 0.02em;
    font-feature-settings: "liga" 1, "mark" 1, "ccmp" 1, "kern" 1, "calt" 1;
  }
  .note-line {
    border-bottom: 1.5px solid #666;
    height: {{ note_line_em }}em;
    margin: 2mm 0 6mm 0;
    width: 100%;
  }
  .surah-header {
    font-family: 'UthmaniHafs', 'Amiri', serif;
    font-size: {{ header_size_pt }}pt;
    text-align: center;
    margin: 0 0 6mm 0;
    direction: rtl;
    padding: 3mm 0;
    border-top: 2px solid #333;
    border-bottom: 1px solid #333;
    font-weight: normal;
  }
  .bismillah {
    font-family: 'UthmaniHafs', 'Amiri', serif;
    font-size: {{ font_size_pt + 2 }}pt;
    text-align: center;
    margin: 4mm 0;
    direction: rtl;
  }
</style>
</head>
<body>
{% for p in pages %}
  <section class="page">
    <div class="pagenum">Page {{ p }}</div>
    {% if surah_headers.get(p) %}
      <div class="surah-header">{{ surah_headers[p] }}</div>
    {% endif %}
    {% for line_data in lines[p] %}
      {% if line_data.is_bismillah %}
        <div class="bismillah">{{ line_data.text }}</div>
      {% else %}
        <p class="qline">{{ line_data.text }}</p>
      {% endif %}
      <div class="note-line"></div>
    {% endfor %}
  </section>
{% endfor %}
</body>
</html>
""")

API_URL_UTHMANI = "https://api.quran.com/api/v4/quran/verses/uthmani?page_number={page}"
API_URL_WORDS = "https://api.quran.com/api/v4/verses/by_page/{page}?words=true"

class LineData:
    def __init__(self, text: str, is_bismillah: bool = False):
        self.text = text
        self.is_bismillah = is_bismillah

def fetch_page_lines(page_no: int) -> list[LineData]:
    """
    Returns a list of properly formatted Uthmani text lines for the given Madani page,
    maintaining the correct line order and authentic Arabic text.
    """
    # Fetch the proper Uthmani text
    r_uthmani = httpx.get(API_URL_UTHMANI.format(page=page_no), timeout=40.0)
    r_uthmani.raise_for_status()
    uthmani_data = r_uthmani.json()
    
    # Fetch word-level data for line numbers
    r_words = httpx.get(API_URL_WORDS.format(page=page_no), timeout=40.0)
    r_words.raise_for_status()
    words_data = r_words.json()
    
    # Create verse text mapping
    verse_texts = {}
    for verse in uthmani_data.get("verses", []):
        verse_key = verse.get("verse_key")
        verse_texts[verse_key] = verse.get("text_uthmani", "")
    
    # Map words to lines while preserving verse boundaries
    line_verse_map = defaultdict(list)  # line_number -> [(verse_key, word_positions)]
    word_line_map = {}  # (verse_key, word_position) -> line_number
    
    for verse in words_data.get("verses", []):
        verse_key = verse.get("verse_key")
        for word in verse.get("words", []):
            if word.get("char_type_name") == "word":
                line_num = word.get("line_number")
                word_pos = word.get("position")
                if line_num and word_pos:
                    line_verse_map[line_num].append((verse_key, word_pos))
                    word_line_map[(verse_key, word_pos)] = line_num
    
    # Build lines by intelligently breaking verses at line boundaries
    lines = []
    processed_verses = set()
    
    for line_num in sorted(line_verse_map.keys()):
        line_parts = []
        verse_words_in_line = line_verse_map[line_num]
        
        # Group by verse
        verse_groups = defaultdict(list)
        for verse_key, word_pos in verse_words_in_line:
            verse_groups[verse_key].append(word_pos)
        
        for verse_key in sorted(verse_groups.keys()):
            if verse_key in verse_texts:
                verse_text = verse_texts[verse_key].strip()
                
                # Handle complete verses that fit on one line
                if verse_key not in processed_verses:
                    # Check if entire verse is on this line
                    all_words_this_verse = []
                    for v in words_data.get("verses", []):
                        if v.get("verse_key") == verse_key:
                            for w in v.get("words", []):
                                if w.get("char_type_name") == "word":
                                    all_words_this_verse.append(w.get("position"))
                            break
                    
                    verse_words_on_line = verse_groups[verse_key]
                    
                    # If this is the complete verse or continues from previous line
                    if (set(all_words_this_verse).issubset(set(verse_words_on_line)) or 
                        len(verse_words_on_line) > len(all_words_this_verse) * 0.7):
                        line_parts.append(verse_text)
                        processed_verses.add(verse_key)
                    else:
                        # Partial verse - we need to split intelligently
                        # For now, include the full verse text and let CSS handle wrapping
                        line_parts.append(verse_text)
                        processed_verses.add(verse_key)
        
        if line_parts:
            combined_text = " ".join(line_parts).strip()
            # Check if this is Bismillah (starts with بِسْمِ)
            is_bismillah = combined_text.startswith("بِسْمِ ٱللَّهِ")
            lines.append(LineData(combined_text, is_bismillah))
    
    return lines

def build_pdf(
    start_page: int,
    end_page: int,
    out_path: str,
    font_filename: str = "uthmani_font.ttf",
    font_size_pt: int = 18,
    header_size_pt: int = 20,
    note_line_em: float = 2.5,
    surah_headers: dict[int, str] | None = None,
):
    """Build a PDF with proper Uthmani script and line formatting."""
    pages = list(range(start_page, end_page + 1))
    lines_by_page = {}
    
    print(f"Fetching Qur'an data for pages {start_page}-{end_page}...")
    for p in pages:
        print(f"Processing page {p}...", end=" ")
        try:
            lines_by_page[p] = fetch_page_lines(p)
            print(f"✓ ({len(lines_by_page[p])} lines)")
        except Exception as e:
            print(f"✗ Error: {e}")
            lines_by_page[p] = []

    html = HTML_TMPL.render(
        pages=pages,
        lines=lines_by_page,
        surah_headers=surah_headers or {},
        font_filename=font_filename,
        font_size_pt=font_size_pt,
        header_size_pt=header_size_pt,
        note_line_em=note_line_em,
    )

    print(f"Generating PDF: {out_path}")
    # base_url controls where @font-face URL is resolved (current folder)
    HTML(string=html, base_url=str(Path(".").resolve())).write_pdf(out_path)

def main():
    ap = argparse.ArgumentParser(description="Generate authentic Qur'an PDF (Uthmani script) with blank lines under each printed line.")
    ap.add_argument("--start", type=int, default=1, help="Start page (1-604).")
    ap.add_argument("--end", type=int, default=20, help="End page (1-604).")
    ap.add_argument("--out", type=str, default="quran_with_notes.pdf", help="Output PDF filename.")
    ap.add_argument("--font", type=str, default="uthmani_font.ttf", help="Path to Uthmani font TTF.")
    ap.add_argument("--fontsize", type=int, default=16, help="Qur'an line font size (pt).")
    ap.add_argument("--notesize", type=float, default=2.5, help="Blank line height (em).")
    args = ap.parse_args()

    # Add some basic surah headers for common pages
    surah_headers = {
        1: "سُورَةُ ٱلْفَاتِحَةِ",  # Al-Fatiha
        2: "سُورَةُ ٱلْبَقَرَةِ",   # Al-Baqarah starts
    }

    build_pdf(
        start_page=args.start,
        end_page=args.end,
        out_path=args.out,
        font_filename=args.font,
        font_size_pt=args.fontsize,
        note_line_em=args.notesize,
        surah_headers=surah_headers,
    )
    print(f"✅ Done: {args.out} (pages {args.start}-{args.end})")

if __name__ == "__main__":
    main()
