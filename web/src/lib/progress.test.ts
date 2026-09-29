import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays } from "./dates";
import {
  applySession, emptyProgress, forecast, gradeSession, learningOrder, markMemorised, planDay, reviewPage, streak,
  JUZ_STARTS, type Session,
} from "./progress";
import { flatten, initialState, isComplete, reduce, tally } from "./session";
import type { PageData } from "./types";

const DAY = "2026-10-01";

function session(page: number, kind: Session["kind"], grade: number, day = DAY, extra: Partial<Session> = {}): Session {
  return { at: `${day}T08:00:00Z`, day, page, kind, mode: "recite", seconds: 300, words: 100, cleanLines: 15, lines: 15,
    stuck: [], hints: [], mistakes: [], grade, ...extra };
}

test("grading: flawless is 5, a few slips 3-4, many errors fail", () => {
  assert.equal(gradeSession(100, 0, 0, 0), 5);
  assert.equal(gradeSession(100, 2, 1, 0), 4);
  assert.equal(gradeSession(100, 5, 0, 1), 3);
  assert.equal(gradeSession(100, 30, 0, 0), 1);
});

test("a page graduates to memorised after enough good reviews, and falls back on a bad one", () => {
  let p = reviewPage(undefined, 5, DAY);
  assert.equal(p.status, "learning");
  assert.equal(p.due, addDays(DAY, 1));
  p = reviewPage(p, 5, p.due);
  p = reviewPage(p, 5, p.due);
  assert.equal(p.status, "memorised");
  p = reviewPage(p, 1, p.due);
  assert.equal(p.status, "learning");
  assert.equal(p.interval, 1);
});

test("sabaq moves to the next new page, and repeats a page that didn't stick", () => {
  let prog = emptyProgress();
  assert.deepEqual(planDay(prog, DAY).sabaq, { type: "new", page: 1 });

  prog = applySession(prog, session(1, "sabaq", 5, addDays(DAY, -1)));
  assert.deepEqual(planDay(prog, DAY).sabaq, { type: "new", page: 2 });
  assert.deepEqual(planDay(prog, DAY).sabqi, [1]);

  prog = applySession(prog, session(2, "sabaq", 1, DAY));
  const tomorrow = planDay(prog, addDays(DAY, 1));
  assert.equal(tomorrow.sabaq.type, "repeat");
  assert.equal(tomorrow.sabaq.type === "repeat" && tomorrow.sabaq.page, 2);
});

test("finishing today's sabaq shows it as done with a prediction for tomorrow", () => {
  const prog = applySession(emptyProgress(), session(1, "sabaq", 5));
  assert.deepEqual(planDay(prog, DAY).sabaq, { type: "done", page: 1, next: 2 });
});

test("manzil only includes memorised pages that are due", () => {
  let prog = markMemorised(emptyProgress(), [582, 583, 584], DAY);
  const plan = planDay(prog, DAY);
  assert.deepEqual(plan.manzil, [582]); // staggered: one due today, the others on later days
  prog = { ...prog, settings: { ...prog.settings, manzilPerDay: 1 } };
  assert.equal(planDay(prog, addDays(DAY, 5)).manzil.length, 1);
});

test("backward order starts at juz 30 and reads each juz forwards", () => {
  const order = learningOrder({ ...emptyProgress().settings, order: "backward" }, JUZ_STARTS);
  assert.deepEqual(order.slice(0, 3), [582, 583, 584]);
  assert.equal(order[23], 562);
  assert.equal(order.length, 604);
});

test("streak counts consecutive days, allowing today to still be open", () => {
  const s = [session(1, "sabaq", 5, addDays(DAY, -2)), session(2, "sabaq", 5, addDays(DAY, -1))];
  assert.equal(streak(s, DAY), 2);
  assert.equal(streak([...s, session(3, "sabaq", 5)], DAY), 3);
  assert.equal(streak(s, addDays(DAY, 1)), 0);
});

test("forecast estimates when the current juz will be finished", () => {
  let prog = emptyProgress();
  for (let i = 0; i < 7; i++) prog = applySession(prog, session(i + 1, "sabaq", 5, addDays(DAY, i - 6)));
  const f = forecast(prog, DAY)!;
  assert.equal(f.pagesPerWeek, 7);
  assert.deepEqual(f.nextPages, [8, 9, 10]);
  assert.equal(f.juzDoneOn, addDays(DAY, 14)); // pages 8-21 at one a day
});

test("word stats accumulate across sessions", () => {
  let prog = applySession(emptyProgress(), session(1, "sabaq", 3, DAY, { stuck: ["1:2:1"], mistakes: ["1:2:1"] }));
  prog = applySession(prog, session(1, "sabqi", 3, addDays(DAY, 1), { stuck: ["1:2:1"], hints: ["1:3:1"] }));
  assert.equal(prog.words["1:2:1"].stuck, 2);
  assert.equal(prog.words["1:2:1"].mistake, 1);
  assert.equal(prog.words["1:3:1"].hint, 1);
});

const PAGE: PageData = {
  page: 1, juz: 1, width: 100, height: 100, firstVerse: "1:1", lastVerse: "1:2",
  lines: [
    { line: 1, y0: 0, ySplit: 0.3, y1: 0.4, words: [
      { key: "1:1:1", type: "word", ar: "a", en: "a", x0: 0.5, x1: 1 },
      { key: "1:1:2", type: "end", ar: "1", en: "(1)", x0: 0, x1: 0.5 },
    ] },
    { line: 2, y0: 0.5, ySplit: 0.8, y1: 0.9, words: [
      { key: "1:2:1", type: "word", ar: "b", en: "b", x0: 0.5, x1: 1 },
      { key: "1:2:2", type: "word", ar: "c", en: "c", x0: 0, x1: 0.5 },
    ] },
  ],
};

test("recite session: clean line, a peek, a hint, a mistake, and undo", () => {
  const flat = flatten(PAGE);
  let s = initialState(flat, "recite");
  s = reduce(flat, s, { type: "nextLine" });
  s = reduce(flat, s, { type: "hint" }); // meaning of 1:2:1
  s = reduce(flat, s, { type: "peekNext" }); // stuck on 1:2:1
  s = reduce(flat, s, { type: "nextLine" }); // 1:2:2 recited
  s = reduce(flat, s, { type: "tapArabic", index: 3 }); // ...but said wrong
  assert.ok(isComplete(s));
  let t = tally(flat, s);
  assert.deepEqual([t.words, t.lines, t.cleanLines], [3, 2, 1]);
  assert.deepEqual([t.stuck, t.hints, t.mistakes], [["1:2:1"], ["1:2:1"], ["1:2:2"]]);
  s = reduce(flat, s, { type: "undo" });
  t = tally(flat, s);
  assert.deepEqual(t.mistakes, []);
});

test("meaning session: tapping a covered gloss counts as a miss", () => {
  const flat = flatten(PAGE);
  let s = initialState(flat, "meaning");
  assert.equal(s.words[0].ar, "clean");
  s = reduce(flat, s, { type: "tapEnglish", index: 2 });
  s = reduce(flat, s, { type: "nextLine" });
  s = reduce(flat, s, { type: "nextLine" });
  assert.ok(isComplete(s));
  assert.deepEqual(tally(flat, s).stuck, ["1:2:1"]);
});
