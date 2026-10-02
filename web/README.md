# Hifz

A personal hifz (Qur'an memorisation) app that runs on your own mushaf scan (Karya Bestari,
`../mushaf/karya_bestari.pdf`). The product spec lives in the "Hifz App Spec" Claude Doc.

- **Today**: tell it how many minutes you have; it plans sabaq, sabqi and dawr (sabqi first, always), shows your
  hafiz date once a 30-day calibration is done, and runs a weekly check-in that slowly grows the sabaq and trims
  repetitions while sabqi stays healthy.
- **Sabaq**: listen (looping ayah player, RootedQuran reciters) → read (tap a word for its meaning) → blur (each
  clean read frosts a line further) → recite covered, x clean times → eyes closed, x clean rounds → settled.
- **Sabqi / Dawr**: recite page by page with covers (Space checks a line; uncovering first is a peek and is saved as
  a trigger word) or with eyes closed and a 1–4 rating. Sabqi joins each page to the previous one's last line; dawr
  is split into chunks and has a time slider.
- **Mushaf**: heatmap of every page (strong / okay / practise again / not memorised), by juz and by surah, plus your
  trigger words. **Analytics**: growth, minutes by stage, sabqi health, the two tuning variables, personal bests.

Progress is stored on this device in IndexedDB (Settings → Export/Import to back it up or move browsers).

## Running

```sh
npm install
npm run dev   # http://localhost:3000 (webpack)
npm test      # retention model, planner, tuning, projection, covered recitation
```

## How it works

`src/lib/hifz/` holds the model; everything is derived from raw events so it can be retuned later.

| File | What it does |
| --- | --- |
| `strength.ts` | Page stability S and recall R = e^(−t/S); heatmap colours |
| `plan.ts` | Today's sabaq / sabqi / dawr from history and the time budget |
| `tuning.ts` | Weekly review of sabaq size and repetitions, gated by sabqi health |
| `projection.ts` | Time-to-hafiz simulation, kept steady (moves only for >4 weeks, at most weekly) |
| `portion.ts` | Covered recitation over any lines and pages (check, peek, said wrong, slider) |
| `store.ts` | IndexedDB store, export/import |

## Adding pages

Page images, word boxes and the line index come from scripts at the repo root:

```sh
.venv/bin/python tools/build_web_data.py 1-604   # public/pages/<page>.webp + .json
.venv/bin/python tools/build_line_index.py       # public/pages/lines.json (needed by the planner)
```

Lines are found from the dotted rules and words split by the mushaf's black/gold word colours, matched to the
quran.com word list. Check a page's boxes with `.venv/bin/python tools/preview_json.py <page> out.png`. Lines whose
covers sit wrong can be flagged in any session; they're listed in Settings.
