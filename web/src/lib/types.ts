// Shapes of the files written by tools/build_web_data.py into public/pages/

export type Token = {
  key: string; // "surah:ayah:position"
  type: "word" | "end"; // "end" is the verse-number marker
  ar: string;
  en: string;
  x0: number; // horizontal span as a fraction of the page image width
  x1: number;
};

export type Line = {
  line: number;
  y0: number; // fractions of the page image height
  ySplit: number; // Arabic row above, English gloss row below
  y1: number;
  words: Token[]; // reading order (right to left)
};

export type PageData = {
  page: number;
  juz: number;
  width: number;
  height: number;
  firstVerse: string;
  lastVerse: string;
  lines: Line[];
};

export type PageIndexEntry = Pick<PageData, "page" | "juz" | "firstVerse" | "lastVerse">;
