"use client";

import Link from "next/link";
import { useEffect, useMemo, useReducer, useState } from "react";
import { ArrowRight, Check, Eye, EyeOff, Flag, Link2, Undo2 } from "lucide-react";
import { STAGE_INFO } from "@/lib/hifz/content";
import { useKeys, usePages, useStageTimer } from "@/lib/hifz/hooks";
import {
  activeLineKey, initialPortion, portionDone, portionResult, portionWords, reducePortion, type PortionAction, type PortionState,
} from "@/lib/hifz/portion";
import { lineId } from "@/lib/hifz/quran";
import { recordPortion } from "@/lib/hifz/record";
import { append, newId } from "@/lib/hifz/store";
import { memorisedLineDays } from "@/lib/hifz/strength";
import { useJourney, type Journey } from "@/lib/hifz/useJourney";
import FlagCovers from "./FlagCovers";
import MushafPage from "./MushafPage";
import { Kbd } from "./SabaqSession";
import SessionShell, { chime } from "./SessionShell";

type Stage = "sabqi" | "dawr";
type Mode = "covered" | "eyes";
const RATINGS = [
  { v: 1 as const, label: "Again", hint: "Lost it" },
  { v: 2 as const, label: "Hard", hint: "Got through with stumbles" },
  { v: 3 as const, label: "Good", hint: "Clean, with effort" },
  { v: 4 as const, label: "Easy", hint: "Flowed" },
];

function frozenList(stage: Stage, day: string, fresh: number[]): number[] {
  const key = `hifz:${stage}-list:${day}`;
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? "null") as number[] | null;
    if (saved?.length) return saved;
    localStorage.setItem(key, JSON.stringify(fresh));
  } catch {}
  return fresh;
}

export default function ReviewSession({ stage }: { stage: Stage }) {
  const journey = useJourney();
  const [list, setList] = useState<number[] | null>(null);
  useEffect(() => {
    if (journey && !list) setList(frozenList(stage, journey.day, stage === "sabqi" ? journey.plan.sabqi.pages : journey.plan.dawr.pages));
  }, [journey, list, stage]);

  if (!journey || !list) return <div className="p-10"><div className="h-96 animate-pulse rounded-3xl bg-surface-raised" /></div>;
  if (!list.length) {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <p className="font-serif text-2xl">Nothing in {STAGE_INFO[stage].name} today</p>
        <p className="mt-2 text-sm text-parchment-muted">{STAGE_INFO[stage].blurb}</p>
        <Link href="/today" className="mt-6 inline-flex h-10 items-center rounded-full bg-teal px-5 text-sm font-semibold text-bg">Back to Today</Link>
      </div>
    );
  }
  return <Review stage={stage} list={list} journey={journey} />;
}

function Review({ stage, list, journey }: { stage: Stage; list: number[]; journey: Journey }) {
  const doneToday = journey.plan.done[stage];
  const [current, setCurrent] = useState(() => Math.max(0, list.findIndex((p) => !doneToday.has(p))));
  const [mode, setMode] = useState<Mode>("covered");
  const [join, setJoin] = useState(stage === "sabqi");
  const [result, setResult] = useState<{ clean: boolean; slips: number } | null>(null);
  const timer = useStageTimer();
  const page = list[current];
  const prevPage = current > 0 ? list[current - 1] : null;
  const joined = join && prevPage !== null && prevPage === page - 1 ? prevPage : null;

  const memorised = useMemo(() => memorisedLineDays(journey.data, journey.index), [journey.data, journey.index]);
  const linesOf = (p: number) => (journey.index.byPage.get(p) ?? []).filter((l) => memorised.has(lineId(l))).map((l) => l.line);
  const pageNums = joined ? [joined, page] : [page];
  const { pages } = usePages(pageNums);
  const byPage = useMemo(() => {
    const m = new Map<number, number[]>([[page, linesOf(page)]]);
    if (joined) m.set(joined, linesOf(joined).slice(-1)); // sliding window: start from the previous page's last line
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, joined, memorised]);
  const words = useMemo(() => (pages ? portionWords(pages, byPage) : []), [pages, byPage]);
  const [portion, dispatch] = useReducer((s: PortionState, a: PortionAction) => reducePortion(words, s, a), undefined, () => initialPortion([]));
  useEffect(() => dispatch({ type: "reset" }), [words]);

  const finished = list.every((p) => journey.plan.done[stage].has(p));
  const chunkOf = (i: number) =>
    stage === "dawr" ? Math.floor(i / Math.max(1, journey.data.settings.dawrChunkPages)) : 0;

  const finishCovered = () => {
    const r = portionResult(words, portion);
    recordPortion(stage, "covered", r, timer.takeLap());
    setResult({ clean: r.clean, slips: r.peeked.length + r.wrongWords.length });
    if (r.clean) chime();
  };
  useEffect(() => {
    if (mode === "covered" && words.length && portionDone(portion) && !result) finishCovered();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portion]);

  // Eyes closed: the covered page stays up; a word tapped open when stuck counts against the round
  const rate = (v: 1 | 2 | 3 | 4) => {
    const r = portionResult(words, portion);
    const rating = (r.peeked.length ? Math.min(v, 2) : v) as 1 | 2 | 3 | 4;
    recordPortion(stage, "eyesClosed", r, timer.takeLap(), rating);
    setResult({ clean: rating >= 3, slips: r.peeked.length || (rating >= 3 ? 0 : 1) });
    if (rating >= 3) chime();
  };
  const eyesPeeks = mode === "eyes" ? portion.marks.filter((m) => m === "peeked").length : 0;

  const next = () => {
    setResult(null);
    dispatch({ type: "reset" });
    const i = list.findIndex((p, j) => j > current && !journey.plan.done[stage].has(p));
    if (i >= 0) setCurrent(i);
    else if (current + 1 < list.length) setCurrent(current + 1);
    else {
      append("sessions", { id: newId(), day: journey.day, stage, startedAt: new Date().toISOString(), seconds: timer.seconds });
      timer.setPaused(true);
    }
  };

  useKeys((e) => {
    const k = e.key.toLowerCase();
    if (result) {
      if (k === " " || k === "enter") (e.preventDefault(), next());
      return;
    }
    if (mode === "covered") {
      if (k === " " || k === "enter") (e.preventDefault(), dispatch({ type: "check" }));
      else if (k === "z" || k === "backspace") dispatch({ type: "undo" });
    } else if (["1", "2", "3", "4"].includes(k)) {
      if (!(eyesPeeks > 0 && Number(k) >= 3)) rate(Number(k) as 1 | 2 | 3 | 4);
    }
  });

  const activeKey = activeLineKey(words, portion);
  const glow = (p: number) => {
    if (mode !== "covered" || !activeKey) return null;
    const [pg, ln] = activeKey.split(":").map(Number);
    return pg === p ? ln : null;
  };
  const info = STAGE_INFO[stage];
  const doneCount = list.filter((p) => journey.plan.done[stage].has(p)).length;

  if (finished && !result) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-6">
        <div className="aurora pointer-events-none absolute inset-0" />
        <div className="relative max-w-lg text-center">
          <span className="pop-in mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-teal text-bg glow-breathe"><Check size={36} /></span>
          <h1 className="mt-6 font-serif text-4xl">{info.name} done</h1>
          <p className="mt-3 text-parchment-muted">{list.length} page{list.length === 1 ? "" : "s"} recited today. {stage === "sabqi" ? "That's what moves new pages into long-term memory." : "Your rotation is fresh."}</p>
          <Link href="/today" className="mt-8 inline-flex h-12 items-center rounded-full bg-teal px-7 text-sm font-semibold text-bg glow-soft">Back to Today</Link>
        </div>
      </div>
    );
  }

  return (
    <SessionShell
      title={info.name}
      subtitle={`${doneCount} of ${list.length} pages · ${info.tagline}`}
      seconds={timer.seconds}
      paused={timer.paused}
      onTogglePause={timer.toggle}
    >
      <div className="grid gap-8 lg:grid-cols-[220px_1fr_340px]">
        <nav className="hidden space-y-1 lg:block">
          {list.map((p, i) => {
            const isDone = journey.plan.done[stage].has(p);
            const colour = journey.states.get(p)?.colour ?? "blank";
            const newChunk = stage === "dawr" && (i === 0 || chunkOf(i) !== chunkOf(i - 1));
            return (
              <div key={`${p}-${i}`}>
                {newChunk && <p className="mb-1 mt-3 text-[11px] font-medium uppercase tracking-wider text-parchment-muted">Chunk {chunkOf(i) + 1}</p>}
                <button
                  onClick={() => (setCurrent(i), setResult(null))}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                    i === current ? "bg-teal/10 text-teal" : "text-parchment-muted hover:bg-surface"
                  }`}
                >
                  <span className={`h-2.5 w-2.5 rounded-[3px] heat-${colour}`} />
                  <span className="flex-1">Page {p}</span>
                  {isDone && <Check size={14} className="text-heat-strong" />}
                </button>
              </div>
            );
          })}
        </nav>

        <div className="flex flex-row-reverse justify-center gap-6">
          {!pages ? (
            <div className="aspect-[3/5] h-[calc(100vh-8.5rem)] animate-pulse rounded-3xl bg-surface-raised" />
          ) : (
            pages.map((pg) => (
              <div key={pg.page} className={pg.page === page ? "min-w-0" : "w-[260px] shrink-0 self-end opacity-90"}>
                <MushafPage
                  data={pg}
                  fit={pg.page === page}
                  focus={byPage.get(pg.page) ?? []}
                  glowLine={glow(pg.page)}
                  portion={!result ? { words, state: portion, onTap: (i) => dispatch({ type: "tap", index: i }) } : undefined}
                  eyesClosed={mode === "eyes" && !result}
                />
                <p className="mt-2 text-center text-xs text-parchment-muted">Page {pg.page}{pg.page !== page ? " · last line, to join the pages" : ""}</p>
              </div>
            ))
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="flex rounded-full bg-surface-raised p-1 text-sm">
            {(["covered", "eyes"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => (setMode(m), setResult(null), dispatch({ type: "reset" }))}
                className={`flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full transition-colors ${mode === m ? "bg-teal text-bg" : "text-parchment-muted"}`}
              >
                {m === "covered" ? <Eye size={14} /> : <EyeOff size={14} />} {m === "covered" ? "Looking" : "Eyes closed"}
              </button>
            ))}
          </div>

          <div className="rounded-[24px] border border-border bg-surface p-5 shadow-[0_10px_40px_-24px_rgb(var(--teal)/0.5)]">
            <p className="font-serif text-2xl">Page {page}</p>
            <p className="text-xs text-parchment-muted">
              {journey.states.get(page)?.colour === "weak" ? "Needs practice: give it your full attention." : `${Math.round((journey.states.get(page)?.R ?? 0) * 100)}% recall expected today`}
            </p>

            {result ? (
              <div className="mt-4">
                <p className={`pop-in rounded-2xl px-4 py-3 text-sm ${result.clean ? "bg-heat-strong/10 text-heat-strong" : "bg-hint/10"}`}>
                  {result.clean ? "Clean. Alhamdulillah." : `${result.slips} slip${result.slips === 1 ? "" : "s"}. The page will come round sooner.`}
                </p>
                <button onClick={next} className="glow-breathe mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-teal text-sm font-semibold text-bg">
                  Next page <ArrowRight size={16} /> <Kbd dark>Space</Kbd>
                </button>
              </div>
            ) : mode === "covered" ? (
              <>
                <p className="mt-3 text-sm text-parchment-muted">Recite each line, then press Space to check it. Tap a word you said wrong.</p>
                <div className="mt-4 grid grid-cols-[auto_1fr] gap-2">
                  <button onClick={() => dispatch({ type: "undo" })} aria-label="Undo" className="flex h-11 w-11 items-center justify-center rounded-full border border-border hover:border-teal/50"><Undo2 size={16} /></button>
                  <button onClick={() => dispatch({ type: "check" })} className="h-11 rounded-full bg-teal text-sm font-semibold text-bg">Check line <Kbd dark>Space</Kbd></button>
                </div>
                {stage === "dawr" && words.length > 0 && (
                  <label className="mt-4 block text-xs text-parchment-muted">
                    Time slider: drag to check yourself word by word
                    <input
                      type="range"
                      min={0}
                      max={words.length}
                      value={portion.revealedBySlider}
                      onChange={(e) => dispatch({ type: "slide", to: Number(e.target.value) })}
                      className="mt-1 w-full accent-[rgb(var(--teal))]"
                    />
                  </label>
                )}
              </>
            ) : (
              <>
                <p className="mt-3 text-sm text-parchment-muted">
                  Close your eyes and recite the page. Stuck? Open them and tap the covered word you need; it&apos;s saved as a trigger word. Then, honestly:
                </p>
                {eyesPeeks > 0 && (
                  <p className="mt-2 rounded-xl bg-hint/10 px-3 py-2 text-xs">
                    {eyesPeeks} word{eyesPeeks === 1 ? "" : "s"} uncovered, so this round counts as Hard at best.
                  </p>
                )}
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {RATINGS.map((r) => (
                    <button
                      key={r.v}
                      onClick={() => rate(r.v)}
                      disabled={eyesPeeks > 0 && r.v >= 3}
                      title={r.hint}
                      className={`flex h-14 flex-col items-center justify-center rounded-2xl border text-sm transition-colors disabled:opacity-30 ${
                        r.v >= 3 ? "border-teal/30 hover:bg-teal/10" : "border-border hover:border-hint/60"
                      }`}
                    >
                      <span className="font-medium">{r.label} <Kbd>{r.v}</Kbd></span>
                      <span className="text-[10px] text-parchment-muted">{r.hint}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <label className="flex items-center gap-2 px-2 text-xs text-parchment-muted">
            <input type="checkbox" checked={join} onChange={(e) => setJoin(e.target.checked)} className="accent-[rgb(var(--teal))]" />
            <Link2 size={13} /> Join pages: start from the previous page&apos;s last line
          </label>
          <Link href="/today" className="flex items-center gap-1.5 px-2 text-xs text-parchment-muted hover:text-parchment">
            <Flag size={13} /> Stop here; the rest stays on today&apos;s plan
          </Link>
          {mode === "covered" && <FlagCovers page={page} line={activeKey ? Number(activeKey.split(":")[1]) : null} />}
        </aside>
      </div>
    </SessionShell>
  );
}
