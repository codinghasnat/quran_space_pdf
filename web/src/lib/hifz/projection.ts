import { addDays, daysBetween } from "../dates";
import { DEFAULT_MINUTES, minutesPerPage, sabaqMinutesPerLine, SABQI_QUARTER_JUZ } from "./plan";
import type { QuranIndex } from "./quran";
import type { PageState } from "./strength";
import type { HifzData } from "./types";

// Time to hafiz: simulate the rest of the journey week by week from the learner's own pace. With a fixed daily
// budget, dawr grows as more is memorised and squeezes the time left for sabaq, so the date reflects that.

export const CALIBRATION_DAYS = 30;
const HERO_MOVE_DAYS = 28; // the hero date only moves for a shift bigger than 4 weeks...
const HERO_MOVE_EVERY = 7; // ...and at most once a week
const MAX_YEARS = 25;

export type Projection = {
  calibrating: number; // days left of calibration, 0 when done
  likely: string | null;
  cautious: string | null;
  linesLeft: number;
  linesPerActiveDay: number;
  adherence: number; // share of days with practice, last 4 weeks
};

export function project(
  data: HifzData,
  index: QuranIndex,
  states: Map<number, PageState>,
  day: string,
): Projection {
  const started = daysBetween(data.profile.createdOn, day);
  const calibrating = Math.max(0, CALIBRATION_DAYS - started);
  const strongLines = [...states.values()]
    .filter((s) => s.colour !== "weak")
    .reduce((a, s) => a + s.memorisedLines, 0);
  const linesLeft = index.lines.length - strongLines;

  const window = Math.max(7, Math.min(28, started + 1));
  const since = addDays(day, -window);
  const activeDays = new Set(data.recitations.filter((r) => r.day > since).map((r) => r.day));
  const adherence = Math.min(1, activeDays.size / window);
  const settledLines = data.sabaqs.filter((s) => s.settled && s.day > since).reduce((a, s) => a + s.lines.length, 0);
  const sabaqDays = new Set(data.sabaqs.filter((s) => s.day > since).map((s) => s.day)).size;
  const linesPerActiveDay = sabaqDays ? settledLines / sabaqDays : 0;

  // Weekly adherence over the last 8 weeks, for the cautious case
  const weekly: number[] = [];
  for (let w = 0; w < Math.min(8, Math.ceil((started + 1) / 7)); w++) {
    const end = addDays(day, -7 * w);
    const start = addDays(end, -7);
    weekly.push(new Set(data.recitations.filter((r) => r.day > start && r.day <= end).map((r) => r.day)).size / 7);
  }
  weekly.sort((a, b) => a - b);
  const weakAdherence = weekly.length ? weekly[Math.floor(weekly.length / 4)] : adherence;

  if (linesLeft <= 0) return { calibrating, likely: day, cautious: day, linesLeft, linesPerActiveDay, adherence };
  if (linesPerActiveDay === 0 || adherence === 0) {
    return { calibrating, likely: null, cautious: null, linesLeft, linesPerActiveDay, adherence };
  }

  const memorisedPages = [...states.values()].filter((s) => s.status === "memorised").length;
  const linesPerPage = index.lines.length / 604;
  const sim = (growth: boolean, adh: number) =>
    simulate({
      day,
      linesLeft,
      memorisedPages,
      linesPerPage,
      budget: data.settings.dailyMinutes,
      sabaqLines: data.settings.sabaqLines,
      settleRate: Math.min(1, linesPerActiveDay / Math.max(1, data.settings.sabaqLines)),
      perLine: sabaqMinutesPerLine(data.sabaqs),
      sabqiMinutes: (3 * data.settings.sabaqLines / linesPerPage + SABQI_QUARTER_JUZ) *
        minutesPerPage(data.recitations, "sabqi", day, DEFAULT_MINUTES.sabqiPerPage),
      dawrPer: minutesPerPage(data.recitations, "dawr", day, DEFAULT_MINUTES.dawrPerPage),
      adherence: Math.max(0.05, adh),
      growth,
    });
  return {
    calibrating,
    likely: sim(true, adherence),
    cautious: sim(false, Math.min(adherence, weakAdherence)),
    linesLeft,
    linesPerActiveDay,
    adherence,
  };
}

type SimInput = {
  day: string;
  linesLeft: number;
  memorisedPages: number;
  linesPerPage: number;
  budget: number;
  sabaqLines: number;
  settleRate: number; // share of planned lines that settle first time (repeats slow things down)
  perLine: number; // sabaq minutes per line
  sabqiMinutes: number;
  dawrPer: number;
  adherence: number;
  growth: boolean;
};

function simulate(p: SimInput): string | null {
  let left = p.linesLeft;
  let pages = p.memorisedPages;
  let size = p.sabaqLines;
  let week = 0;
  while (left > 0) {
    week++;
    if (week > MAX_YEARS * 52) return null;
    // Growth: about one more line every 4 weeks, up to two pages, as the tuning loop allows
    if (p.growth && week % 4 === 0) size = Math.min(30, size + 1);
    const dawrMinutes = Math.min(pages, pages >= 200 ? 20 : 10) * p.dawrPer;
    const timeForSabaq = Math.max(0, p.budget - p.sabqiMinutes - dawrMinutes);
    const fits = Math.max(2, Math.floor(timeForSabaq / p.perLine)); // a small sabaq still happens on tight days
    const daily = Math.min(size, fits) * p.settleRate;
    const learned = Math.min(left, daily * 7 * p.adherence);
    left -= learned;
    pages += learned / p.linesPerPage;
  }
  return addDays(p.day, week * 7);
}

export type Hero = { date: string; likely: string; setOn: string; reason: string | null };

/** Keep the hero date steady: it only moves for a shift over 4 weeks, at most once a week. */
export function nextHero(prev: Hero | undefined, proj: Projection, day: string, reason: string | null): Hero | undefined {
  if (proj.calibrating > 0 || !proj.cautious || !proj.likely) return prev;
  if (!prev) return { date: proj.cautious, likely: proj.likely, setOn: day, reason: null };
  const shift = daysBetween(prev.date, proj.cautious);
  if (Math.abs(shift) > HERO_MOVE_DAYS && daysBetween(prev.setOn, day) >= HERO_MOVE_EVERY) {
    return { date: proj.cautious, likely: proj.likely, setOn: day, reason };
  }
  return { ...prev, likely: proj.likely };
}

/** Ahead, on track or behind the pace the hero date needs. */
export function pace(proj: Projection, hero: Hero | undefined): "ahead" | "on track" | "behind" | null {
  if (!hero || !proj.cautious) return null;
  const diff = daysBetween(proj.cautious, hero.date); // positive: projection lands before the hero date
  if (diff > 14) return "ahead";
  if (diff < -14) return "behind";
  return "on track";
}
