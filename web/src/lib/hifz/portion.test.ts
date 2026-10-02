import { test } from "node:test";
import assert from "node:assert/strict";
import type { PageData } from "../types";
import { initialPortion, portionDone, portionResult, portionWords, reducePortion } from "./portion";

function page(n: number, lines: number): PageData {
  return {
    page: n, juz: 1, width: 100, height: 100, firstVerse: "1:1", lastVerse: "1:2",
    lines: Array.from({ length: lines }, (_, i) => ({
      line: i + 1, y0: 0, ySplit: 0, y1: 0,
      words: [
        { key: `${n}:${i}:1`, type: "word" as const, ar: "a", en: "a", x0: 0.5, x1: 1 },
        { key: `${n}:${i}:2`, type: "word" as const, ar: "b", en: "b", x0: 0, x1: 0.5 },
        { key: `${n}:${i}:e`, type: "end" as const, ar: "", en: "", x0: 0, x1: 0 },
      ],
    })),
  };
}

test("a portion across two pages, only the chosen lines, markers skipped", () => {
  const words = portionWords([page(3, 3), page(2, 3)], new Map([[2, [3]], [3, [1, 2]]]));
  assert.deepEqual(words.map((w) => `${w.page}:${w.line}`), ["2:3", "2:3", "3:1", "3:1", "3:2", "3:2"]);
});

test("checking every line without peeking is clean", () => {
  const words = portionWords([page(1, 2)], null);
  let s = initialPortion(words);
  s = reducePortion(words, s, { type: "check" });
  assert.equal(portionDone(s), false);
  s = reducePortion(words, s, { type: "check" });
  assert.ok(portionDone(s));
  assert.equal(portionResult(words, s).clean, true);
});

test("a peek and a wrong word are counted per page, and undo takes them back", () => {
  const words = portionWords([page(1, 2)], null);
  let s = initialPortion(words);
  s = reducePortion(words, s, { type: "tap", index: 1 }); // peek
  s = reducePortion(words, s, { type: "check" });
  s = reducePortion(words, s, { type: "tap", index: 0 }); // revealed: said wrong
  let r = portionResult(words, s);
  assert.equal(r.clean, false);
  assert.deepEqual(r.byPage.get(1), { lines: [1, 2], peeks: 1, mistakes: 1 });
  s = reducePortion(words, s, { type: "undo" });
  s = reducePortion(words, s, { type: "undo" });
  s = reducePortion(words, s, { type: "undo" });
  r = portionResult(words, s);
  assert.equal(r.peeked.length + r.wrongWords.length, 0);
});

test("the time slider reveals in order without counting peeks", () => {
  const words = portionWords([page(1, 2)], null);
  let s = initialPortion(words);
  s = reducePortion(words, s, { type: "slide", to: 3 });
  assert.deepEqual(s.marks, ["checked", "checked", "checked", "covered"]);
  assert.equal(portionResult(words, s).clean, true);
});
