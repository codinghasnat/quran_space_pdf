"use client";

import { useEffect, useMemo, useState } from "react";
import { isoDay } from "../dates";
import { planDay, type DayPlan } from "./plan";
import { nextHero, pace, project, type Projection } from "./projection";
import { parseLineIndex, type QuranIndex, type RawLineIndex } from "./quran";
import { updateProfile, useHifz } from "./store";
import { pageStates, type PageState } from "./strength";
import type { HifzData } from "./types";

let indexPromise: Promise<QuranIndex> | null = null;

export function loadQuranIndex(): Promise<QuranIndex> {
  indexPromise ??= fetch("/pages/lines.json")
    .then((r) => {
      if (!r.ok) throw new Error("lines.json is missing: run tools/build_line_index.py");
      return r.json() as Promise<RawLineIndex>;
    })
    .then(parseLineIndex);
  indexPromise.catch(() => (indexPromise = null));
  return indexPromise;
}

export function useQuranIndex(): QuranIndex | null {
  const [index, setIndex] = useState<QuranIndex | null>(null);
  useEffect(() => {
    loadQuranIndex().then(setIndex, (e) => console.error(e));
  }, []);
  return index;
}

/** The local day, refreshed when the tab comes back after midnight. */
export function useToday(): string {
  const [day, setDay] = useState(isoDay);
  useEffect(() => {
    const check = () => setDay(isoDay());
    window.addEventListener("focus", check);
    const t = setInterval(check, 60_000);
    return () => {
      window.removeEventListener("focus", check);
      clearInterval(t);
    };
  }, []);
  return day;
}

export type Journey = {
  data: HifzData;
  index: QuranIndex;
  day: string;
  states: Map<number, PageState>;
  plan: DayPlan;
  projection: Projection;
  pace: ReturnType<typeof pace>;
};

/** Everything derived from the raw history for today. Null while loading. */
export function useJourney(budgetOverride?: number): Journey | null {
  const data = useHifz();
  const index = useQuranIndex();
  const day = useToday();

  const states = useMemo(() => (data && index ? pageStates(data, index, day) : null), [data, index, day]);
  const plan = useMemo(
    () => (data && index && states ? planDay(data, index, states, day, budgetOverride) : null),
    [data, index, states, day, budgetOverride],
  );
  const projection = useMemo(
    () => (data && index && states ? project(data, index, states, day) : null),
    [data, index, states, day],
  );

  // Keep the hero date steady; store it when it first appears or moves
  useEffect(() => {
    if (!data || !projection) return;
    const next = nextHero(data.profile.hero, projection, day, null);
    if (next && JSON.stringify(next) !== JSON.stringify(data.profile.hero)) updateProfile((p) => ({ ...p, hero: next }));
  }, [data, projection, day]);

  if (!data || !index || !states || !plan || !projection) return null;
  return { data, index, day, states, plan, projection, pace: pace(projection, data.profile.hero) };
}
