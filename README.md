# quran_space_pdf

Tools for memorising the Qur'an (hifz): printable mushaf PDFs with room to write notes, and a web app for reciting,
marking mistakes and planning revision on your own mushaf scan.

## What's here

| Path | What it does |
| --- | --- |
| `quran_with_notes_pdf.py` | Builds a mushaf PDF for a range of Madani pages, with a blank writing line under every line of text |
| `generate_juz_surah.py` | Builds the same layout split per juz (`juz/juz_1.pdf` … `juz_30.pdf`) and per surah (`surah/1.pdf` … `114.pdf`) |
| `web/` | Hifz web app (Next.js): daily sabaq / sabqi / dawr plan from your time, gradual blur, covered and eyes-closed recitation, heatmap, analytics, projected hafiz date |
| `tools/build_web_data.py` | Turns pages of the mushaf scan into the page images and word boxes the web app uses |
| `tools/build_line_index.py` | Summarises the built pages into `lines.json` (surah and ayahs per line) for the planner |
| `tools/layout_lib.py` | Shared line/word detection helpers for the scan (dotted-rule grid, black/gold word splitting) |
| `tools/preview_json.py` | Draws a page's detected word boxes over its image, to check detection quality |

### PDFs with note lines

Text comes from the [quran.com API](https://api.quran.com/api/v4) in Uthmani script, rendered with WeasyPrint using
the bundled Uthmani font. Each Qur'an line is followed by a ruled blank line for handwritten notes, and each page is
labelled with its Madani page number.

```sh
# Any page range of the mushaf (1–604)
.venv/bin/python quran_with_notes_pdf.py --start 1 --end 21 --out juz1.pdf [--fontsize 16] [--notesize 2.5]

# All 30 juz and 114 surah files (or just one set with --only juz / --only surah)
.venv/bin/python generate_juz_surah.py
```

`generate_juz_surah.py` downloads all 604 pages once into `.cache/`, then filters by verse, so every file holds only
its own juz or surah, even where a page is shared. Each surah gets a heading, and every surah except Al-Fatihah and
At-Tawbah gets a Bismillah. It reuses the template from `quran_with_notes_pdf.py`, so layout changes there apply to both.

These PDFs re-flow the text, so they don't keep the mushaf's line layout. Use them for notes, not as the copy you
memorise from.

### Hifz web app (`web/`)

Runs on page images from your own Karya Bestari mushaf scan, so you revise on the same page layout you memorise from.

- **Recite:** every word is covered. Uncover line by line as you recite. Tap a word you got stuck on, or tap an
  uncovered word you said wrong. Hints and undo are available.
- **Meaning:** the Arabic stays visible and the English word-by-word glosses are covered; test yourself on meanings.
- **Today:** plans sabaq / sabqi / manzil from your history (SM-2 style spacing per page), repeats a sabaq that didn't
  settle, and forecasts when you'll finish the current juz.

Progress is stored in the browser (export/import in Settings). See [`web/README.md`](web/README.md) for details.

```sh
cd web
npm run dev   # http://localhost:3000
npm test      # scheduling + session logic
```

### Building pages for the web app

```sh
.venv/bin/python tools/build_web_data.py 22-41          # e.g. juz 2
.venv/bin/python tools/preview_json.py 22 preview.png   # check the word boxes
```

For each page, it extracts the scan from `mushaf/karya_bestari.pdf` (PDF page = mushaf page + 7) and crops it to
the text column, saving `web/public/pages/<page>.webp`. It finds the 15 lines from the dotted rules and splits words
using the mushaf's alternating black/gold word colours, checked against quran.com's word counts. The word boxes,
Arabic and English glosses go into `<page>.json`, and `index.json` is updated. Pages 1–2 use a hand-set layout.
Each page takes about 350 KB.

## Setup

```sh
python -m venv .venv
.venv/bin/pip install httpx jinja2 weasyprint numpy pillow   # no requirements.txt yet
```

`build_web_data.py` also needs `pdfimages` (from poppler: `brew install poppler`).

Not checked in (see `.gitignore`), because they're huge or reproducible:

| Path | How to get it |
| --- | --- |
| `mushaf/karya_bestari.pdf` | Your own scan of the Karya Bestari mushaf (~400 MB); copy it in manually |
| `web/public/pages/` | `.venv/bin/python tools/build_web_data.py <first>-<last>` (needs the scan above) |
| `juz/`, `surah/` | `.venv/bin/python generate_juz_surah.py` |
| `.cache/` | API responses, filled automatically by the scripts |

## TODO

Hifz app: the main goal is **less friction**. Make it as easy as possible to record mistakes and blunders, and make
reviewing what's already memorised feel natural.

- [ ] Rethink the review flow: walk through how I actually review memorised material (which pages, in what order, how
      often) and design the app around that rather than around adding new pages.
- [ ] Faster mistake capture: tapping words is good, but find ways to record a mistake with even fewer taps/steps
      (e.g. mark a whole line/ayah, quick "stuck vs. wrong" gestures, capture mid-recitation without breaking flow).
- [ ] Review already-memorised pages: a lightweight "just review" mode that surfaces weak spots from past mistakes first.
- [ ] Make it easy to log a blunder after the fact (e.g. from a prayer or a conversation) without opening a full session.
- [ ] Add more pages (only juz 1 and part of juz 2 have been built so far).
