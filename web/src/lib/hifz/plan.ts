import { daysBetween } from "../dates";
import { learningOrder, lineId, type LineInfo, type QuranIndex } from "./quran";
import { memorisedLineDays, pageClaims, quality, type PageState } from "./strength";
import type { HifzData, Recitation, SabaqRecord, Stage } from "./types";

export const DEFAULT_MINUTES = { sabaq: 45, sabqiPerPage: 6, dawrPerPage: 4 };
export const SABQI_RECENT_SABAQS = 3;
export const SABQI_QUARTER_JUZ = 5; // pages
export const REBUILD_PER_DAY = 2;
export const WEAK_EXTRA_DAWR = 3;
const MIN_SABAQ_LINES = 2;

export type SabaqPlan = {
  lines: LineInfo[];
  repeat: boolean;
  reason: string | null;
  minutes: number;
  shrunk: boolean; // made smaller to fit today's time
};

export type DayPlan = {
  day: string;
  budget: number;
  restDay: boolean;
  sabaq: SabaqPlan | null;
  sabaqToday: SabaqRecord | null;
  finished: boolean; // nothing left to learn
  sabqi: { pages: number[]; minutes: number };
  dawr: { pages: number[]; chunks: number[][]; minutes: number; perDay: number };
  done: Record<Exclude<Stage, "drill" | "placement">, Set<number>>;
  notes: string[];
};

/** Average minutes per page for a stage over the last two weeks, or the default until there's enough data. */
export function minutesPerPage(recitations: Recitation[], stage: Stage, today: string, fallback: number): number {
  const recent = recitations.filter((r) => r.stage === stage && daysBetween(r.day, today) <= 14);
  const pages = new Map<string, number>();
  for (const r of recent) pages.set(`${r.day}:${r.page}`, (pages.get(`${r.day}:${r.page}`) ?? 0) + r.seconds);
  if (pages.size < 3) return fallback;
  const total = [...pages.values()].reduce((a, b) => a + b, 0);
  return Math.max(1, total / pages.size / 60);
}

export function sabaqMinutesPerLine(sabaqs: SabaqRecord[]): number {
  const recent = sabaqs.filter((s) => s.settled).slice(-10);
  if (recent.length < 3) return DEFAULT_MINUTES.sabaq / 7;
  const lines = recent.reduce((a, s) => a + s.lines.length, 0);
  return recent.reduce((a, s) => a + s.seconds, 0) / 60 / Math.max(1, lines);
}

/** The next unlearned lines in learning order, kept inside one surah. */
export function nextSabaqLines(data: HifzData, index: QuranIndex, memorised: Set<string>, count: number): LineInfo[] {
  const order = learningOrder(index, data.settings.direction);
  let from = 0;
  if (data.settings.start) {
    const s = data.settings.start;
    const i = order.findIndex((l) => l.page === s.page && l.line === s.line);
    if (i >= 0) from = i;
  }
  const first = order.findIndex((l, i) => i >= from && !memorised.has(lineId(l)));
  if (first < 0) return [];
  const surah = order[first].surah;
  const out: LineInfo[] = [];
  for (let i = first; i < order.length && order[i].surah === surah && out.length < count; i++) {
    if (!memorised.has(lineId(order[i]))) out.push(order[i]);
  }
  // Don't leave a scrap of one or two lines at the end of a surah for another day
  const rest = order.slice(first).filter((l) => l.surah === surah && !memorised.has(lineId(l)));
  if (rest.length - out.length <= 2) return rest;
  return out;
}

/** Did a settled sabaq stumble at its first sabqi check on a later day? */
function failedFirstCheck(s: SabaqRecord, recitations: Recitation[]): boolean {
  const pages = new Set(s.lines.map((l) => l.page));
  const later = recitations.filter((r) => r.day > s.day && pages.has(r.page) && r.stage !== "sabaq");
  if (later.length === 0) return false;
  const firstDay = later.reduce((a, r) => (r.day < a ? r.day : a), later[0].day);
  return later.filter((r) => r.day === firstDay).some((r) => quality(r) < 0.85);
}

export function planDay(
  data: HifzData,
  index: QuranIndex,
  states: Map<number, PageState>,
  day: string,
  budgetOverride?: number,
): DayPlan {
  const { settings, recitations, sabaqs } = data;
  const budget = budgetOverride ?? settings.dailyMinutes;
  const notes: string[] = [];
  const restDay = !settings.activeDays.includes(new Date(`${day}T12:00:00`).getDay());

  const memorised = new Set(memorisedLineDays(data, index).keys());

  const done = { sabaq: new Set<number>(), sabqi: new Set<number>(), dawr: new Set<number>() };
  for (const r of recitations) {
    if (r.day === day && (r.stage === "sabaq" || r.stage === "sabqi" || r.stage === "dawr")) done[r.stage].add(r.page);
  }

  // --- Sabqi: the last 3 sabaqs, the quarter juz before them, and a little of the rebuild queue
  const settled = sabaqs.filter((s) => s.settled && s.day < day).sort((a, b) => (a.day < b.day ? 1 : -1));
  const claimed = pageClaims(data, index);
  const recentSabaqPages: number[] = [];
  for (const s of settled.slice(0, SABQI_RECENT_SABAQS)) {
    for (const l of s.lines) if (!recentSabaqPages.includes(l.page)) recentSabaqPages.push(l.page);
  }
  const quarter = [...states.values()]
    .filter((s) => s.status === "memorised" && !claimed.has(s.page) && !recentSabaqPages.includes(s.page))
    .sort((a, b) => (a.memorisedOn! < b.memorisedOn! ? 1 : a.memorisedOn! > b.memorisedOn! ? -1 : b.page - a.page))
    .slice(0, SABQI_QUARTER_JUZ)
    .map((s) => s.page);
  const rebuilding = [...states.values()]
    .filter((s) => s.status === "rebuilding")
    .sort((a, b) => a.R - b.R)
    .slice(0, REBUILD_PER_DAY)
    .map((s) => s.page);
  const sabqiPages = [...new Set([...recentSabaqPages, ...quarter, ...rebuilding])].sort((a, b) => a - b);
  const sabqiPer = minutesPerPage(recitations, "sabqi", day, DEFAULT_MINUTES.sabqiPerPage);
  const sabqiMinutes = Math.round(sabqiPages.length * sabqiPer);

  // --- Sabaq: today's record, a repeat, or the next new lines sized to the time left
  const sabaqToday = sabaqs.filter((s) => s.day === day).at(-1) ?? null;
  const lastBefore = sabaqs.filter((s) => s.day < day).sort((a, b) => (a.day < b.day ? 1 : -1))[0];
  let sabaq: SabaqPlan | null = null;
  let finished = false;
  const perLine = sabaqMinutesPerLine(sabaqs);
  if (lastBefore && (!lastBefore.settled || failedFirstCheck(lastBefore, recitations))) {
    const lines = lastBefore.lines
      .map((l) => index.byPage.get(l.page)?.find((x) => x.line === l.line))
      .filter((l): l is LineInfo => !!l);
    sabaq = {
      lines,
      repeat: true,
      reason: lastBefore.settled
        ? "It slipped at its first sabqi check, so it gets one more day before moving on."
        : "It hadn't settled yet, so it gets one more go before moving on.",
      minutes: Math.round(lines.length * perLine),
      shrunk: false,
    };
  } else {
    let lines = nextSabaqLines(data, index, memorised, settings.sabaqLines);
    finished = lines.length === 0;
    const left = budget - sabqiMinutes;
    let shrunk = false;
    if (!finished && left < lines.length * perLine) {
      const fit = Math.floor(left / perLine);
      if (fit < MIN_SABAQ_LINES) {
        notes.push("Today's time covers sabqi but not a new sabaq. Sabqi comes first; the sabaq waits for tomorrow.");
        lines = [];
      } else {
        lines = lines.slice(0, fit);
        shrunk = true;
        notes.push(`Sabaq trimmed to ${fit} lines to fit today's ${budget} minutes.`);
      }
    }
    if (lines.length) sabaq = { lines, repeat: false, reason: null, minutes: Math.round(lines.length * perLine), shrunk };
  }

  // --- Dawr: the rotation, weakest first; spread through the day if the time runs short
  const sabqiSet = new Set(sabqiPages);
  if (sabaq) for (const l of sabaq.lines) sabqiSet.add(l.page);
  const pool = [...states.values()]
    .filter((s) => s.status === "memorised" && !sabqiSet.has(s.page))
    .map((s) => s.page)
    .sort((a, b) => a - b);
  const memorisedPages = [...states.values()].filter((s) => s.status === "memorised").length;
  const perDay = Math.min(pool.length, memorisedPages >= 200 ? 20 : 10);
  const lastDawr = recitations
    .filter((r) => r.stage === "dawr" && r.day < day)
    .sort((a, b) => (a.at < b.at ? 1 : -1))[0];
  let start = 0;
  if (lastDawr) {
    const i = pool.findIndex((p) => p > lastDawr.page);
    start = i < 0 ? 0 : i;
  }
  const rotation = Array.from({ length: perDay }, (_, i) => pool[(start + i) % Math.max(1, pool.length)]).filter(
    (p) => p !== undefined,
  );
  const weak = pool
    .filter((p) => states.get(p)?.colour === "weak" && !rotation.includes(p))
    .sort((a, b) => states.get(a)!.R - states.get(b)!.R)
    .slice(0, WEAK_EXTRA_DAWR);
  const ordered = [...rotation].sort((a, b) => {
    const wa = states.get(a)?.colour === "weak" ? 0 : 1;
    const wb = states.get(b)?.colour === "weak" ? 0 : 1;
    return wa - wb;
  });
  const dawrPages = [...weak, ...ordered];
  const dawrPer = minutesPerPage(recitations, "dawr", day, DEFAULT_MINUTES.dawrPerPage);
  const dawrMinutes = Math.round(dawrPages.length * dawrPer);
  const chunkSize = Math.max(1, settings.dawrChunkPages);
  const chunks: number[][] = [];
  for (let i = 0; i < dawrPages.length; i += chunkSize) chunks.push(dawrPages.slice(i, i + chunkSize));
  const used = sabqiMinutes + (sabaq?.minutes ?? 0);
  if (dawrPages.length && used + dawrMinutes > budget) {
    notes.push(`Dawr runs past today's time, so it's split into ${chunks.length} short chunks to do through the day.`);
  }

  return {
    day,
    budget,
    restDay,
    sabaq: sabaqToday ? null : sabaq,
    sabaqToday,
    finished,
    sabqi: { pages: sabqiPages, minutes: sabqiMinutes },
    dawr: { pages: dawrPages, chunks, minutes: dawrMinutes, perDay },
    done,
    notes,
  };
}
