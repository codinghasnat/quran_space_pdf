import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays } from "../dates";
import { learningOrder, parseLineIndex, type RawLineIndex } from "./quran";
import { nextSabaqLines, planDay } from "./plan";
import { project } from "./projection";
import { colourFor, nextStability, pageStates, quality } from "./strength";
import { weeklyReview } from "./tuning";
import { emptyData, type HifzData, type Recitation, type SabaqRecord } from "./types";

const DAY = "2026-10-01";

// A tiny mushaf: surah 1 on page 1 (3 lines), surah 2 over pages 2-3 (15 lines each), surahs 113-114 on page 4
function fixture() {
  const raw: RawLineIndex = {
    1: [[1, 1, 1, 2, 5], [2, 1, 3, 5, 5], [3, 1, 6, 7, 5]],
    2: Array.from({ length: 15 }, (_, i) => [i + 1, 2, i + 1, i + 1, 8] as [number, number, number, number, number]),
    3: Array.from({ length: 15 }, (_, i) => [i + 1, 2, i + 16, i + 16, 8] as [number, number, number, number, number]),
    4: [[2, 113, 1, 3, 6], [3, 113, 4, 5, 6], [6, 114, 1, 3, 6], [7, 114, 4, 6, 6]],
  };
  return parseLineIndex(raw);
}

let n = 0;
function rec(page: number, day: string, extra: Partial<Recitation> = {}): Recitation {
  return {
    id: `r${n++}`, at: `${day}T08:00:00.000Z`, day, stage: "sabqi", mode: "covered", page,
    lines: [1, 2, 3], clean: true, peeks: 0, mistakes: 0, seconds: 300, ...extra,
  };
}

function sabaq(day: string, lines: [number, number][], settled = true): SabaqRecord {
  return {
    id: `s${n++}`, day, lines: lines.map(([page, line]) => ({ page, line })), settled,
    repsToFirstClean: 3, coveredClean: 30, eyesClosedClean: 30, seconds: 45 * 60,
  };
}

test("learning order: backward starts at An-Nas and reads each surah forwards", () => {
  const idx = fixture();
  const order = learningOrder(idx, "backward");
  assert.deepEqual(order.slice(0, 3).map((l) => [l.surah, l.page, l.line]), [[114, 4, 6], [114, 4, 7], [113, 4, 2]]);
  assert.equal(learningOrder(idx, "forward")[0].surah, 1);
});

test("sabaq stays inside one surah and doesn't leave a scrap of 1-2 lines", () => {
  const idx = fixture();
  const data = emptyData(DAY);
  data.settings.direction = "forward";
  assert.equal(nextSabaqLines(data, idx, new Set(), 7).length, 3, "all of Al-Fatihah: 3 lines");
  const memorised = new Set(["1:1", "1:2", "1:3"]);
  const lines = nextSabaqLines(data, idx, memorised, 7);
  assert.equal(lines.length, 7);
  assert.equal(lines[0].page, 2);
});

test("stability grows on clean spaced reviews, not on same-day repetition, and drops on failure", () => {
  assert.equal(nextStability(5, 0, 1), 5);
  assert.ok(nextStability(1, 1, 1) > 2);
  assert.ok(nextStability(10, 10, 1) > nextStability(10, 1, 1), "reviewing when R has fallen grows S more");
  assert.ok(nextStability(10, 3, 0.1) < 4);
  assert.equal(quality(rec(1, DAY, { mode: "eyesClosed", rating: 4, clean: true })), 1);
  assert.equal(quality(rec(1, DAY, { clean: false, peeks: 1, lines: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] })), 0.6);
});

test("heatmap colours", () => {
  assert.equal(colourFor(0.9, 0, false), "blank");
  assert.equal(colourFor(0.9, 0, true), "strong");
  assert.equal(colourFor(0.7, 0, true), "okay");
  assert.equal(colourFor(0.5, 0, true), "weak");
  assert.equal(colourFor(0.95, 2, true), "weak", "2+ slips in the last review needs practice");
});

test("a settled sabaq page starts fragile and strengthens through daily sabqi", () => {
  const idx = fixture();
  const data = emptyData(DAY);
  data.sabaqs.push(sabaq(DAY, [[1, 1], [1, 2], [1, 3]]));
  let st = pageStates(data, idx, addDays(DAY, 1)).get(1)!;
  assert.equal(st.status, "memorised");
  assert.equal(st.colour, "weak", "the next morning a new page needs sabqi");
  for (let d = 1; d <= 6; d++) data.recitations.push(rec(1, addDays(DAY, d)));
  st = pageStates(data, idx, addDays(DAY, 7)).get(1)!;
  assert.ok(st.stability > 15, `stability ${st.stability}`);
  assert.equal(st.colour, "strong");
});

test("claimed pages: solid starts green, rusty is rebuilt", () => {
  const idx = fixture();
  const data = emptyData(DAY);
  data.profile.claims = { 1: "solid", 2: "rusty", 114: "solid" };
  const states = pageStates(data, idx, addDays(DAY, 1));
  assert.equal(states.get(1)!.colour, "strong");
  assert.equal(states.get(2)!.status, "rebuilding");
  assert.equal(states.get(4)!.status, "learning", "An-Nas claimed but Al-Falaq on the same page isn't");
  assert.equal(states.get(4)!.memorisedLines, 2);
});

test("plan: sabqi first, then the sabaq; an unsettled sabaq repeats", () => {
  const idx = fixture();
  const data = emptyData(DAY);
  data.settings.direction = "forward";
  data.sabaqs.push(sabaq(addDays(DAY, -1), [[1, 1], [1, 2], [1, 3]]));
  const today = DAY;
  let plan = planDay(data, idx, pageStates(data, idx, today), today);
  assert.deepEqual(plan.sabqi.pages, [1]);
  assert.equal(plan.sabaq!.lines[0].page, 2);
  assert.equal(plan.sabaq!.repeat, false);

  data.sabaqs.push(sabaq(today, [[2, 1], [2, 2]], false));
  plan = planDay(data, idx, pageStates(data, idx, addDays(today, 1)), addDays(today, 1));
  assert.equal(plan.sabaq!.repeat, true);
  assert.deepEqual(plan.sabaq!.lines.map((l) => l.line), [1, 2]);
});

test("plan: a tight budget trims the sabaq, and no time for it skips it", () => {
  const idx = fixture();
  const data = emptyData(DAY);
  data.settings.direction = "forward";
  data.profile.claims = { 1: "solid" };
  data.sabaqs.push(sabaq(addDays(DAY, -1), [[2, 1], [2, 2], [2, 3]]));
  let plan = planDay(data, idx, pageStates(data, idx, DAY), DAY, 30);
  assert.ok(plan.sabaq!.shrunk);
  assert.ok(plan.sabaq!.lines.length < 7);
  plan = planDay(data, idx, pageStates(data, idx, DAY), DAY, 10);
  assert.equal(plan.sabaq, null);
  assert.match(plan.notes[0], /Sabqi comes first/);
});

test("plan: dawr rotates through memorised pages outside the sabqi window", () => {
  const idx = fixture();
  const data = emptyData(DAY);
  data.settings.direction = "backward";
  data.profile.claims = { 1: "solid", 2: "solid" };
  const plan = planDay(data, idx, pageStates(data, idx, DAY), DAY);
  assert.deepEqual([...plan.dawr.pages].sort(), [1, 2, 3]);
  assert.equal(plan.sabaq!.lines[0].surah, 114);
});

test("tuning: healthy sabqi grows the sabaq slowly; struggling shrinks it", () => {
  const data: HifzData = emptyData(addDays(DAY, -30));
  for (let d = 14; d >= 1; d--) {
    const day = addDays(DAY, -d);
    data.sabaqs.push(sabaq(day, [[2, (d % 15) + 1]]));
    data.recitations.push(rec(2, addDays(day, 1)));
  }
  data.settings.coveredReps = 10;
  let change = weeklyReview(data, DAY)!;
  assert.equal(change.variable, "sabaqLines");
  assert.equal(change.to, 8);

  const bad: HifzData = emptyData(addDays(DAY, -30));
  for (let d = 8; d >= 1; d--) {
    const day = addDays(DAY, -d);
    bad.sabaqs.push(sabaq(day, [[2, d]], d % 2 === 0));
    bad.recitations.push(rec(2, addDays(day, 1), { clean: false, peeks: 5 }));
  }
  change = weeklyReview(bad, DAY)!;
  assert.equal(change.variable, "sabaqLines");
  assert.equal(change.to, 6);
});

test("projection: calibrating for 30 days, then a cautious date after the likely one", () => {
  const idx = fixture();
  const data = emptyData(addDays(DAY, -40));
  for (let d = 40; d >= 1; d--) {
    const day = addDays(DAY, -d);
    data.recitations.push(rec(1, day));
  }
  data.sabaqs.push(sabaq(addDays(DAY, -3), [[2, 1], [2, 2], [2, 3]]), sabaq(addDays(DAY, -2), [[2, 4], [2, 5]]));
  const p = project(data, idx, pageStates(data, idx, DAY), DAY);
  assert.equal(p.calibrating, 0);
  assert.ok(p.likely && p.cautious && p.cautious >= p.likely, `${p.likely} ${p.cautious}`);
  const fresh = project(emptyData(DAY), idx, pageStates(emptyData(DAY), idx, DAY), DAY);
  assert.equal(fresh.calibrating, 30);
});

test("part of a surah can be claimed: the next sabaq continues after it", () => {
  const idx = fixture();
  const data = emptyData(DAY);
  data.settings.direction = "forward";
  data.settings.start = { page: 2, line: 1 };
  data.profile.claims = { 2: "solid" };
  data.profile.claimUpTo = { 2: 10 };
  const states = pageStates(data, idx, DAY);
  assert.equal(states.get(2)!.memorisedLines, 10);
  const plan = planDay(data, idx, states, DAY);
  assert.equal(plan.sabaq!.lines[0].a1, 11);
});

test("ayah marks from the Progress page override claims and history", () => {
  const idx = fixture();
  const data = emptyData(DAY);
  data.profile.ayahMarks = { "1:1": { c: "solid", day: DAY }, "1:2": { c: "solid", day: DAY } };
  let st = pageStates(data, idx, DAY).get(1)!;
  assert.equal(st.memorisedLines, 1, "line 1 holds ayahs 1-2, both marked");
  data.profile.claims = { 1: "solid" };
  data.profile.ayahMarks = { "1:4": { c: "none", day: DAY } };
  st = pageStates(data, idx, DAY).get(1)!;
  assert.equal(st.memorisedLines, 2, "the line with ayahs 3-5 drops out");
  data.profile.claims = {};
  data.sabaqs.push(sabaq(DAY, [[1, 1], [1, 2], [1, 3]]));
  st = pageStates(data, idx, DAY).get(1)!;
  assert.equal(st.memorisedLines, 2, "a settled sabaq line can be unmarked too");
});
