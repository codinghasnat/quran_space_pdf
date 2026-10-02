import { addDays, daysBetween } from "../dates";
import { DEFAULT_MINUTES } from "./plan";
import { quality } from "./strength";
import type { HifzData, SabaqRecord, TuningChange } from "./types";

// Weekly review of the two speed variables: sabaq size grows and required repetitions shrink, slowly, and
// only while sabqi stays healthy. At most one change a week so its effect can be seen. Shrinking is faster
// than growing, by design.

export const MIN_LINES = 2;
export const MAX_LINES = 30;
export const MIN_REPS = 10;
export const MAX_REPS = 60;
const REVIEW_EVERY = 7;

/** Share of sabqi pages recited cleanly (first attempt of the day) over the last 14 days; null without data. */
export function sabqiHealth(data: HifzData, day: string): number | null {
  const first = new Map<string, number>();
  for (const r of [...data.recitations].sort((a, b) => (a.at < b.at ? -1 : 1))) {
    if (r.stage !== "sabqi" || daysBetween(r.day, day) > 14 || daysBetween(r.day, day) < 0) continue;
    const k = `${r.day}:${r.page}`;
    if (!first.has(k)) first.set(k, quality(r));
  }
  if (first.size < 5) return null;
  return [...first.values()].filter((q) => q >= 0.85).length / first.size;
}

/** The next day's first sabqi check of a settled sabaq: true passed, false slipped, null not yet checked. */
export function passedNextDay(s: SabaqRecord, data: HifzData): boolean | null {
  const pages = new Set(s.lines.map((l) => l.page));
  const later = data.recitations.filter((r) => r.day > s.day && pages.has(r.page) && r.stage !== "sabaq");
  if (!later.length) return null;
  const firstDay = later.reduce((a, r) => (r.day < a ? r.day : a), later[0].day);
  return later.filter((r) => r.day === firstDay).every((r) => quality(r) >= 0.85);
}

/** A proposed change if a weekly review is due today, otherwise null. */
export function weeklyReview(data: HifzData, day: string): TuningChange | null {
  const { settings, sabaqs, tuning } = data;
  if (sabaqs.length === 0) return null;
  const firstSabaq = sabaqs.reduce((a, s) => (s.day < a ? s.day : a), sabaqs[0].day);
  const lastReview = tuning.at(-1)?.day ?? firstSabaq;
  if (daysBetween(lastReview, day) < REVIEW_EVERY) return null;

  const weekStart = addDays(day, -7);
  const week = sabaqs.filter((s) => s.day >= weekStart && s.day < day);
  const health = sabqiHealth(data, day);
  const repeated = week.filter((s) => !s.settled).length;
  const slipped = week.filter((s) => s.settled && passedNextDay(s, data) === false).length;
  const last5 = sabaqs.filter((s) => s.settled).slice(-5);
  const last5Passed = last5.length === 5 && last5.every((s) => passedNextDay(s, data) === true);
  const avgMinutes = week.length ? week.reduce((a, s) => a + s.seconds, 0) / 60 / week.length : 0;
  const withinBudget = avgMinutes <= DEFAULT_MINUTES.sabaq * 1.1 && avgMinutes <= settings.dailyMinutes;

  const change = (variable: TuningChange["variable"], to: number, reason: string): TuningChange | null => {
    const from = variable === "sabaqLines" ? settings.sabaqLines : settings.coveredReps;
    if (to === from) return { day, variable, from, to, reason: "No change this week.", accepted: true };
    return { day, variable, from, to, reason, accepted: null };
  };

  if ((health !== null && health < 0.75) || repeated >= 2) {
    const why = repeated >= 2 ? `${repeated} sabaqs needed repeating this week` : `sabqi was ${pct(health!)} clean`;
    const recentCut = tuning.some(
      (t) => t.variable === "sabaqLines" && t.to < t.from && t.accepted && daysBetween(t.day, day) <= 14,
    );
    if (recentCut || settings.sabaqLines <= MIN_LINES) {
      return change("coveredReps", Math.min(MAX_REPS, settings.coveredReps + 3), `${cap(why)}, so each sabaq gets 3 more clean repetitions.`);
    }
    return change("sabaqLines", settings.sabaqLines - 1, `${cap(why)}, so the sabaq eases back to ${settings.sabaqLines - 1} lines.`);
  }
  if (slipped > 0) {
    return change("coveredReps", Math.min(MAX_REPS, settings.coveredReps + 3), "A sabaq slipped at its next-day check, so each sabaq gets 3 more clean repetitions.");
  }
  if (health !== null && health >= 0.9 && last5Passed && withinBudget) {
    const lastGrowth = [...tuning].reverse().find((t) => t.accepted && (t.variable === "coveredReps" ? t.to < t.from : t.to > t.from));
    if (lastGrowth?.variable === "coveredReps" || settings.coveredReps <= MIN_REPS) {
      if (settings.sabaqLines < MAX_LINES) {
        return change("sabaqLines", settings.sabaqLines + 1, `Sabqi was ${pct(health)} clean and your last 5 sabaqs held, so sabaq grows to ${settings.sabaqLines + 1} lines.`);
      }
    }
    return change("coveredReps", Math.max(MIN_REPS, settings.coveredReps - 1), `Sabqi was ${pct(health)} clean and your last 5 sabaqs held, so one fewer repetition is needed (${settings.coveredReps - 1}).`);
  }
  return { day, variable: "sabaqLines", from: settings.sabaqLines, to: settings.sabaqLines, reason: "No change this week.", accepted: true };
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
