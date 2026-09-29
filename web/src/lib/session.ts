import type { Mode } from "./progress";
import type { PageData, Token } from "./types";

// ar: the Arabic word cover. en: the English gloss cover underneath it.
export type WordState = {
  ar: "covered" | "clean" | "stuck";
  en: "covered" | "shown" | "hinted" | "missed";
  mistake: boolean;
};

export type Flat = { token: Token; line: number; index: number }[];

export type SessionState = { mode: Mode; words: WordState[]; history: WordState[][] };

export type Action =
  | { type: "nextLine" }
  | { type: "tapArabic"; index: number }
  | { type: "tapEnglish"; index: number }
  | { type: "peekNext" }
  | { type: "hint" }
  | { type: "undo" };

export function flatten(page: PageData): Flat {
  const out: Flat = [];
  page.lines.forEach((ln, li) => ln.words.forEach((token) => out.push({ token, line: li, index: out.length })));
  return out;
}

/** Verse-number markers stay visible, like in a printed mushaf, and never count as words. */
const isMarker = (t: Token) => t.type === "end";

export function initialState(flat: Flat, mode: Mode): SessionState {
  return {
    mode,
    history: [],
    words: flat.map(({ token }) =>
      isMarker(token)
        ? { ar: "clean", en: "shown", mistake: false }
        : { ar: mode === "recite" ? "covered" : "clean", en: "covered", mistake: false },
    ),
  };
}

function firstCovered(flat: Flat, words: WordState[], field: "ar" | "en"): number {
  return flat.findIndex((_, i) => words[i][field] === "covered");
}

export function reduce(flat: Flat, state: SessionState, action: Action): SessionState {
  if (action.type === "undo") {
    const history = state.history.slice(0, -1);
    return state.history.length ? { ...state, words: state.history[state.history.length - 1], history } : state;
  }
  const words = state.words.map((w) => ({ ...w }));
  const recite = state.mode === "recite";

  switch (action.type) {
    case "nextLine": {
      // Reveal the rest of the first line that still has something covered: you recited (or knew) it
      const i = firstCovered(flat, words, recite ? "ar" : "en");
      if (i < 0) return state;
      const line = flat[i].line;
      flat.forEach((f, j) => {
        if (f.line !== line) return;
        if (words[j].ar === "covered") words[j].ar = "clean";
        if (words[j].en === "covered") words[j].en = "shown";
      });
      break;
    }
    case "tapArabic": {
      const w = words[action.index];
      if (isMarker(flat[action.index].token)) return state;
      if (w.ar === "covered") {
        w.ar = "stuck";
        if (w.en === "covered") w.en = "shown";
      } else if (recite) {
        w.mistake = !w.mistake; // you said a revealed word wrong
      } else {
        return state;
      }
      break;
    }
    case "tapEnglish": {
      const w = words[action.index];
      if (w.en !== "covered") return state;
      w.en = recite ? "hinted" : "missed";
      break;
    }
    case "peekNext": {
      const i = firstCovered(flat, words, "ar");
      if (i < 0) return state;
      words[i].ar = "stuck";
      if (words[i].en === "covered") words[i].en = "shown";
      break;
    }
    case "hint": {
      // Peek at the meaning of the next word you haven't recited yet
      const i = flat.findIndex((_, j) => words[j].ar === "covered" && words[j].en === "covered");
      if (i < 0) return state;
      words[i].en = "hinted";
      break;
    }
  }
  return { ...state, words, history: [...state.history, state.words] };
}

export function isComplete(state: SessionState): boolean {
  return state.words.every((w) => (state.mode === "recite" ? w.ar !== "covered" : w.en !== "covered"));
}

/** The line the next action applies to, for highlighting. */
export function activeLine(flat: Flat, state: SessionState): number | null {
  const i = firstCovered(flat, state.words, state.mode === "recite" ? "ar" : "en");
  return i < 0 ? null : flat[i].line;
}

export type Tally = { words: number; lines: number; cleanLines: number; stuck: string[]; hints: string[]; mistakes: string[] };

export function tally(flat: Flat, state: SessionState): Tally {
  const stuck: string[] = [];
  const hints: string[] = [];
  const mistakes: string[] = [];
  const dirty = new Set<number>();
  flat.forEach(({ token, line }, i) => {
    if (isMarker(token)) return;
    const w = state.words[i];
    const miss = state.mode === "recite" ? w.ar === "stuck" : w.en === "missed";
    if (miss) stuck.push(token.key);
    if (state.mode === "recite" && w.en === "hinted") hints.push(token.key);
    if (state.mode === "recite" && w.mistake) mistakes.push(token.key);
    if (miss || w.mistake || (state.mode === "recite" && w.en === "hinted")) dirty.add(line);
  });
  const lines = new Set(flat.map((f) => f.line)).size;
  const words = flat.filter((f) => !isMarker(f.token)).length;
  return { words, lines, cleanLines: lines - dirty.size, stuck, hints, mistakes };
}
