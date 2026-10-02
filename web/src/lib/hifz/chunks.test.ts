import { test } from "node:test";
import assert from "node:assert/strict";
import { makeChunks, nextPhase, phasesFor } from "./chunks";

test("a sabaq splits into pieces; a lone last line joins the piece before it", () => {
  assert.deepEqual(makeChunks([1, 2, 3, 4, 5, 6, 7], 1), [[1], [2], [3], [4], [5], [6], [7]]);
  assert.deepEqual(makeChunks([1, 2, 3, 4, 5, 6, 7], 2), [[1, 2], [3, 4], [5, 6, 7]]);
  assert.deepEqual(makeChunks([1, 2, 3], 5), [[1, 2, 3]]);
});

test("the first piece has nothing to join; later pieces end by joining on", () => {
  assert.deepEqual(phasesFor(0), ["listen", "read", "blur", "recite"]);
  assert.equal(nextPhase(0, "recite"), null);
  assert.equal(nextPhase(2, "recite"), "join");
  assert.equal(nextPhase(2, "join"), null);
});
