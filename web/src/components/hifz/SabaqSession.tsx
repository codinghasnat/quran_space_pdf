"use client";

import Link from "next/link";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Check, EyeOff, Flag, Headphones, Sparkles, Undo2 } from "lucide-react";
import { useKeys, usePages, useStageTimer } from "@/lib/hifz/hooks";
import { activeLineKey, initialPortion, portionDone, portionResult, portionWords, reducePortion, type PortionAction, type PortionState } from "@/lib/hifz/portion";
import { lineId, type LineInfo } from "@/lib/hifz/quran";
import { recordEyesClosed, recordPortion } from "@/lib/hifz/record";
import { append, newId, updateSettings } from "@/lib/hifz/store";
import type { LineRef } from "@/lib/hifz/types";
import { ayahsOfLines } from "@/lib/hifz/useAyahPlayer";
import { useJourney } from "@/lib/hifz/useJourney";
import AyahPlayer from "./AyahPlayer";
import FlagCovers from "./FlagCovers";
import MushafPage from "./MushafPage";
import SessionShell, { chime, RepRing } from "./SessionShell";
import { describeLines } from "./TodayScreen";

type Step = "listen" | "read" | "blur" | "covered" | "eyes" | "settled";
const STEPS: { key: Step; label: string }[] = [
  { key: "listen", label: "Listen" },
  { key: "read", label: "Read" },
  { key: "blur", label: "Blur" },
  { key: "covered", label: "Recite" },
  { key: "eyes", label: "Eyes closed" },
];
const BLUR_PX = [0, 1.2, 2.4, 4, 6, 9, 14];
const MAX_BLUR = BLUR_PX.length - 1;

type Progress = {
  day: string;
  lines: LineRef[];
  step: Step;
  blur: Record<string, number>;
  blurCursor: number;
  reads: number;
  attempts: number; // covered attempts
  firstCleanAt: number | null;
  coveredClean: number;
  eyesClean: number;
  redoCovered: boolean; // an eyes-closed round failed: one clean covered repetition before trying again
  seconds: number;
  saved: boolean;
};

const KEY = "hifz:sabaq-progress";

function loadProgress(day: string): Progress | null {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? "null") as Progress | null;
    return p && p.day === day ? p : null;
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
      day: journey.day,
      lines: lines.map((l) => ({ page: l.page, line: l.line })),
      step: "listen",
      blur: {},
      blurCursor: 0,
      reads: 0,
      attempts: 0,
      firstCleanAt: null,
      coveredClean: 0,
      eyesClean: 0,
      redoCovered: false,
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
  const lines = progress.lines
    .map((l) => journey.index.byPage.get(l.page)?.find((x) => x.line === l.line))
    .filter((l): l is LineInfo => !!l);
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
  const pageNums = useMemo(() => [...new Set(lines.map((l) => l.page))].sort((a, b) => a - b), [lines]);
  const { pages } = usePages(pageNums);
  const byPage = useMemo(() => {
    const m = new Map<number, number[]>();
    for (const l of lines) m.set(l.page, [...(m.get(l.page) ?? []), l.line]);
    return m;
  }, [lines]);
  const words = useMemo(() => (pages ? portionWords(pages, byPage) : []), [pages, byPage]);
  const [portion, dispatch] = useReducer(
    (s: PortionState, a: PortionAction) => reducePortion(words, s, a),
    undefined,
    () => initialPortion([]),
  );
  useEffect(() => dispatch({ type: "reset" }), [words]);
  const timer = useStageTimer();
  const [flash, setFlash] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{ clean: boolean; slips: number } | null>(null);
  const [blurBoost, setBlurBoost] = useState(0);
  const startSeconds = useRef(progress.seconds);
  const ayahs = useMemo(() => ayahsOfLines(lines), [lines]);
  const set = (fn: (p: Progress) => Progress) => setProgress((p) => (p ? fn(p) : p));
  const step = progress.step;
  const totalSeconds = startSeconds.current + timer.seconds;

  useEffect(() => {
    set((p) => ({ ...p, seconds: startSeconds.current + timer.seconds }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer.seconds]);

  const toast = (t: string) => {
    setFlash(t);
    setTimeout(() => setFlash(null), 1800);
  };

  // --- Blur: round-robin through the lines; each clean read frosts that line a little more
  const lineKeys = lines.map((l) => lineId(l));
  const level = (k: string) => progress.blur[k] ?? 0;
  const blurLevel = (k: string) => Math.max(0, Math.min(MAX_BLUR, level(k) + blurBoost));
  const blurDone = lineKeys.every((k) => level(k) >= MAX_BLUR);
  const cursor = lineKeys[(progress.blurCursor ?? 0) % Math.max(1, lineKeys.length)];
  const blurGlow = blurDone ? null : level(cursor) < MAX_BLUR ? cursor : lineKeys.find((k) => level(k) < MAX_BLUR) ?? null;
  const blurStep = (delta: number) => {
    if (!blurGlow) return;
    const blur = { ...progress.blur, [blurGlow]: Math.max(0, Math.min(MAX_BLUR, level(blurGlow) + delta)) };
    let next = lineKeys.indexOf(blurGlow);
    if (delta > 0) {
      for (let i = 1; i <= lineKeys.length; i++) {
        const j = (lineKeys.indexOf(blurGlow) + i) % lineKeys.length;
        if ((blur[lineKeys[j]] ?? 0) < MAX_BLUR) {
          next = j;
          break;
        }
      }
    }
    set((p) => ({ ...p, blur, blurCursor: next }));
    if (lineKeys.every((k) => (blur[k] ?? 0) >= MAX_BLUR)) {
      chime(true);
      toast("Fully frosted. Time to recite it covered.");
    }
  };

  // --- Covered: recite, then check each line
  const finishCovered = () => {
    const result = portionResult(words, portion);
    const secs = timer.takeLap();
    recordPortion("sabaq", "covered", result, secs);
    const slips = result.peeked.length + result.wrongWords.length;
    setLastResult({ clean: result.clean, slips });
    set((p) => {
      const attempts = p.attempts + 1;
      const firstCleanAt = p.firstCleanAt ?? (result.clean ? attempts : null);
      if (p.redoCovered && result.clean) return { ...p, attempts, firstCleanAt, redoCovered: false, step: "eyes" };
      return { ...p, attempts, firstCleanAt, coveredClean: p.coveredClean + (result.clean ? 1 : 0) };
    });
    if (result.clean) {
      chime(progress.coveredClean + 1 === settings.coveredReps);
      if (progress.redoCovered) toast("Clean. Back to eyes closed.");
    }
    dispatch({ type: "reset" });
  };
  useEffect(() => {
    if (step === "covered" && words.length && portionDone(portion)) finishCovered();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portion]);

  // --- Eyes closed
  const eyesRound = (clean: boolean) => {
    recordEyesClosed("sabaq", byPage, timer.takeLap(), clean ? 4 : 1);
    if (clean) {
      const n = progress.eyesClean + 1;
      chime(n >= settings.eyesClosedReps);
      if (n >= settings.eyesClosedReps) {
        settle(true, { ...progress, eyesClean: n });
        return;
      }
      set((p) => ({ ...p, eyesClean: n }));
    } else {
      set((p) => ({ ...p, redoCovered: true, step: "covered" }));
      toast("No problem. One clean covered repetition, then try again.");
    }
  };
  const failEyes = () => {
    recordEyesClosed("sabaq", byPage, timer.takeLap(), 1);
    set((p) => ({ ...p, redoCovered: true, step: "covered" }));
    toast("You looked, so this round doesn't count. One clean covered repetition, then try again.");
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
    set((x) => ({ ...x, eyesClean: p.eyesClean, saved: true, step: settled ? "settled" : x.step }));
    timer.setPaused(true);
  };

  useKeys((e) => {
    const k = e.key.toLowerCase();
    if (step === "blur") {
      if (k === " " || k === "enter") (e.preventDefault(), blurStep(1));
      else if (k === "backspace") (e.preventDefault(), blurStep(-1));
    } else if (step === "covered") {
      if (k === " " || k === "enter") (e.preventDefault(), dispatch({ type: "check" }));
      else if (k === "z" || k === "backspace") dispatch({ type: "undo" });
    } else if (step === "eyes") {
      if (k === "c") eyesRound(true);
      else if (k === "s") eyesRound(false);
    }
  });

  const coveredUnlocked = blurDone || progress.coveredClean > 0;
  const eyesUnlocked = progress.coveredClean >= settings.coveredReps;
  const steps = STEPS.map((s) => ({
    key: s.key,
    label: s.key === "covered" ? `Recite ${Math.min(progress.coveredClean, settings.coveredReps)}/${settings.coveredReps}` : s.key === "eyes" ? `Eyes closed ${progress.eyesClean}/${settings.eyesClosedReps}` : s.label,
    done:
      (s.key === "listen" && step !== "listen") ||
      (s.key === "read" && !["listen", "read"].includes(step)) ||
      (s.key === "blur" && blurDone) ||
      (s.key === "covered" && eyesUnlocked) ||
      (s.key === "eyes" && progress.eyesClean >= settings.eyesClosedReps),
    locked: (s.key === "covered" && !coveredUnlocked) || (s.key === "eyes" && !eyesUnlocked) || progress.saved,
    onClick: () => set((p) => ({ ...p, step: s.key })),
  }));

  const glow = (page: number): number | null => {
    if (step === "blur" && blurGlow) {
      const [pg, ln] = blurGlow.split(":").map(Number);
      return pg === page ? ln : null;
    }
    if (step === "covered") {
      const k = activeLineKey(words, portion);
      if (!k) return null;
      const [pg, ln] = k.split(":").map(Number);
      return pg === page ? ln : null;
    }
    return null;
  };

  if (step === "settled") return <Settled progress={progress} lines={lines} seconds={totalSeconds} />;

  return (
    <SessionShell
      title="Sabaq"
      subtitle={`${describeLines(lines)} · ${lines.length} lines`}
      seconds={totalSeconds}
      paused={timer.paused}
      onTogglePause={timer.toggle}
      steps={steps}
      step={step}
    >
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className={`flex flex-row-reverse justify-center gap-6 ${pages && pages.length > 1 ? "" : ""}`}>
          {!pages ? (
            <div className="aspect-[3/5] h-[calc(100vh-8.5rem)] animate-pulse rounded-3xl bg-surface-raised" />
          ) : (
            pages.map((pg) => (
              <div key={pg.page} className="min-w-0">
                <MushafPage
                  data={pg}
                  focus={byPage.get(pg.page) ?? []}
                  glowLine={glow(pg.page)}
                  blur={step === "blur" ? new Map((byPage.get(pg.page) ?? []).map((ln) => [ln, BLUR_PX[blurLevel(`${pg.page}:${ln}`)]])) : undefined}
                  portion={step === "covered" ? { words, state: portion, onTap: (i) => dispatch({ type: "tap", index: i }) } : undefined}
                  glossOnTap={step === "read" || step === "listen"}
                  dimmed={step === "eyes"}
                  onAnyTap={failEyes}
                />
                <p className="mt-2 text-center text-xs text-parchment-muted">Page {pg.page}</p>
              </div>
            ))
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          {step === "eyes" && (
            <div className="pop-in flex items-center gap-3 rounded-[22px] border border-teal/40 bg-teal/10 px-5 py-4 glow-soft">
              <EyeOff size={22} className="text-teal" />
              <div>
                <p className="font-serif text-xl">Eyes closed</p>
                <p className="text-xs text-parchment-muted">Recite the whole sabaq, and say each ayah&apos;s meaning after it.</p>
              </div>
            </div>
          )}

          <Panel>
            {step === "listen" && (
              <>
                <PanelTitle icon={<Headphones size={16} />} title="Listen first" text="Let the reciter carry it to you. Loop it until the sound feels familiar; follow along on the page." />
                <PrimaryButton onClick={() => set((p) => ({ ...p, step: "read" }))}>I&apos;ve listened · read it</PrimaryButton>
              </>
            )}
            {step === "read" && (
              <>
                <PanelTitle title="Read it, then read it alone" text="Recite along with the page, then by yourself. Tap any word to see it up close with its meaning; this is where the meaning goes in." />
                <div className="mt-4 flex items-center gap-4">
                  <RepRing done={progress.reads} target={Math.max(5, progress.reads)} label="reads" size={60} />
                  <button onClick={() => set((p) => ({ ...p, reads: p.reads + 1 }))} className="h-10 flex-1 rounded-full border border-border text-sm hover:border-teal/50">
                    + I read it through
                  </button>
                </div>
                <PrimaryButton onClick={() => set((p) => ({ ...p, step: "blur" }))}>Start blurring</PrimaryButton>
              </>
            )}
            {step === "blur" && (
              <>
                <PanelTitle
                  title="Let it frost over"
                  text="Recite the glowing line, then press Space. Each clean read frosts it a little more, until you're reciting from memory through the glass."
                />
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button onClick={() => blurStep(-1)} className="h-11 rounded-full border border-border text-sm hover:border-teal/50">Not yet <Kbd>⌫</Kbd></button>
                  <button onClick={() => blurStep(1)} className="h-11 rounded-full bg-teal text-sm font-semibold text-bg">Recited it <Kbd dark>Space</Kbd></button>
                </div>
                <label className="mt-4 block text-xs text-parchment-muted">
                  Extra blur
                  <input type="range" min={-3} max={3} value={blurBoost} onChange={(e) => setBlurBoost(Number(e.target.value))} className="mt-1 w-full accent-[rgb(var(--teal))]" />
                </label>
                <p className="mt-2 text-xs text-parchment-muted">
                  {lineKeys.filter((k) => (progress.blur[k] ?? 0) >= MAX_BLUR).length} of {lineKeys.length} lines fully frosted
                </p>
                {blurDone && <PrimaryButton onClick={() => set((p) => ({ ...p, step: "covered" }))}>Recite it covered</PrimaryButton>}
              </>
            )}
            {step === "covered" && (
              <>
                <div className="flex items-center gap-4">
                  <RepRing done={Math.min(progress.coveredClean, settings.coveredReps)} target={settings.coveredReps} size={76} />
                  <div className="flex-1">
                    <p className="font-serif text-xl">{progress.redoCovered ? "One clean repetition" : "Recite it covered"}</p>
                    <p className="text-xs text-parchment-muted">
                      Recite a line, then press Space to check it. Uncovering a word first is a peek, and the round won&apos;t count.
                    </p>
                  </div>
                </div>
                {lastResult && (
                  <p className={`mt-3 rounded-xl px-3 py-2 text-sm ${lastResult.clean ? "bg-heat-strong/10 text-heat-strong" : "bg-hint/10 text-parchment"}`}>
                    {lastResult.clean ? "Clean. Again, from the top." : `${lastResult.slips} slip${lastResult.slips === 1 ? "" : "s"}; those words are tomorrow's focus. Again.`}
                  </p>
                )}
                <div className="mt-4 grid grid-cols-[auto_1fr] gap-2">
                  <button onClick={() => dispatch({ type: "undo" })} aria-label="Undo" className="flex h-11 w-11 items-center justify-center rounded-full border border-border hover:border-teal/50">
                    <Undo2 size={16} />
                  </button>
                  <button onClick={() => dispatch({ type: "check" })} className="h-11 rounded-full bg-teal text-sm font-semibold text-bg">
                    Check line <Kbd dark>Space</Kbd>
                  </button>
                </div>
                {eyesUnlocked && !progress.redoCovered && (
                  <PrimaryButton onClick={() => set((p) => ({ ...p, step: "eyes" }))}>
                    <EyeOff size={16} /> Now with eyes closed
                  </PrimaryButton>
                )}
              </>
            )}
            {step === "eyes" && (
              <>
                <div className="flex items-center gap-4">
                  <RepRing done={progress.eyesClean} target={settings.eyesClosedReps} size={76} />
                  <p className="flex-1 text-sm text-parchment-muted">
                    Close your eyes and recite. Be honest: touching the page fails the round.
                  </p>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button onClick={() => eyesRound(false)} className="h-12 rounded-full border border-border text-sm hover:border-hint/60">I slipped <Kbd>S</Kbd></button>
                  <button onClick={() => eyesRound(true)} className="h-12 rounded-full bg-teal text-sm font-semibold text-bg">Clean <Kbd dark>C</Kbd></button>
                </div>
              </>
            )}
          </Panel>

          {(step === "listen" || step === "read") && (
            <AyahPlayer ayahs={ayahs} reciter={settings.reciter} onReciter={(r) => updateSettings((s) => ({ ...s, reciter: r }))} autoPlay={step === "listen"} />
          )}

          <div className="flex items-center justify-between px-2 text-xs text-parchment-muted">
            <button
              onClick={() => {
                if (confirm("End today's sabaq here? It hasn't settled yet, so it comes back tomorrow.")) settle(false);
              }}
              disabled={progress.saved}
              className="flex items-center gap-1.5 hover:text-parchment disabled:opacity-40"
            >
              <Flag size={13} /> {progress.saved ? "Saved for tomorrow" : "End for today"}
            </button>
            <span>{progress.attempts} covered attempt{progress.attempts === 1 ? "" : "s"}</span>
          </div>
          {step === "covered" && (() => {
            const k = activeLineKey(words, portion);
            return k ? <FlagCovers page={Number(k.split(":")[0])} line={Number(k.split(":")[1])} /> : null;
          })()}
          {progress.saved && (
            <Link href="/today" className="block rounded-full bg-surface-raised py-2.5 text-center text-sm">Back to Today</Link>
          )}
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
          {progress.firstCleanAt ? ` First clean on attempt ${progress.firstCleanAt}.` : ""}
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
