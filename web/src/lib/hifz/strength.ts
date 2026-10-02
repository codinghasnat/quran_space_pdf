import { daysBetween } from "../dates";
import { lineId, type LineInfo, type QuranIndex } from "./quran";
import type { Claim, HifzData, Recitation } from "./types";

// Retention model. Each memorised page has a stability S in days, and the chance of reciting it cleanly
// today is R = exp(-t / S), t = days since it was last recited. Clean recitations grow S (more when R had
// fallen further, as with FSRS); mistakes cut it. Starting values are deliberately cautious.

export const S_NEW = 1; // a freshly settled sabaq
export const S_SOLID = 14; // claimed at onboarding as solid, until placement tests say otherwise
export const S_RUSTY = 2;
export const S_FORGOTTEN = 0.5;
export const S_MIN = 0.5;
export const S_MAX = 365;
export const STRONG = 0.85;
export const OKAY = 0.65;
const REBUILT_AFTER = 3; // clean recitations on different days before a rusty page counts as memorised again

export type Colour = "blank" | "strong" | "okay" | "weak";

export type PageState = {
  page: number;
  totalLines: number;
  memorisedLines: number;
  status: "none" | "learning" | "memorised" | "rebuilding";
  memorisedOn: string | null; // day the last of its lines was memorised
  stability: number;
  last: string | null; // day of the last recitation that counted
  R: number;
  lastSlips: number; // peeks + mistakes in the most recent recitation
  colour: Colour;
};

/** How well a single recitation went, 0 (lost) to 1 (clean). */
export function quality(r: Recitation): number {
  if (r.mode === "eyesClosed" && r.rating) return { 1: 0.1, 2: 0.6, 3: 0.9, 4: 1 }[r.rating];
  if (r.clean) return 1;
  const perLine = (r.peeks + r.mistakes) / Math.max(1, r.lines.length);
  if (perLine <= 0.15) return 0.6;
  if (perLine <= 0.5) return 0.35;
  return 0.1;
}

/** Next stability after a recitation `dt` days after the last one. */
export function nextStability(S: number, dt: number, q: number): number {
  if (dt < 1) {
    // Same-day repetitions build fluency but not long-term stability; a failure still counts against it
    return q >= 0.5 ? S : Math.max(S_MIN, S * 0.8);
  }
  const R = Math.exp(-dt / S);
  if (q >= 0.85) return Math.min(S_MAX, S * (1.2 + 2 * (1 - R)));
  if (q >= 0.5) return Math.max(S_MIN, S * (0.7 + 0.3 * q));
  return Math.max(S_MIN, S * (0.25 + 0.5 * q));
}

export function colourFor(R: number, lastSlips: number, memorised: boolean): Colour {
  if (!memorised) return "blank";
  if (R < OKAY || lastSlips >= 2) return "weak";
  return R >= STRONG ? "strong" : "okay";
}

const ayahKey = (surah: number, ayah: number) => `${surah}:${ayah}`;

/** Ayahs you've said you know ("surah:ayah" -> how well, and since when): onboarding claims, then your edits. */
export function claimedAyahs(data: HifzData, index: QuranIndex): Map<string, { claim: Claim; day: string }> {
  const out = new Map<string, { claim: Claim; day: string }>();
  for (const [surah, claim] of Object.entries(data.profile.claims)) {
    const upTo = data.profile.claimUpTo?.[Number(surah)];
    const last = index.bySurah.get(Number(surah))?.at(-1)?.a2 ?? 0;
    for (let a = 1; a <= (upTo ?? last); a++) out.set(ayahKey(Number(surah), a), { claim, day: data.profile.createdOn });
  }
  for (const [k, m] of Object.entries(data.profile.ayahMarks ?? {})) {
    if (m.c === "none") out.delete(k);
    else out.set(k, { claim: m.c, day: m.day });
  }
  return out;
}

const lineAyahs = (l: LineInfo) => Array.from({ length: l.a2 - l.a1 + 1 }, (_, i) => ayahKey(l.surah, l.a1 + i));

/** lineId -> the day that line was memorised: every ayah on it claimed, or a settled sabaq (unless you've since
 *  marked one of its ayahs as not memorised). */
export function memorisedLineDays(data: HifzData, index: QuranIndex): Map<string, string> {
  const claimed = claimedAyahs(data, index);
  const unmarked = new Set(Object.entries(data.profile.ayahMarks ?? {}).filter(([, m]) => m.c === "none").map(([k]) => k));
  const out = new Map<string, string>();
  if (claimed.size) {
    for (const l of index.lines) {
      const days = lineAyahs(l).map((k) => claimed.get(k)?.day);
      if (days.every(Boolean)) out.set(lineId(l), days.reduce((a, b) => (a! > b! ? a : b))!);
    }
  }
  const byId = new Map(index.lines.map((l) => [lineId(l), l]));
  for (const s of [...data.sabaqs].sort((a, b) => (a.day < b.day ? -1 : 1))) {
    if (!s.settled) continue;
    for (const ref of s.lines) {
      const l = byId.get(lineId(ref));
      if (!l || out.has(lineId(l)) || lineAyahs(l).some((k) => unmarked.has(k))) continue;
      out.set(lineId(l), s.day);
    }
  }
  return out;
}

const CLAIM_RANK: Record<Claim, number> = { forgotten: 0, rusty: 1, solid: 2 };

/** A page's claim: the weakest claim among the ayahs on it that you've said you know. */
export function pageClaims(data: HifzData, index: QuranIndex): Map<number, Claim> {
  const claimed = claimedAyahs(data, index);
  const out = new Map<number, Claim>();
  for (const l of index.lines) {
    for (const k of lineAyahs(l)) {
      const c = claimed.get(k)?.claim;
      if (!c) continue;
      const prev = out.get(l.page);
      if (!prev || CLAIM_RANK[c] < CLAIM_RANK[prev]) out.set(l.page, c);
    }
  }
  return out;
}

/** Derive every page's state from the raw history. */
export function pageStates(data: HifzData, index: QuranIndex, today: string): Map<number, PageState> {
  const memorisedOn = memorisedLineDays(data, index);
  const claims = pageClaims(data, index);

  const byPage = new Map<number, Recitation[]>();
  for (const r of data.recitations) {
    if (!byPage.has(r.page)) byPage.set(r.page, []);
    byPage.get(r.page)!.push(r);
  }

  const out = new Map<number, PageState>();
  for (const [page, lines] of index.byPage) {
    const days = lines.map((l) => memorisedOn.get(lineId(l))).filter((d): d is string => !!d);
    const claim = claims.get(page);
    const state: PageState = {
      page,
      totalLines: lines.length,
      memorisedLines: days.length,
      status: "none",
      memorisedOn: days.length === lines.length ? days.reduce((a, b) => (a > b ? a : b)) : null,
      stability: 0,
      last: null,
      R: 0,
      lastSlips: 0,
      colour: "blank",
    };
    if (days.length === 0) {
      out.set(page, state);
      continue;
    }

    const first = days.reduce((a, b) => (a < b ? a : b));
    let S = claim === "solid" ? S_SOLID : claim === "rusty" ? S_RUSTY : claim === "forgotten" ? S_FORGOTTEN : S_NEW;
    let last = first;
    const cleanDays = new Set<string>();
    const events = (byPage.get(page) ?? [])
      .filter((r) => r.day >= first && !(r.stage === "sabaq" && r.day === first))
      .sort((a, b) => (a.at < b.at ? -1 : 1));
    for (const r of events) {
      const q = quality(r);
      S = nextStability(S, daysBetween(last, r.day), q);
      last = r.day;
      state.lastSlips = r.mode === "eyesClosed" ? (q < 0.85 ? 2 : 0) : r.peeks + r.mistakes;
      if (q >= 0.85) cleanDays.add(r.day);
    }

    const rebuilding = (claim === "rusty" || claim === "forgotten") && cleanDays.size < REBUILT_AFTER;
    const complete = state.memorisedOn !== null;
    state.status = rebuilding ? "rebuilding" : complete ? "memorised" : "learning";
    state.stability = S;
    state.last = last;
    state.R = Math.exp(-Math.max(0, daysBetween(last, today)) / S);
    state.colour = rebuilding ? "weak" : colourFor(state.R, state.lastSlips, true);
    out.set(page, state);
  }
  return out;
}
