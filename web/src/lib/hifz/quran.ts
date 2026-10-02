import type { Direction, LineRef } from "./types";

export const TOTAL_PAGES = 604;

// Standard Madani mushaf: first page of each juz (every juz starts on a fresh page)
export const JUZ_STARTS = [
  1, 22, 42, 62, 82, 102, 121, 142, 162, 182, 201, 222, 242, 262, 282, 302, 322, 342, 362, 382, 402, 422, 442, 462,
  482, 502, 522, 542, 562, 582,
];

export function juzOfPage(page: number): number {
  let j = 0;
  while (j + 1 < JUZ_STARTS.length && JUZ_STARTS[j + 1] <= page) j++;
  return j + 1;
}

export function juzPages(juz: number): number[] {
  const start = JUZ_STARTS[juz - 1];
  const end = juz < JUZ_STARTS.length ? JUZ_STARTS[juz] - 1 : TOTAL_PAGES;
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

/** A mushaf line holding Qur'an text, from public/pages/lines.json. */
export type LineInfo = LineRef & { surah: number; a1: number; a2: number; words: number };

export type QuranIndex = {
  lines: LineInfo[]; // mushaf order
  byPage: Map<number, LineInfo[]>;
  bySurah: Map<number, LineInfo[]>;
};

export type RawLineIndex = Record<string, [number, number, number, number, number][]>;

export function parseLineIndex(raw: RawLineIndex): QuranIndex {
  const lines: LineInfo[] = [];
  const byPage = new Map<number, LineInfo[]>();
  const bySurah = new Map<number, LineInfo[]>();
  const pages = Object.keys(raw).map(Number).sort((a, b) => a - b);
  for (const page of pages) {
    const pageLines = raw[page].map(([line, surah, a1, a2, words]) => ({ page, line, surah, a1, a2, words }));
    byPage.set(page, pageLines);
    for (const l of pageLines) {
      lines.push(l);
      if (!bySurah.has(l.surah)) bySurah.set(l.surah, []);
      bySurah.get(l.surah)!.push(l);
    }
  }
  return { lines, byPage, bySurah };
}

export const lineId = (l: LineRef) => `${l.page}:${l.line}`;

/** The order new material is learned in. Backward is the common Juz 'Amma-first path: An-Nas, Al-Falaq, ...
 *  each surah read forwards. Forward is the mushaf order. */
export function learningOrder(index: QuranIndex, direction: Direction): LineInfo[] {
  if (direction === "forward") return index.lines;
  const out: LineInfo[] = [];
  for (let s = 114; s >= 1; s--) out.push(...(index.bySurah.get(s) ?? []));
  return out;
}

/** Pages a surah spans, in order. */
export function surahPages(index: QuranIndex, surah: number): number[] {
  return [...new Set((index.bySurah.get(surah) ?? []).map((l) => l.page))];
}
