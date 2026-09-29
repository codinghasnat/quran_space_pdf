"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Check, ChevronLeft, Eye, Flame, Lightbulb, RotateCcw, Undo2 } from "lucide-react";
import { loadPage, verseRange } from "@/lib/data";
import { isoDay } from "@/lib/dates";
import { applySession, gradeSession, planDay, type Kind, type Mode, type Progress, type Session } from "@/lib/progress";
import { activeLine, flatten, initialState, isComplete, reduce, tally, type Action, type Flat, type SessionState } from "@/lib/session";
import { useProgress } from "@/lib/store";
import { surahName } from "@/lib/surahs";
import type { PageData } from "@/lib/types";
import SessionSummary from "./SessionSummary";

export const KIND_LABEL: Record<Kind, string> = { sabaq: "Sabaq", sabqi: "Sabqi", manzil: "Manzil", free: "Practice" };

export default function MushafPractice({ page, kind, mode: initialMode }: { page: number; kind: Kind; mode: Mode }) {
  const [data, setData] = useState<PageData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    loadPage(page).then(setData, (e: Error) => setError(e.message));
  }, [page]);

  if (error) {
    return (
      <Shell page={page} kind={kind}>
        <p className="mt-16 text-center text-parchment-muted">{error}.</p>
        <p className="mt-2 text-center text-sm text-parchment-muted/70">
          Run <code className="rounded bg-surface-raised px-1.5 py-0.5">tools/build_web_data.py {page}</code> to add it.
        </p>
      </Shell>
    );
  }
  if (!data) {
    return (
      <Shell page={page} kind={kind}>
        <div className="mx-auto mt-6 aspect-[3/4] w-full max-w-[640px] animate-pulse rounded-2xl bg-surface-raised" />
      </Shell>
    );
  }
  return <Practice key={`${page}-${initialMode}`} data={data} kind={kind} initialMode={initialMode} />;
}

function Shell({ page, kind, children, right }: { page: number; kind: Kind; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="min-h-screen pb-36">
      <header className="sticky top-0 z-20 border-b border-border bg-bg/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[680px] items-center gap-3 px-4">
          <Link href="/" className="-ml-2 flex items-center gap-1 rounded-full px-2 py-1 text-sm text-parchment-muted hover:text-teal">
            <ChevronLeft size={18} /> Today
          </Link>
          <div className="flex-1 text-center">
            <span className="font-serif text-base">Page {page}</span>
            <span className="ml-2 inline-flex h-6 items-center rounded-full bg-teal/10 px-2.5 text-[11px] font-medium text-teal">
              {KIND_LABEL[kind]}
            </span>
          </div>
          <div className="flex min-w-[72px] justify-end">{right}</div>
        </div>
      </header>
      <main className="mx-auto max-w-[680px] px-2 sm:px-4">{children}</main>
    </div>
  );
}

function Practice({ data, kind, initialMode }: { data: PageData; kind: Kind; initialMode: Mode }) {
  const router = useRouter();
  const [progress, update] = useProgress();
  const [mode, setMode] = useState<Mode>(initialMode);
  const flat = useMemo(() => flatten(data), [data]);
  const [state, dispatch] = useReducer(
    (s: SessionState, a: Action | { type: "reset"; mode: Mode }) => (a.type === "reset" ? initialState(flat, a.mode) : reduce(flat, s, a)),
    undefined,
    () => initialState(flat, initialMode),
  );
  const startedAt = useRef(Date.now());
  const [saved, setSaved] = useState<{ session: Session; before: Progress } | null>(null);
  const [showWeak, setShowWeak] = useState(false);

  const done = isComplete(state);
  const current = activeLine(flat, state);
  const touched = state.history.length > 0;

  function switchMode(m: Mode) {
    if (m === mode) return;
    if (touched && !confirm("Switch mode and start this page again?")) return;
    setMode(m);
    dispatch({ type: "reset", mode: m });
    startedAt.current = Date.now();
  }

  function finish() {
    const t = tally(flat, state);
    const day = isoDay();
    const session: Session = {
      at: new Date().toISOString(),
      day,
      page: data.page,
      kind,
      mode,
      seconds: Math.round((Date.now() - startedAt.current) / 1000),
      words: t.words,
      lines: t.lines,
      cleanLines: t.cleanLines,
      stuck: t.stuck,
      hints: t.hints,
      mistakes: t.mistakes,
      grade: gradeSession(t.words, t.stuck.length, t.hints.length, t.mistakes.length),
    };
    setSaved({ session, before: progress });
    update((p) => applySession(p, session));
  }

  function discard() {
    if (!saved) return;
    const before = saved.before;
    update(() => before);
    setSaved(null);
    dispatch({ type: "reset", mode });
    startedAt.current = Date.now();
  }

  function again() {
    setSaved(null);
    setShowWeak(false);
    dispatch({ type: "reset", mode });
    startedAt.current = Date.now();
  }

  // Keyboard: space/enter next line, ← peek next word (Arabic reads right to left), H hint, Z undo
  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {});
  keyHandler.current = (e: KeyboardEvent) => {
    if (saved || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === " " || k === "enter") {
      e.preventDefault();
      if (done) finish();
      else dispatch({ type: "nextLine" });
    } else if (k === "arrowleft" || k === "p") dispatch({ type: "peekNext" });
    else if (k === "h" && mode === "recite") dispatch({ type: "hint" });
    else if (k === "z" || k === "backspace") dispatch({ type: "undo" });
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => keyHandler.current(e);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const nextUp = useMemo(() => (saved ? nextInPlan(progress, data.page) : null), [saved, progress, data.page]);
  const t = tally(flat, state);
  const errors = t.stuck.length + t.mistakes.length;

  return (
    <Shell
      page={data.page}
      kind={kind}
      right={
        <button
          onClick={again}
          disabled={!touched || !!saved}
          aria-label="Start again"
          className="flex h-8 w-8 items-center justify-center rounded-full text-parchment-muted hover:text-teal disabled:opacity-30"
        >
          <RotateCcw size={16} />
        </button>
      }
    >
      <div className="flex items-center justify-between gap-3 px-2 pb-3 pt-4">
        <p className="text-sm text-parchment-muted">
          {surahName(data.firstVerse)} <span className="text-parchment-muted/60">· {verseRange(data.firstVerse, data.lastVerse)}</span>
        </p>
        <div className="flex rounded-full bg-parchment-muted/10 p-0.5 text-[12px] font-medium">
          {(["recite", "meaning"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className={`h-7 rounded-full px-3 transition-colors ${mode === m ? "bg-teal text-bg" : "text-parchment-muted hover:text-parchment"}`}
            >
              {m === "recite" ? "Recite" : "Meaning"}
            </button>
          ))}
        </div>
      </div>

      <MushafImage
        data={data}
        flat={flat}
        state={state}
        current={saved ? null : current}
        weak={showWeak ? progress.words : null}
        onArabic={(i) => !saved && dispatch({ type: "tapArabic", index: i })}
        onEnglish={(i) => !saved && dispatch({ type: "tapEnglish", index: i })}
      />

      {!saved && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
          <div className="mx-auto flex max-w-[680px] items-center gap-2 px-4 py-3">
            <IconButton label="Undo (Z)" onClick={() => dispatch({ type: "undo" })} disabled={!touched}>
              <Undo2 size={18} />
            </IconButton>
            {mode === "recite" && (
              <>
                <IconButton label="Meaning hint (H)" onClick={() => dispatch({ type: "hint" })} disabled={done}>
                  <Lightbulb size={18} />
                </IconButton>
                <IconButton label="Peek next word (←)" onClick={() => dispatch({ type: "peekNext" })} disabled={done}>
                  <Eye size={18} />
                </IconButton>
              </>
            )}
            <div className="flex-1 px-1 text-center text-[11px] leading-tight text-parchment-muted/80">
              {errors > 0 || t.hints.length > 0 ? (
                <>
                  <span className="text-stuck">{errors} slip{errors === 1 ? "" : "s"}</span>
                  {t.hints.length > 0 && <span className="text-hint"> · {t.hints.length} hint{t.hints.length === 1 ? "" : "s"}</span>}
                </>
              ) : mode === "recite" ? (
                "Tap a word when you're stuck"
              ) : (
                "Tap a meaning you don't know"
              )}
            </div>
            <button
              onClick={() => (done ? finish() : dispatch({ type: "nextLine" }))}
              className="flex h-11 items-center gap-2 rounded-full bg-teal px-5 text-sm font-semibold text-bg shadow-sm transition-transform active:scale-95"
            >
              {done ? <Flame size={16} /> : <Check size={16} />}
              {done ? "Finish" : "Next line"}
            </button>
          </div>
        </div>
      )}

      {saved && (
        <SessionSummary
          session={saved.session}
          flat={flat}
          pageProgress={progress.pages[data.page]}
          showWeak={showWeak}
          onToggleWeak={() => setShowWeak((v) => !v)}
          onAgain={again}
          onDiscard={discard}
          nextUp={nextUp}
          onNext={(href) => router.push(href)}
        />
      )}
    </Shell>
  );
}

function IconButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-parchment-muted transition-colors hover:text-teal disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function MushafImage({
  data, flat, state, current, weak, onArabic, onEnglish,
}: {
  data: PageData;
  flat: Flat;
  state: SessionState;
  current: number | null;
  weak: Progress["words"] | null;
  onArabic: (i: number) => void;
  onEnglish: (i: number) => void;
}) {
  const pct = (v: number) => `${v * 100}%`;
  return (
    <div
      className="relative mx-auto w-full select-none overflow-hidden rounded-2xl border border-border bg-surface shadow-sm"
      style={{ aspectRatio: `${data.width} / ${data.height}` }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- static scans, sized by the wrapper */}
      <img src={`/pages/${data.page}.webp`} alt={`Mushaf page ${data.page}`} className="absolute inset-0 h-full w-full" draggable={false} />

      {current !== null && (
        <div
          className="pointer-events-none absolute right-0 w-1 rounded-l bg-teal transition-all duration-200"
          style={{ top: pct(data.lines[current].y0), height: pct(data.lines[current].y1 - data.lines[current].y0) }}
        />
      )}

      {flat.map(({ token, line }, i) => {
        if (token.type === "end") return null;
        const ln = data.lines[line];
        const w = state.words[i];
        const left = pct(token.x0);
        const width = pct(token.x1 - token.x0);
        const heat = weak?.[token.key] ? weak[token.key].stuck + weak[token.key].mistake + weak[token.key].meaning : 0;
        return (
          <div key={token.key}>
            <button
              aria-label={w.ar === "covered" ? "Reveal word" : "Mark as said wrong"}
              onClick={() => onArabic(i)}
              className="absolute"
              style={{ left, width, top: pct(ln.y0), height: pct(ln.ySplit - ln.y0) }}
            >
              <span className={`cover block h-full w-full rounded-[3px] ${w.ar === "covered" ? "" : "cover-gone"}`} />
              {w.ar === "stuck" && <span className="absolute inset-x-1 bottom-0 h-[3px] rounded-full bg-stuck/80" />}
              {w.mistake && <span className="absolute inset-[2px] rounded-md ring-2 ring-stuck/70" />}
              {heat > 0 && (
                <span
                  className="absolute inset-[2px] rounded-md bg-stuck"
                  style={{ opacity: Math.min(0.12 + heat * 0.1, 0.45) }}
                />
              )}
            </button>
            <button
              aria-label="Reveal meaning"
              onClick={() => onEnglish(i)}
              className="absolute"
              style={{ left, width, top: pct(ln.ySplit), height: pct(ln.y1 - ln.ySplit) }}
            >
              <span className={`cover cover-en block h-full w-full rounded-[3px] ${w.en === "covered" ? "" : "cover-gone"}`} />
              {w.en === "hinted" && <span className="absolute inset-x-1 bottom-0 h-[3px] rounded-full bg-hint/80" />}
              {w.en === "missed" && <span className="absolute inset-x-1 bottom-0 h-[3px] rounded-full bg-stuck/80" />}
            </button>
          </div>
        );
      })}
    </div>
  );
}

/** First unfinished item in today's plan after this page, so you can flow from one to the next. */
function nextInPlan(progress: Progress, page: number): { href: string; label: string } | null {
  const plan = planDay(progress, isoDay());
  const items: [Kind, number][] = [];
  if (plan.sabaq.type === "new" || plan.sabaq.type === "repeat") items.push(["sabaq", plan.sabaq.page]);
  plan.sabqi.forEach((p) => items.push(["sabqi", p]));
  plan.manzil.forEach((p) => items.push(["manzil", p]));
  const next = items.find(([k, p]) => p !== page && !plan.doneToday.has(`${k}:${p}`));
  if (next) return { href: `/practice/${next[1]}?kind=${next[0]}`, label: `${KIND_LABEL[next[0]]} · page ${next[1]}` };
  if (plan.meaningCheck !== null && !plan.doneToday.has(`free:${plan.meaningCheck}`)) {
    return { href: `/practice/${plan.meaningCheck}?kind=free&mode=meaning`, label: `Meaning check · page ${plan.meaningCheck}` };
  }
  return null;
}
