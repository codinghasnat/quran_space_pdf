"use client";

import Link from "next/link";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Check, EyeOff, Flag, Headphones, Link2, SkipForward, Sparkles, Undo2 } from "lucide-react";
import { makeChunks, nextPhase, phasesFor, type MicroPhase, type Stage } from "@/lib/hifz/chunks";
import { useKeys, usePages, useStageTimer } from "@/lib/hifz/hooks";
import {
  activeLineKey, initialPortion, portionDone, portionResult, portionWords, reducePortion, type PortionAction, type PortionState,
} from "@/lib/hifz/portion";
import { lineId, type LineInfo } from "@/lib/hifz/quran";
import { recordPortion } from "@/lib/hifz/record";
import { append, newId, updateSettings } from "@/lib/hifz/store";
import type { LineRef } from "@/lib/hifz/types";
import { ayahsOfLines } from "@/lib/hifz/useAyahPlayer";
import { useJourney } from "@/lib/hifz/useJourney";
import AyahPlayer from "./AyahPlayer";
import FlagCovers from "./FlagCovers";
import MushafPage from "./MushafPage";
import SessionShell, { chime, RepRing } from "./SessionShell";
import { describeLines } from "./TodayScreen";

const BLUR_PX = [0, 1.2, 2.4, 4, 6, 9, 14];
const MAX_BLUR = BLUR_PX.length - 1;
const PHASE_LABEL: Record<MicroPhase, string> = { listen: "Listen", read: "Read", blur: "Blur", recite: "Recite", join: "Join" };

type Progress = {
  v: 2;
  day: string;
  lines: LineRef[];
  chunkSize: number;
  stage: Stage;
  chunk: number;
  phase: MicroPhase;
  blur: Record<string, number>;
  blurCursor: number;
  reads: number;
  chunkClean: number;
  joinClean: number;
  attempts: number; // whole-sabaq covered attempts
  firstCleanAt: number | null;
  coveredClean: number;
  eyesClean: number;
  seconds: number;
  saved: boolean;
};

const KEY = "hifz:sabaq-progress";

function loadProgress(day: string): Progress | null {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? "null") as Progress | null;
    return p && p.v === 2 && p.day === day ? p : null;
  } catch {
    return null;
  }
}

export default function SabaqSession() {
  const journey = useJourney();
  const [progress, setProgress] = useState<Progress | null>(null);

  // Freeze today's lines when the session starts, so they can't shift while you learn them
  useEffect(() => {
    if (!journey || progress) return;
    const saved = loadProgress(journey.day);
    if (saved) return setProgress(saved);
    const lines = journey.plan.sabaq?.lines;
    if (!lines?.length) return;
    setProgress({
      v: 2,
      day: journey.day,
      lines: lines.map((l) => ({ page: l.page, line: l.line })),
      chunkSize: journey.data.settings.chunkLines,
      stage: "chunks",
      chunk: 0,
      phase: "listen",
      blur: {},
      blurCursor: 0,
      reads: 0,
      chunkClean: 0,
      joinClean: 0,
      attempts: 0,
      firstCleanAt: null,
      coveredClean: 0,
      eyesClean: 0,
      seconds: 0,
      saved: false,
    });
  }, [journey, progress]);

  useEffect(() => {
    if (!progress) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(progress));
    } catch {}
  }, [progress]);

  // Stable across the per-second timer updates, so covers and blur don't reset while you recite
  const lineKey = progress ? JSON.stringify(progress.lines) : "";
  const lines = useMemo(
    () =>
      progress && journey
        ? progress.lines.map((l) => journey.index.byPage.get(l.page)?.find((x) => x.line === l.line)).filter((l): l is LineInfo => !!l)
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lineKey, journey?.index],
  );

  if (!journey) return <div className="p-10"><div className="h-96 animate-pulse rounded-3xl bg-surface-raised" /></div>;
  if (!progress) {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <p className="font-serif text-2xl">{journey.plan.sabaqToday ? "Today's sabaq is done" : "No sabaq planned today"}</p>
        <p className="mt-2 text-sm text-parchment-muted">
          {journey.plan.sabaqToday ? "Rest it overnight; sabqi will check it tomorrow." : journey.plan.notes[0] ?? "Sabqi comes first today."}
        </p>
        <Link href="/today" className="mt-6 inline-flex h-10 items-center rounded-full bg-teal px-5 text-sm font-semibold text-bg">Back to Today</Link>
      </div>
    );
  }
  return <Sabaq progress={progress} setProgress={setProgress} lines={lines} journey={journey} />;
}

function Sabaq({
  progress, setProgress, lines, journey,
}: {
  progress: Progress;
  setProgress: React.Dispatch<React.SetStateAction<Progress | null>>;
  lines: LineInfo[];
  journey: NonNullable<ReturnType<typeof useJourney>>;
}) {
  const { settings } = journey.data;
  const { stage, chunk, phase } = progress;
  const set = (fn: (p: Progress) => Progress) => setProgress((p) => (p ? fn(p) : p));

  const chunks = useMemo(() => makeChunks(lines, progress.chunkSize), [lines, progress.chunkSize]);
  const chunkLines = useMemo(() => chunks[Math.min(chunk, chunks.length - 1)] ?? [], [chunks, chunk]);
  // The lines in play right now: one piece while learning it, everything so far when joining, all of it after
  const active = useMemo(() => {
    if (stage !== "chunks") return lines;
    if (phase === "join") return chunks.slice(0, chunk + 1).flat();
    return chunkLines;
  }, [stage, phase, chunk, chunks, chunkLines, lines]);

  const pageNums = useMemo(() => [...new Set(lines.map((l) => l.page))].sort((a, b) => a - b), [lines]);
  const { pages } = usePages(pageNums);
  const byPage = useMemo(() => {
    const m = new Map<number, number[]>();
    for (const l of active) m.set(l.page, [...(m.get(l.page) ?? []), l.line]);
    return m;
  }, [active]);
  const words = useMemo(() => (pages ? portionWords(pages, byPage) : []), [pages, byPage]);
  const [portion, dispatch] = useReducer((s: PortionState, a: PortionAction) => reducePortion(words, s, a), undefined, () => initialPortion([]));
  useEffect(() => dispatch({ type: "reset" }), [words]);

  const timer = useStageTimer();
  const startSeconds = useRef(progress.seconds);
  const totalSeconds = startSeconds.current + timer.seconds;
  useEffect(() => {
    set((p) => ({ ...p, seconds: startSeconds.current + timer.seconds }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer.seconds]);

  const [flash, setFlash] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{ clean: boolean; slips: number } | null>(null);
  const [blurBoost, setBlurBoost] = useState(0);
  const toast = (t: string) => {
    setFlash(t);
    setTimeout(() => setFlash(null), 2200);
  };
  const ayahs = useMemo(() => ayahsOfLines(chunkLines), [chunkLines]);
  const covering = stage === "whole" || stage === "eyes" || (stage === "chunks" && (phase === "recite" || phase === "join"));

  // --- Moving through the micro loop
  const goPhase = (p: MicroPhase) => {
    setLastResult(null);
    set((x) => ({ ...x, phase: p, chunkClean: p === "recite" ? 0 : x.chunkClean, joinClean: p === "join" ? 0 : x.joinClean }));
  };
  const finishChunk = () => {
    setLastResult(null);
    if (chunk + 1 < chunks.length) {
      toast(chunk === 0 ? "First piece is yours. On to the next." : `Pieces 1–${chunk + 1} joined. On to the next.`);
      set((x) => ({ ...x, chunk: x.chunk + 1, phase: "listen", reads: 0, chunkClean: 0, joinClean: 0 }));
    } else {
      chime(true);
      toast("Every piece learned and joined. Now the whole sabaq.");
      set((x) => ({ ...x, stage: "whole" }));
    }
  };
  const advance = () => {
    const n = nextPhase(chunk, phase);
    if (n) goPhase(n);
    else finishChunk();
  };

  // --- Blur: round-robin through the piece's lines; each clean read frosts that line a little more
  const chunkKeys = chunkLines.map((l) => lineId(l));
  const level = (k: string) => progress.blur[k] ?? 0;
  const blurDone = chunkKeys.every((k) => level(k) >= MAX_BLUR);
  const cursor = chunkKeys[(progress.blurCursor ?? 0) % Math.max(1, chunkKeys.length)];
  const blurGlow = blurDone ? null : cursor && level(cursor) < MAX_BLUR ? cursor : chunkKeys.find((k) => level(k) < MAX_BLUR) ?? null;
  const blurStep = (delta: number) => {
    if (!blurGlow) return;
    const blur = { ...progress.blur, [blurGlow]: Math.max(0, Math.min(MAX_BLUR, level(blurGlow) + delta)) };
    let next = chunkKeys.indexOf(blurGlow);
    if (delta > 0) {
      for (let i = 1; i <= chunkKeys.length; i++) {
        const j = (chunkKeys.indexOf(blurGlow) + i) % chunkKeys.length;
        if ((blur[chunkKeys[j]] ?? 0) < MAX_BLUR) {
          next = j;
          break;
        }
      }
    }
    set((p) => ({ ...p, blur, blurCursor: next }));
    if (chunkKeys.every((k) => (blur[k] ?? 0) >= MAX_BLUR)) {
      chime();
      toast("Frosted over. Now recite it covered.");
    }
  };

  // --- A covered recitation finished (piece, join or whole)
  const finishCovered = () => {
    const result = portionResult(words, portion);
    recordPortion("sabaq", "covered", result, timer.takeLap());
    const slips = result.peeked.length + result.wrongWords.length;
    setLastResult({ clean: result.clean, slips });
    dispatch({ type: "reset" });
    if (stage === "whole") {
      set((p) => {
        const attempts = p.attempts + 1;
        return {
          ...p,
          attempts,
          firstCleanAt: p.firstCleanAt ?? (result.clean ? attempts : null),
          coveredClean: p.coveredClean + (result.clean ? 1 : 0),
        };
      });
      if (result.clean) chime(progress.coveredClean + 1 === settings.coveredReps);
      return;
    }
    if (!result.clean) return;
    if (phase === "recite") {
      const n = progress.chunkClean + 1;
      chime(n >= settings.chunkReps);
      set((p) => ({ ...p, chunkClean: n }));
      if (n >= settings.chunkReps) setTimeout(advance, 700);
    } else if (phase === "join") {
      const n = progress.joinClean + 1;
      chime(n >= settings.linkReps);
      set((p) => ({ ...p, joinClean: n }));
      if (n >= settings.linkReps) setTimeout(finishChunk, 700);
    }
  };
  // Recited from your own mushaf or memory, without the covers: count it on your word
  const tick = (which: "recite" | "join") => {
    setLastResult(null);
    if (which === "recite") {
      const n = progress.chunkClean + 1;
      chime(n >= settings.chunkReps);
      set((p) => ({ ...p, chunkClean: n }));
      if (n >= settings.chunkReps) setTimeout(advance, 700);
    } else {
      const n = progress.joinClean + 1;
      chime(n >= settings.linkReps);
      set((p) => ({ ...p, joinClean: n }));
      if (n >= settings.linkReps) setTimeout(finishChunk, 700);
    }
  };

  useEffect(() => {
    if (covering && stage !== "eyes" && words.length && portionDone(portion)) finishCovered();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portion]);

  // --- Eyes closed: the covered page stays up; a word tapped open counts against the round
  const eyesPeeks = stage === "eyes" ? portion.marks.filter((m) => m === "peeked").length : 0;
  const eyesRound = (clean: boolean) => {
    const result = portionResult(words, portion);
    const ok = clean && result.peeked.length === 0;
    recordPortion("sabaq", "eyesClosed", result, timer.takeLap(), ok ? 4 : 1);
    dispatch({ type: "reset" });
    setLastResult({ clean: ok, slips: result.peeked.length || (ok ? 0 : 1) });
    if (!ok) return;
    const n = progress.eyesClean + 1;
    chime(n >= settings.eyesClosedReps);
    if (n >= settings.eyesClosedReps) settle(true, { ...progress, eyesClean: n });
    else set((p) => ({ ...p, eyesClean: n }));
  };

  const settle = (settled: boolean, p: Progress = progress) => {
    if (p.saved) return;
    append("sabaqs", {
      id: newId(),
      day: p.day,
      lines: p.lines,
      settled,
      repsToFirstClean: p.firstCleanAt ?? p.attempts,
      coveredClean: p.coveredClean,
      eyesClosedClean: p.eyesClean,
      seconds: startSeconds.current + timer.seconds,
    });
    append("sessions", { id: newId(), day: p.day, stage: "sabaq", startedAt: new Date().toISOString(), seconds: startSeconds.current + timer.seconds });
    set((x) => ({ ...x, eyesClean: p.eyesClean, saved: true, stage: settled ? "settled" : x.stage }));
    timer.setPaused(true);
  };

  useKeys((e) => {
    const k = e.key.toLowerCase();
    if (stage === "chunks" && phase === "blur") {
      if (k === " " || k === "enter") (e.preventDefault(), blurStep(1));
      else if (k === "backspace") (e.preventDefault(), blurStep(-1));
    } else if (covering && stage !== "eyes") {
      if (k === "t" && stage === "chunks") tick(phase === "join" ? "join" : "recite");
      else if (k === " " || k === "enter") (e.preventDefault(), dispatch({ type: "check" }));
      else if (k === "z" || k === "backspace") dispatch({ type: "undo" });
    } else if (stage === "eyes") {
      if (k === "c" && eyesPeeks === 0) eyesRound(true);
      else if (k === "s") eyesRound(false);
    } else if (stage === "chunks" && phase === "read" && (k === " " || k === "enter")) {
      e.preventDefault();
      set((p) => ({ ...p, reads: p.reads + 1 }));
    }
  });

  const eyesUnlocked = progress.coveredClean >= settings.coveredReps;
  const steps = [
    {
      key: "chunks",
      label: `Learn in pieces ${stage === "chunks" ? chunk : chunks.length}/${chunks.length}`,
      done: stage !== "chunks",
      locked: false,
      onClick: () => set((p) => ({ ...p, stage: "chunks" })),
    },
    {
      key: "whole",
      label: `Whole sabaq ${Math.min(progress.coveredClean, settings.coveredReps)}/${settings.coveredReps}`,
      done: eyesUnlocked,
      locked: stage === "chunks",
      onClick: () => set((p) => ({ ...p, stage: "whole" })),
    },
    {
      key: "eyes",
      label: `Eyes closed ${progress.eyesClean}/${settings.eyesClosedReps}`,
      done: false,
      locked: !eyesUnlocked,
      onClick: () => set((p) => ({ ...p, stage: "eyes" })),
    },
  ].map((s) => ({ ...s, locked: s.locked || progress.saved }));

  const glow = (page: number): number | null => {
    if (stage === "chunks" && phase === "blur" && blurGlow) {
      const [pg, ln] = blurGlow.split(":").map(Number);
      return pg === page ? ln : null;
    }
    if (covering && stage !== "eyes") {
      const k = activeLineKey(words, portion);
      if (!k) return null;
      const [pg, ln] = k.split(":").map(Number);
      return pg === page ? ln : null;
    }
    return null;
  };

  if (stage === "settled") return <Settled progress={progress} lines={lines} seconds={totalSeconds} />;

  const joinedLines = chunks.slice(0, chunk + 1).flat().length;

  return (
    <SessionShell
      title="Sabaq"
      subtitle={`${describeLines(lines)} · ${lines.length} lines`}
      seconds={totalSeconds}
      paused={timer.paused}
      onTogglePause={timer.toggle}
      steps={steps}
      step={stage}
    >
      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="flex flex-row-reverse justify-center gap-6">
          {!pages ? (
            <div className="aspect-[3/5] h-[calc(100vh-8.5rem)] animate-pulse rounded-3xl bg-surface-raised" />
          ) : (
            pages.map((pg) => (
              <div key={pg.page} className="min-w-0">
                <MushafPage
                  data={pg}
                  focus={byPage.get(pg.page) ?? []}
                  glowLine={glow(pg.page)}
                  blur={
                    stage === "chunks" && phase === "blur"
                      ? new Map(
                          chunkLines
                            .filter((l) => l.page === pg.page)
                            .map((l) => [l.line, BLUR_PX[Math.max(0, Math.min(MAX_BLUR, level(lineId(l)) + blurBoost))]]),
                        )
                      : undefined
                  }
                  portion={covering ? { words, state: portion, onTap: (i) => dispatch({ type: "tap", index: i }) } : undefined}
                  glossOnTap={stage === "chunks" && (phase === "read" || phase === "listen")}
                  eyesClosed={stage === "eyes"}
                />
                <p className="mt-2 text-center text-xs text-parchment-muted">Page {pg.page}</p>
              </div>
            ))
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          {stage === "chunks" && (
            <Panel>
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wider text-teal">
                  Piece {chunk + 1} of {chunks.length}
                </p>
                <p className="text-xs text-parchment-muted">{describeLines(chunkLines)}</p>
              </div>
              <div className="mt-3 flex gap-1.5">
                {chunks.map((_, i) => (
                  <span
                    key={i}
                    className={`h-2 flex-1 rounded-full transition-all duration-500 ${
                      i < chunk ? "bg-heat-strong" : i === chunk ? "bg-teal shadow-[0_0_10px_rgb(var(--teal)/0.6)]" : "bg-heat-blank"
                    }`}
                  />
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-1">
                {phasesFor(chunk).map((p, i, order) => {
                  const reached = i <= order.indexOf(phase);
                  return (
                    <button
                      key={p}
                      onClick={() => goPhase(p)}
                      className={`h-7 rounded-full px-3 text-xs transition-colors ${
                        p === phase ? "bg-teal text-bg" : reached ? "bg-teal/10 text-teal" : "text-parchment-muted hover:text-parchment"
                      }`}
                    >
                      {p === "join" ? (
                        <span className="flex items-center gap-1">
                          <Link2 size={11} /> Join
                        </span>
                      ) : (
                        PHASE_LABEL[p]
                      )}
                    </button>
                  );
                })}
                <button onClick={finishChunk} className="ml-auto flex h-7 items-center gap-1 rounded-full px-3 text-xs text-parchment-muted hover:text-teal">
                  {chunk + 1 < chunks.length ? "Next piece" : "Whole sabaq"} <SkipForward size={12} />
                </button>
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-parchment-muted">
                A guide, not a gate: learn from your own mushaf and use whichever steps help. Tick a repetition off here when you&apos;ve done it.
              </p>
            </Panel>
          )}

          <Panel>
            {stage === "chunks" && phase === "listen" && (
              <>
                <PanelTitle icon={<Headphones size={16} />} title="Listen to this piece" text="Just this piece, on a loop, until the sound feels familiar. Follow it in your mushaf." />
                <PrimaryButton onClick={advance}>I&apos;ve listened · read it</PrimaryButton>
              </>
            )}
            {stage === "chunks" && phase === "read" && (
              <>
                <PanelTitle title="Read it, then read it alone" text="Recite along with the page, then by yourself. Tap a word to see its meaning." />
                <div className="mt-4 flex items-center gap-4">
                  <RepRing done={progress.reads} target={Math.max(5, progress.reads)} label="reads" size={60} />
                  <button onClick={() => set((p) => ({ ...p, reads: p.reads + 1 }))} className="h-10 flex-1 rounded-full border border-border text-sm hover:border-teal/50">
                    + I read it through <Kbd>Space</Kbd>
                  </button>
                </div>
                <PrimaryButton onClick={advance}>Start blurring</PrimaryButton>
              </>
            )}
            {stage === "chunks" && phase === "blur" && (
              <>
                <PanelTitle title="Let it frost over" text="Recite the glowing line, then press Space. Each clean read frosts it a little more." />
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button onClick={() => blurStep(-1)} className="h-11 rounded-full border border-border text-sm hover:border-teal/50">
                    Not yet <Kbd>⌫</Kbd>
                  </button>
                  <button onClick={() => blurStep(1)} className="h-11 rounded-full bg-teal text-sm font-semibold text-bg">
                    Recited it <Kbd dark>Space</Kbd>
                  </button>
                </div>
                <label className="mt-4 block text-xs text-parchment-muted">
                  Extra blur
                  <input type="range" min={-3} max={3} value={blurBoost} onChange={(e) => setBlurBoost(Number(e.target.value))} className="mt-1 w-full accent-[rgb(var(--teal))]" />
                </label>
                {blurDone && <PrimaryButton onClick={advance}>Recite it covered</PrimaryButton>}
              </>
            )}
            {stage === "chunks" && phase === "recite" && (
              <CoveredPanel
                title="Recite this piece covered"
                text="Recite the line, then press Space to check it. Peeking first doesn't count."
                done={progress.chunkClean}
                target={settings.chunkReps}
                onTick={() => tick("recite")}
                last={lastResult}
                onCheck={() => dispatch({ type: "check" })}
                onUndo={() => dispatch({ type: "undo" })}
              />
            )}
            {stage === "chunks" && phase === "join" && (
              <CoveredPanel
                title={`Join it on: ${joinedLines} lines from the start`}
                text="Recite from the start of the sabaq through the new piece, so the pieces become one."
                done={progress.joinClean}
                target={settings.linkReps}
                onTick={() => tick("join")}
                last={lastResult}
                onCheck={() => dispatch({ type: "check" })}
                onUndo={() => dispatch({ type: "undo" })}
              />
            )}
            {stage === "whole" && (
              <>
                <CoveredPanel
                  title="The whole sabaq, covered"
                  text="All of it, end to end. Only clean rounds count."
                  done={Math.min(progress.coveredClean, settings.coveredReps)}
                  target={settings.coveredReps}
                  last={lastResult}
                  onCheck={() => dispatch({ type: "check" })}
                  onUndo={() => dispatch({ type: "undo" })}
                />
                {eyesUnlocked && (
                  <PrimaryButton onClick={() => (setLastResult(null), set((p) => ({ ...p, stage: "eyes" })))}>
                    <EyeOff size={16} /> Now with eyes closed
                  </PrimaryButton>
                )}
              </>
            )}
            {stage === "eyes" && (
              <>
                <div className="flex items-center gap-4">
                  <RepRing done={progress.eyesClean} target={settings.eyesClosedReps} size={76} />
                  <div className="flex-1">
                    <p className="flex items-center gap-2 font-serif text-xl">
                      <EyeOff size={18} className="text-teal" /> Eyes closed
                    </p>
                    <p className="text-xs text-parchment-muted">
                      Recite the whole sabaq and say each ayah&apos;s meaning after it. Stuck? Open your eyes and tap the covered word you need.
                    </p>
                  </div>
                </div>
                {eyesPeeks > 0 && (
                  <p className="mt-3 rounded-xl bg-hint/10 px-3 py-2 text-xs">
                    {eyesPeeks} word{eyesPeeks === 1 ? "" : "s"} uncovered: this round won&apos;t count, but they&apos;re saved as trigger words.
                  </p>
                )}
                {lastResult && !eyesPeeks && (
                  <p className={`mt-3 rounded-xl px-3 py-2 text-sm ${lastResult.clean ? "bg-heat-strong/10 text-heat-strong" : "bg-hint/10"}`}>
                    {lastResult.clean ? "Clean. Again." : "That one slipped. Breathe, and go again."}
                  </p>
                )}
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button onClick={() => eyesRound(false)} className="h-12 rounded-full border border-border text-sm hover:border-hint/60">
                    {eyesPeeks ? "Next round" : "I slipped"} <Kbd>S</Kbd>
                  </button>
                  <button onClick={() => eyesRound(true)} disabled={eyesPeeks > 0} className="h-12 rounded-full bg-teal text-sm font-semibold text-bg disabled:opacity-30">
                    Clean <Kbd dark>C</Kbd>
                  </button>
                </div>
              </>
            )}
          </Panel>

          {stage === "chunks" && (phase === "listen" || phase === "read") && (
            <AyahPlayer ayahs={ayahs} reciter={settings.reciter} onReciter={(r) => updateSettings((s) => ({ ...s, reciter: r }))} autoPlay={phase === "listen"} />
          )}

          {covering && stage !== "eyes" && (() => {
            const k = activeLineKey(words, portion);
            return k ? <FlagCovers page={Number(k.split(":")[0])} line={Number(k.split(":")[1])} /> : null;
          })()}

          <div className="flex items-center justify-between px-2 text-xs text-parchment-muted">
            <button
              onClick={() => confirm("End today's sabaq here? It hasn't settled yet, so it comes back tomorrow.") && settle(false)}
              disabled={progress.saved}
              className="flex items-center gap-1.5 hover:text-parchment disabled:opacity-40"
            >
              <Flag size={13} /> {progress.saved ? "Saved for tomorrow" : "End for today"}
            </button>
            {stage === "chunks" && (
              <button
                onClick={() => confirm("Skip the pieces and go straight to the whole sabaq?") && set((p) => ({ ...p, stage: "whole" }))}
                className="flex items-center gap-1.5 hover:text-parchment"
              >
                <SkipForward size={13} /> I know these pieces
              </button>
            )}
          </div>
          {progress.saved && <Link href="/today" className="block rounded-full bg-surface-raised py-2.5 text-center text-sm">Back to Today</Link>}
        </aside>
      </div>

      {flash && (
        <div className="pop-in fixed bottom-8 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full bg-parchment px-5 py-3 text-sm text-bg shadow-2xl">
          <Sparkles size={15} /> {flash}
        </div>
      )}
    </SessionShell>
  );
}

function CoveredPanel({
  title, text, done, target, last, onCheck, onUndo, onTick,
}: {
  title: string;
  text: string;
  done: number;
  target: number;
  onTick?: () => void;
  last: { clean: boolean; slips: number } | null;
  onCheck: () => void;
  onUndo: () => void;
}) {
  return (
    <>
      <div className="flex items-center gap-4">
        <RepRing done={done} target={target} size={76} />
        <div className="flex-1">
          <p className="font-serif text-xl leading-tight">{title}</p>
          <p className="mt-1 text-xs text-parchment-muted">{text}</p>
        </div>
      </div>
      {last && (
        <p className={`mt-3 rounded-xl px-3 py-2 text-sm ${last.clean ? "bg-heat-strong/10 text-heat-strong" : "bg-hint/10 text-parchment"}`}>
          {last.clean ? "Clean. Again, from the top." : `${last.slips} slip${last.slips === 1 ? "" : "s"}; those words are tomorrow's focus. Again.`}
        </p>
      )}
      <div className="mt-4 grid grid-cols-[auto_1fr] gap-2">
        <button onClick={onUndo} aria-label="Undo" className="flex h-11 w-11 items-center justify-center rounded-full border border-border hover:border-teal/50">
          <Undo2 size={16} />
        </button>
        <button onClick={onCheck} className="h-11 rounded-full bg-teal text-sm font-semibold text-bg">
          Check line <Kbd dark>Space</Kbd>
        </button>
      </div>
      {onTick && (
        <button onClick={onTick} className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-full border border-border text-sm hover:border-teal/50">
          <Check size={14} /> Recited it cleanly, without the screen <Kbd>T</Kbd>
        </button>
      )}
    </>
  );
}

function Settled({ progress, lines, seconds }: { progress: Progress; lines: LineInfo[]; seconds: number }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-6">
      <div className="aurora pointer-events-none absolute inset-0" />
      <div className="relative max-w-lg text-center">
        <span className="pop-in mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-teal text-bg glow-breathe">
          <Check size={36} />
        </span>
        <p className="mt-6 text-xs font-medium uppercase tracking-[0.2em] text-teal">Sabaq settled</p>
        <h1 className="mt-2 font-serif text-4xl">{describeLines(lines)}</h1>
        <p className="mt-3 text-parchment-muted">
          {progress.coveredClean} clean covered repetitions and {progress.eyesClean} with eyes closed, in {Math.round(seconds / 60)} minutes.
          {progress.firstCleanAt ? ` First clean whole recitation on attempt ${progress.firstCleanAt}.` : ""}
        </p>
        <p className="mt-4 font-serif text-lg">Rest it tonight. Sabqi will check it tomorrow.</p>
        <Link href="/today" className="mt-8 inline-flex h-12 items-center rounded-full bg-teal px-7 text-sm font-semibold text-bg glow-soft">
          Back to Today
        </Link>
      </div>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="rounded-[24px] border border-border bg-surface p-5 shadow-[0_10px_40px_-24px_rgb(var(--teal)/0.5)]">{children}</div>;
}

function PanelTitle({ title, text, icon }: { title: string; text: string; icon?: React.ReactNode }) {
  return (
    <>
      <p className="flex items-center gap-2 font-serif text-xl">{icon}{title}</p>
      <p className="mt-1 text-sm leading-relaxed text-parchment-muted">{text}</p>
    </>
  );
}

function PrimaryButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="glow-breathe mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-teal text-sm font-semibold text-bg transition-transform active:scale-[0.98]">
      {children}
    </button>
  );
}

export function Kbd({ children, dark }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <kbd className={`ml-1.5 rounded-md px-1.5 py-0.5 font-sans text-[10px] ${dark ? "bg-bg/20 text-bg" : "bg-parchment-muted/10 text-parchment-muted"}`}>
      {children}
    </kbd>
  );
}
