import type { PageData, Token } from "../types";

// Covered recitation over any set of lines, across one or more pages. You recite a covered line, then Check
// reveals it; uncovering a word before checking is a peek (a trigger word); tapping a revealed word marks it
// as said wrong. A portion is clean when it was finished with no peeks and no mistakes.

export type PortionWord = {
  page: number;
  lineIdx: number; // index into PageData.lines
  line: number; // mushaf line number
  token: Token;
};

export type WordMark = "covered" | "checked" | "peeked";

export type PortionState = {
  marks: WordMark[];
  wrong: boolean[];
  revealedBySlider: number; // dawr's time slider: words revealed in order
  history: { marks: WordMark[]; wrong: boolean[] }[];
};

export type PortionAction =
  | { type: "check" } // reveal the next covered line after reciting it
  | { type: "tap"; index: number }
  | { type: "slide"; to: number }
  | { type: "undo" }
  | { type: "reset" };

/** Words of the chosen lines, pages in order, lines in order, words in reading order. Verse markers are skipped. */
export function portionWords(pages: PageData[], lines: Map<number, number[]> | null): PortionWord[] {
  const out: PortionWord[] = [];
  for (const p of [...pages].sort((a, b) => a.page - b.page)) {
    const want = lines?.get(p.page);
    p.lines.forEach((ln, lineIdx) => {
      if (want && !want.includes(ln.line)) return;
      for (const token of ln.words) if (token.type === "word") out.push({ page: p.page, lineIdx, line: ln.line, token });
    });
  }
  return out;
}

export function initialPortion(words: PortionWord[]): PortionState {
  return { marks: words.map(() => "covered"), wrong: words.map(() => false), revealedBySlider: 0, history: [] };
}

const lineKey = (w: PortionWord) => `${w.page}:${w.line}`;

export function reducePortion(words: PortionWord[], s: PortionState, a: PortionAction): PortionState {
  if (a.type === "reset") return initialPortion(words);
  if (a.type === "undo") {
    const prev = s.history.at(-1);
    return prev ? { ...s, ...prev, history: s.history.slice(0, -1) } : s;
  }
  const marks = [...s.marks];
  const wrong = [...s.wrong];
  const snapshot = { marks: s.marks, wrong: s.wrong };
  switch (a.type) {
    case "check": {
      const i = marks.indexOf("covered");
      if (i < 0) return s;
      const key = lineKey(words[i]);
      words.forEach((w, j) => {
        if (lineKey(w) === key && marks[j] === "covered") marks[j] = "checked";
      });
      break;
    }
    case "tap": {
      if (marks[a.index] === "covered") marks[a.index] = "peeked";
      else wrong[a.index] = !wrong[a.index];
      break;
    }
    case "slide": {
      const to = Math.max(0, Math.min(words.length, a.to));
      for (let j = 0; j < to; j++) if (marks[j] === "covered") marks[j] = "checked";
      return { ...s, marks, revealedBySlider: Math.max(s.revealedBySlider, to), history: [...s.history, snapshot] };
    }
  }
  return { ...s, marks, wrong, history: [...s.history, snapshot] };
}

export const portionDone = (s: PortionState) => !s.marks.includes("covered");

/** The line still to recite, for the glow. */
export function activeLineKey(words: PortionWord[], s: PortionState): string | null {
  const i = s.marks.indexOf("covered");
  return i < 0 ? null : lineKey(words[i]);
}

export type PortionResult = {
  clean: boolean;
  byPage: Map<number, { lines: number[]; peeks: number; mistakes: number }>;
  peeked: PortionWord[];
  wrongWords: PortionWord[];
};

export function portionResult(words: PortionWord[], s: PortionState): PortionResult {
  const byPage = new Map<number, { lines: number[]; peeks: number; mistakes: number }>();
  const peeked: PortionWord[] = [];
  const wrongWords: PortionWord[] = [];
  words.forEach((w, i) => {
    if (!byPage.has(w.page)) byPage.set(w.page, { lines: [], peeks: 0, mistakes: 0 });
    const p = byPage.get(w.page)!;
    if (!p.lines.includes(w.line)) p.lines.push(w.line);
    if (s.marks[i] === "peeked") {
      p.peeks++;
      peeked.push(w);
    }
    if (s.wrong[i]) {
      p.mistakes++;
      wrongWords.push(w);
    }
  });
  return { clean: peeked.length === 0 && wrongWords.length === 0, byPage, peeked, wrongWords };
}
