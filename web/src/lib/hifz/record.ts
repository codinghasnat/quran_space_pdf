"use client";

import { isoDay } from "../dates";
import type { PortionResult, PortionWord } from "./portion";
import { append, newId } from "./store";
import type { Recitation, RecitationMode, Stage, WordEvent } from "./types";

/** Save one recitation of a portion: a Recitation per page, plus a word event per peek and mistake. */
export function recordPortion(
  stage: Stage,
  mode: RecitationMode,
  result: PortionResult,
  seconds: number,
  rating?: Recitation["rating"],
) {
  const at = new Date().toISOString();
  const day = isoDay();
  const pages = [...result.byPage.entries()];
  const totalLines = pages.reduce((a, [, p]) => a + p.lines.length, 0) || 1;
  const clean = mode === "eyesClosed" ? (rating ?? 0) >= 3 : result.clean;
  const recs: Recitation[] = pages.map(([page, p]) => ({
    id: newId(),
    at,
    day,
    stage,
    mode,
    page,
    lines: p.lines,
    clean: mode === "eyesClosed" ? clean : p.peeks === 0 && p.mistakes === 0,
    ...(rating ? { rating } : {}),
    peeks: p.peeks,
    mistakes: p.mistakes,
    seconds: Math.round((seconds * p.lines.length) / totalLines),
  }));
  const event = (w: PortionWord, kind: WordEvent["kind"]): WordEvent => ({
    at, day, key: w.token.key, page: w.page, line: w.line, x: (w.token.x0 + w.token.x1) / 2, kind, stage,
  });
  append("recitations", ...recs);
  append("wordEvents", ...result.peeked.map((w) => event(w, "peek")), ...result.wrongWords.map((w) => event(w, "wrong")));
  return clean;
}

/** An eyes-closed round has no word detail: just the pages, lines and how it went. */
export function recordEyesClosed(
  stage: Stage,
  pages: Map<number, number[]>,
  seconds: number,
  rating: NonNullable<Recitation["rating"]>,
) {
  const byPage = new Map([...pages].map(([page, lines]) => [page, { lines, peeks: 0, mistakes: 0 }]));
  return recordPortion(stage, "eyesClosed", { clean: rating >= 3, byPage, peeked: [], wrongWords: [] }, seconds, rating);
}
