# Hifz

A memorisation web app that works on your own mushaf scan (Karya Bestari, `../mushaf/karya_bestari.pdf`).

- **Recite**: every word on the page is covered. Recite from memory; `Next line` (space) uncovers a line you got
  right, tapping a word (or `←`) uncovers it as *stuck*, the lightbulb (`H`) peeks at the next word's meaning.
  Tap an uncovered word to mark that you said it wrong. `Z` undoes.
- **Meaning**: the Arabic stays visible and the English glosses are covered; tap the ones you don't know.
- **Today** plans sabaq / sabqi / manzil from your history (SM-2 style spacing per page), repeats a sabaq that
  didn't settle, and forecasts when you'll finish the juz you're in.

Progress lives in the browser's localStorage (Settings → Export/Import to back it up or move devices).

## Running

```sh
npm run dev   # http://localhost:3000 (webpack; node_modules is symlinked from ../../rooted_quran)
npm test      # scheduling + session logic
```

## Adding pages

Page images and word geometry come from `tools/build_web_data.py` at the repo root:

```sh
.venv/bin/python tools/build_web_data.py 22-41   # juz 2
```

It crops each page's text column to `public/pages/<page>.webp` and writes `<page>.json` with line and word boxes.
Lines are found from the dotted rules; words are split using the mushaf's alternating black/gold word colours and
the word counts from the quran.com API. Pages 1–2 use a hand-set layout (`SPECIAL` in the script). Check a page's
boxes with `.venv/bin/python tools/preview_json.py <page> out.png`. Roughly 350 KB per page.
