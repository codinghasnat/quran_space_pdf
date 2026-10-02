"use client";

import Link from "next/link";
import { useEffect, useMemo, useReducer, useState } from "react";
import { ChevronLeft, ChevronRight, Flag, Undo2 } from "lucide-react";
import { useKeys, usePages, useStageTimer } from "@/lib/hifz/hooks";
import {
  activeLineKey, initialPortion, portionDone, portionResult, portionWords, reducePortion, type PortionAction, type PortionState,
} from "@/lib/hifz/portion";
import { lineId } from "@/lib/hifz/quran";
import { recordPortion } from "@/lib/hifz/record";
import { append } from "@/lib/hifz/store";
import { memorisedLineDays } from "@/lib/hifz/strength";
import { useJourney } from "@/lib/hifz/useJourney";
import { surahName } from "@/lib/surahs";
import { COLOUR_LABEL } from "./Heatmap";
import MushafPage from "./MushafPage";
import { Kbd } from "./SabaqSession";
import SessionShell, { chime } from "./SessionShell";

type Mode = "read" | "recite";

/** Any page, any time: read it with meanings, or recite it covered. Counts as a drill, outside the daily plan. */
export default function FreePractice({ page }: { page: number }) {
  const journey = useJourney();
  const { pages } = usePages([page]);
  const data = pages?.[0] ?? null;
  const [mode, setMode] = useState<Mode>("recite");
  const [result, setResult] = useState<{ clean: boolean; slips: number } | null>(null);
  const [flagged, setFlagged] = useState(false);
  const timer = useStageTimer();

  const memorised = useMemo(() => (journey ? memorisedLineDays(journey.data, journey.index) : new Map()), [journey]);
  const lines = useMemo(() => {
    const all = journey?.index.byPage.get(page) ?? [];
    const mem = all.filter((l) => memorised.has(lineId(l))).map((l) => l.line);
    return mem.length ? mem : all.map((l) => l.line);
  }, [journey, memorised, page]);
  const byPage = useMemo(() => new Map([[page, lines]]), [page, lines]);
  const words = useMemo(() => (data ? portionWords([data], byPage) : []), [data, byPage]);
  const [portion, dispatch] = useReducer((s: PortionState, a: PortionAction) => reducePortion(words, s, a), undefined, () => initialPortion([]));
  useEffect(() => dispatch({ type: "reset" }), [words]);

  useEffect(() => {
    if (mode !== "recite" || !words.length || !portionDone(portion) || result) return;
    const r = portionResult(words, portion);
    recordPortion("drill", "covered", r, timer.takeLap());
    setResult({ clean: r.clean, slips: r.peeked.length + r.wrongWords.length });
    if (r.clean) chime();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portion]);

  useKeys((e) => {
    const k = e.key.toLowerCase();
    if (mode !== "recite") return;
    if (result && (k === " " || k === "enter")) return (e.preventDefault(), setResult(null), dispatch({ type: "reset" }));
    if (k === " " || k === "enter") (e.preventDefault(), dispatch({ type: "check" }));
    else if (k === "z" || k === "backspace") dispatch({ type: "undo" });
  });

  const active = activeLineKey(words, portion);
  const state = journey?.states.get(page);
  const flagLine = () => {
    const ln = active ? Number(active.split(":")[1]) : lines[0];
    append("flaggedLines", { page, line: ln, at: new Date().toISOString() });
    setFlagged(true);
  };

  return (
    <SessionShell
      title={`Page ${page}`}
      subtitle={data ? `${surahName(data.firstVerse)} · ${state ? COLOUR_LABEL[state.colour] : ""}` : ""}
      seconds={timer.seconds}
      paused={timer.paused}
      onTogglePause={timer.toggle}
    >
      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="flex justify-center">
          <div className="min-w-0">
            {data ? (
              <MushafPage
                data={data}
                focus={lines}
                glowLine={mode === "recite" && active ? Number(active.split(":")[1]) : null}
                portion={mode === "recite" && !result ? { words, state: portion, onTap: (i) => dispatch({ type: "tap", index: i }) } : undefined}
                glossOnTap={mode === "read"}
              />
            ) : (
              <div className="aspect-[3/5] h-[calc(100vh-8.5rem)] animate-pulse rounded-3xl bg-surface-raised" />
            )}
          </div>
        </div>
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="flex rounded-full bg-surface-raised p-1 text-sm">
            {(["recite", "read"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => (setMode(m), setResult(null), dispatch({ type: "reset" }))}
                className={`h-9 flex-1 rounded-full capitalize transition-colors ${mode === m ? "bg-teal text-bg" : "text-parchment-muted"}`}
              >
                {m === "read" ? "Read with meanings" : "Recite covered"}
              </button>
            ))}
          </div>
          <div className="rounded-[24px] border border-border bg-surface p-5">
            {mode === "read" ? (
              <p className="text-sm text-parchment-muted">Tap any word to see it up close with its meaning.</p>
            ) : result ? (
              <>
                <p className={`pop-in rounded-2xl px-4 py-3 text-sm ${result.clean ? "bg-heat-strong/10 text-heat-strong" : "bg-hint/10"}`}>
                  {result.clean ? "Clean. Alhamdulillah." : `${result.slips} slip${result.slips === 1 ? "" : "s"}, saved as tomorrow's focus.`}
                </p>
                <button onClick={() => (setResult(null), dispatch({ type: "reset" }))} className="mt-4 h-11 w-full rounded-full bg-teal text-sm font-semibold text-bg">
                  Again <Kbd dark>Space</Kbd>
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-parchment-muted">Recite each line, then press Space to check it. Tap a covered word to peek, a revealed one to mark it wrong.</p>
                <div className="mt-4 grid grid-cols-[auto_1fr] gap-2">
                  <button onClick={() => dispatch({ type: "undo" })} aria-label="Undo" className="flex h-11 w-11 items-center justify-center rounded-full border border-border"><Undo2 size={16} /></button>
                  <button onClick={() => dispatch({ type: "check" })} className="h-11 rounded-full bg-teal text-sm font-semibold text-bg">Check line <Kbd dark>Space</Kbd></button>
                </div>
              </>
            )}
          </div>
          <div className="flex items-center justify-between px-2 text-xs text-parchment-muted">
            <Link href={`/practice/${Math.max(1, page - 1)}`} className="flex items-center gap-1 hover:text-teal"><ChevronLeft size={14} /> Page {page - 1}</Link>
            <Link href={`/practice/${Math.min(604, page + 1)}`} className="flex items-center gap-1 hover:text-teal">Page {page + 1} <ChevronRight size={14} /></Link>
          </div>
          <button onClick={flagLine} disabled={flagged} className="flex items-center gap-1.5 px-2 text-xs text-parchment-muted hover:text-parchment disabled:text-teal">
            <Flag size={13} /> {flagged ? "Thanks: this line is flagged for a cover fix" : "Covers in the wrong place on this line?"}
          </button>
        </aside>
      </div>
    </SessionShell>
  );
}
