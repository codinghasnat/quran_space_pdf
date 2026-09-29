import { addDays, daysBetween } from "./dates";

export type Kind = "sabaq" | "sabqi" | "manzil" | "free";
export type Mode = "recite" | "meaning";

export type PageProgress = {
  status: "learning" | "memorised";
  learnedOn: string;
  lastReviewed: string;
  reps: number; // consecutive passing reviews (SM-2)
  ease: number;
  interval: number; // days
  due: string;
  lastGrade: number; // 0-5
  meaningGrade?: number; // last understanding check, 0-5
};

export type WordStat = { page: number; stuck: number; hint: number; mistake: number; meaning: number; last: string };

export type Session = {
  at: string; // ISO timestamp
  day: string; // local YYYY-MM-DD
  page: number;
  kind: Kind;
  mode: Mode;
  seconds: number;
  words: number;
  cleanLines: number;
  lines: number;
  stuck: string[]; // word keys revealed because you got stuck (or missed the meaning)
  hints: string[]; // word keys whose meaning you peeked at
  mistakes: string[]; // words revealed cleanly but then marked as said wrong
  grade: number;
};

export type Settings = {
  order: "forward" | "backward"; // forward: from startPage onwards; backward: juz 30 first, then 29...
  startPage: number;
  sabqiSize: number; // how many recent pages to revise daily
  manzilPerDay: number;
};

export type Progress = {
  version: 1;
  setupDone?: boolean;
  settings: Settings;
  pages: Record<number, PageProgress>;
  words: Record<string, WordStat>;
  sessions: Session[];
};

export const TOTAL_PAGES = 604;
export const MEMORISED_AFTER_DAYS = 7; // a page graduates from sabqi to manzil once its interval reaches this

export function emptyProgress(): Progress {
  return {
    version: 1,
    settings: { order: "forward", startPage: 1, sabqiSize: 5, manzilPerDay: 5 },
    pages: {},
    words: {},
    sessions: [],
  };
}

/** 5 = flawless, 4 = a slip or two, 3 = passable, below 3 = needs relearning. Hints count half. */
export function gradeSession(words: number, stuck: number, hints: number, mistakes: number): number {
  const errors = stuck + mistakes + hints * 0.5;
  if (errors === 0) return 5;
  const rate = errors / Math.max(words, 1);
  if (rate <= 0.03) return 4;
  if (rate <= 0.08) return 3;
  if (rate <= 0.18) return 2;
  return 1;
}

/** SM-2 style update of a page after a recitation. */
export function reviewPage(prev: PageProgress | undefined, grade: number, day: string): PageProgress {
  const p: PageProgress = prev
    ? { ...prev }
    : { status: "learning", learnedOn: day, lastReviewed: day, reps: 0, ease: 2.5, interval: 0, due: day, lastGrade: grade };
  if (grade >= 3) {
    p.reps += 1;
    p.interval = p.reps === 1 ? 1 : p.reps === 2 ? 3 : Math.round(p.interval * p.ease);
  } else {
    p.reps = 0;
    p.interval = 1;
  }
  p.ease = Math.max(1.3, p.ease + 0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02));
  p.status = p.interval >= MEMORISED_AFTER_DAYS ? "memorised" : "learning";
  p.lastReviewed = day;
  p.lastGrade = grade;
  p.due = addDays(day, p.interval);
  return p;
}

/** Fold a finished session into progress. Free practice only reschedules pages you are already learning. */
export function applySession(progress: Progress, s: Session): Progress {
  const next: Progress = { ...progress, pages: { ...progress.pages }, words: { ...progress.words }, sessions: [...progress.sessions, s] };
  const tracked = next.pages[s.page];

  if (s.mode === "recite" && (tracked || s.kind === "sabaq")) {
    next.pages[s.page] = reviewPage(tracked, s.grade, s.day);
  } else if (s.mode === "meaning" && tracked) {
    next.pages[s.page] = { ...tracked, meaningGrade: s.grade };
  }

  const bump = (key: string, field: "stuck" | "hint" | "mistake" | "meaning") => {
    const w = next.words[key] ?? { page: s.page, stuck: 0, hint: 0, mistake: 0, meaning: 0, last: s.day };
    next.words[key] = { ...w, [field]: w[field] + 1, last: s.day };
  };
  for (const k of s.stuck) bump(k, s.mode === "meaning" ? "meaning" : "stuck");
  for (const k of s.hints) bump(k, "hint");
  for (const k of s.mistakes) bump(k, "mistake");
  return next;
}

/** Mark a range of pages as already memorised, staggering due dates so they don't all land on one day. */
export function markMemorised(progress: Progress, pages: number[], day: string): Progress {
  const next = { ...progress, pages: { ...progress.pages } };
  pages.forEach((page, i) => {
    if (next.pages[page]) return;
    next.pages[page] = {
      status: "memorised", learnedOn: day, lastReviewed: day, reps: 3, ease: 2.5, interval: 14,
      due: addDays(day, i % 14), lastGrade: 4,
    };
  });
  return next;
}

/** The order you learn new pages in. "backward" is the common Juz 'Amma-first path: juz 30, 29, ... each read forwards. */
export function learningOrder(settings: Settings, juzStarts: number[]): number[] {
  if (settings.order === "forward") {
    return Array.from({ length: TOTAL_PAGES - settings.startPage + 1 }, (_, i) => settings.startPage + i);
  }
  const order: number[] = [];
  for (let j = juzStarts.length - 1; j >= 0; j--) {
    const end = j + 1 < juzStarts.length ? juzStarts[j + 1] - 1 : TOTAL_PAGES;
    for (let p = juzStarts[j]; p <= end; p++) order.push(p);
  }
  return order;
}

// Standard Madani mushaf: first page of each juz
export const JUZ_STARTS = [
  1, 22, 42, 62, 82, 102, 121, 142, 162, 182, 201, 222, 242, 262, 282, 302, 322, 342, 362, 382, 402, 422, 442, 462,
  482, 502, 522, 542, 562, 582,
];

export function juzOfPage(page: number): number {
  let j = 0;
  while (j + 1 < JUZ_STARTS.length && JUZ_STARTS[j + 1] <= page) j++;
  return j + 1;
}

export type SabaqPlan =
  | { type: "new"; page: number }
  | { type: "repeat"; page: number; reason: string }
  | { type: "done"; page: number; next: number | null }
  | { type: "finished" };

export type DayPlan = {
  sabaq: SabaqPlan;
  sabqi: number[];
  manzil: number[];
  meaningCheck: number | null;
  doneToday: Set<string>; // `${kind}:${page}`
};

/** Work out today's sabaq / sabqi / manzil from history. */
export function planDay(progress: Progress, day: string): DayPlan {
  const { settings, pages, sessions } = progress;
  const order = learningOrder(settings, JUZ_STARTS);
  const today = sessions.filter((s) => s.day === day);
  const doneToday = new Set(today.map((s) => `${s.kind}:${s.page}`));
  const nextNew = order.find((p) => !pages[p]) ?? null;

  // Sabaq: repeat yesterday's page if it didn't stick, otherwise move on to the next new page
  let sabaq: SabaqPlan;
  const sabaqToday = today.filter((s) => s.kind === "sabaq" && s.mode === "recite");
  const lastSabaq = [...sessions].reverse().find((s) => s.kind === "sabaq" && s.mode === "recite" && s.day !== day);
  const lastSabaqPage = lastSabaq ? pages[lastSabaq.page] : undefined;
  if (sabaqToday.length > 0) {
    const page = sabaqToday[sabaqToday.length - 1].page;
    const weak = pages[page] && pages[page].lastGrade < 3;
    sabaq = { type: "done", page, next: weak ? page : order.find((p) => !pages[p]) ?? null };
  } else if (lastSabaq && lastSabaqPage && lastSabaqPage.lastGrade < 3 && lastSabaqPage.status === "learning") {
    sabaq = { type: "repeat", page: lastSabaq.page, reason: "It hadn't settled last time — one more go before moving on." };
  } else if (nextNew !== null) {
    sabaq = { type: "new", page: nextNew };
  } else {
    sabaq = { type: "finished" };
  }
  const sabaqPage = sabaq.type === "finished" ? null : sabaq.page;

  // Sabqi: the most recent pages still being consolidated
  const sabqi = Object.entries(pages)
    .filter(([p, v]) => v.status === "learning" && Number(p) !== sabaqPage)
    .sort((a, b) => (a[1].learnedOn < b[1].learnedOn ? 1 : a[1].learnedOn > b[1].learnedOn ? -1 : Number(b[0]) - Number(a[0])))
    .slice(0, settings.sabqiSize)
    .map(([p]) => Number(p))
    .sort((a, b) => order.indexOf(a) - order.indexOf(b));

  // Manzil: memorised pages that are due (or were done today), most overdue and weakest first
  const manzil = Object.entries(pages)
    .filter(([p, v]) => v.status === "memorised" && (v.due <= day || doneToday.has(`manzil:${p}`)))
    .sort((a, b) => daysBetween(b[1].due, a[1].due) || a[1].lastGrade - b[1].lastGrade)
    .slice(0, settings.manzilPerDay)
    .map(([p]) => Number(p));

  // Understanding: the most recent page you know by heart but haven't checked the meaning of (or got wrong)
  const meaningCheck =
    Object.entries(pages)
      .filter(([, v]) => v.lastGrade >= 3 && (v.meaningGrade === undefined || v.meaningGrade < 4))
      .sort((a, b) => (a[1].learnedOn < b[1].learnedOn ? 1 : -1))
      .map(([p]) => Number(p))[0] ?? null;

  return { sabaq, sabqi, manzil, meaningCheck, doneToday };
}

/** Consecutive days with at least one session, counting back from today (or yesterday if today is still open). */
export function streak(sessions: Session[], day: string): number {
  const days = new Set(sessions.map((s) => s.day));
  let d = days.has(day) ? day : addDays(day, -1);
  let n = 0;
  while (days.has(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

export type Forecast = { pagesPerWeek: number; nextPages: number[]; juz: number; juzDoneOn: string | null };

/** Pace over the last 28 days, and when the juz you're in will be finished at that pace. */
export function forecast(progress: Progress, day: string): Forecast | null {
  const order = learningOrder(progress.settings, JUZ_STARTS);
  const learned = new Set(
    progress.sessions.filter((s) => s.kind === "sabaq" && s.mode === "recite" && daysBetween(s.day, day) < 28).map((s) => s.page),
  );
  const remaining = order.filter((p) => !progress.pages[p]);
  if (remaining.length === 0) return null;
  const juz = juzOfPage(remaining[0]);
  const leftInJuz = remaining.filter((p) => juzOfPage(p) === juz).length;
  const firstSession = progress.sessions[0]?.day;
  const window = firstSession ? Math.min(28, Math.max(7, daysBetween(firstSession, day) + 1)) : 28;
  const perDay = learned.size / window;
  return {
    pagesPerWeek: Math.round(perDay * 7 * 10) / 10,
    nextPages: remaining.slice(0, 3),
    juz,
    juzDoneOn: perDay > 0 ? addDays(day, Math.ceil(leftInJuz / perDay)) : null,
  };
}
