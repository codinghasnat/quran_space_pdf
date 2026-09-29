# quran_space_pdf

Tools for memorising the Qur'an with plenty of room for notes.

## What's here

- **PDFs with note lines** – `quran_with_notes_pdf.py` builds the full mushaf with blank writing lines between Qur'an lines;
  `generate_juz_surah.py` produces per-juz (`juz/`) and per-surah (`surah/`) versions of the same layout.
- **Hifz web app** (`web/`) – a memorisation/revision app that runs on your own mushaf scan. Cover the page, recite from
  memory, tap the words you get stuck on or say wrong, and get a daily sabaq / sabqi / manzil plan. See
  [`web/README.md`](web/README.md).
- **Tools** (`tools/`) – `build_web_data.py` turns pages of the scan into the images and word boxes the web app uses.

## Setup

```sh
python -m venv .venv                  # then pip install what the scripts import (no requirements.txt yet)
.venv/bin/python generate_juz_surah.py   # regenerate juz/ and surah/
```

Not checked in (see `.gitignore`), because they're huge or reproducible:

| Path | How to get it |
| --- | --- |
| `mushaf/karya_bestari.pdf` | Your own scan of the Karya Bestari mushaf (~400 MB); copy it in manually |
| `web/public/pages/` | `.venv/bin/python tools/build_web_data.py <first>-<last>` (needs the scan above) |
| `juz/`, `surah/` | `python generate_juz_surah.py` |

## TODO

Hifz app – the main goal is **less friction**: make it as easy as possible to record mistakes and blunders, and make
reviewing what's already memorised feel natural.

- [ ] Rethink the review flow: walk through how I actually review memorised material (which pages, in what order, how
      often) and design the app around that rather than around adding new pages.
- [ ] Faster mistake capture: tapping words is good, but find ways to record a mistake with even fewer taps/steps
      (e.g. mark a whole line/ayah, quick "stuck vs. wrong" gestures, capture mid-recitation without breaking flow).
- [ ] Review already-memorised pages: a lightweight "just review" mode that surfaces weak spots from past mistakes first.
- [ ] Make it easy to log a blunder after the fact (e.g. from a prayer or a conversation) without opening a full session.
- [ ] Add more pages (only juz 1 and part of juz 2 have been built so far).
