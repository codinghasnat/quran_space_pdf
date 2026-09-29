"use client";

import Link from "next/link";
import { ArrowRight, Flame, RotateCcw, Star } from "lucide-react";
import { daysBetween, formatDay, isoDay } from "@/lib/dates";
import type { PageProgress, Session } from "@/lib/progress";
import type { Flat } from "@/lib/session";

const GRADE_TEXT = ["", "Needs relearning", "Shaky", "Getting there", "Strong", "Flawless"];

export default function SessionSummary({
  session, flat, pageProgress, showWeak, onToggleWeak, onAgain, onDiscard, nextUp, onNext,
}: {
  session: Session;
  flat: Flat;
  pageProgress: PageProgress | undefined;
  showWeak: boolean;
  onToggleWeak: () => void;
  onAgain: () => void;
  onDiscard: () => void;
  nextUp: { href: string; label: string } | null;
  onNext: (href: string) => void;
}) {
  const byKey = new Map(flat.map((f) => [f.token.key, f.token]));
  const slips = [...new Set([...session.stuck, ...session.mistakes])].map((k) => byKey.get(k)).filter(Boolean);
  const hinted = session.hints.filter((k) => !session.stuck.includes(k)).map((k) => byKey.get(k)).filter(Boolean);
  const meaning = session.mode === "meaning";
  const mins = Math.max(1, Math.round(session.seconds / 60));
  const dueIn = pageProgress && !meaning ? daysBetween(isoDay(), pageProgress.due) : null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 max-h-[78vh] overflow-y-auto rounded-t-3xl border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_40px_rgba(0,0,0,0.12)]">
      <div className="mx-auto max-w-[680px] px-5 pb-6 pt-5">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-teal">
              {meaning ? "Understanding check" : "Recitation"} · page {session.page}
            </p>
            <h2 className="mt-1 font-serif text-2xl">{GRADE_TEXT[session.grade]}</h2>
          </div>
          <div className="flex gap-0.5 pt-1" aria-label={`${session.grade} out of 5`}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Star key={i} size={18} className={i <= session.grade ? "fill-teal text-teal" : "text-border"} />
            ))}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Stat value={`${session.cleanLines}/${session.lines}`} label="clean lines" />
          <Stat value={String(meaning ? session.stuck.length : slips.length)} label={meaning ? "meanings missed" : "slips"} tone={slips.length ? "stuck" : undefined} />
          <Stat value={`${mins}m`} label="time" />
        </div>

        {dueIn !== null && (
          <p className="mt-4 flex items-center gap-2 text-sm text-parchment-muted">
            <Flame size={15} className="text-teal" />
            {pageProgress?.status === "memorised" ? "In your manzil" : "In your sabqi"} · next review{" "}
            {dueIn <= 0 ? "today" : dueIn === 1 ? "tomorrow" : `${formatDay(pageProgress!.due)} (${dueIn} days)`}
          </p>
        )}

        {slips.length > 0 && (
          <WordList title={meaning ? "Meanings to revisit" : "Where you got stuck"} tone="stuck" words={slips} showEnglish={meaning} />
        )}
        {hinted.length > 0 && <WordList title="Meanings you peeked at" tone="hint" words={hinted} showEnglish />}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {nextUp ? (
            <button
              onClick={() => onNext(nextUp.href)}
              className="flex h-11 items-center gap-2 rounded-full bg-teal px-5 text-sm font-semibold text-bg"
            >
              Next: {nextUp.label} <ArrowRight size={16} />
            </button>
          ) : (
            <Link href="/" className="flex h-11 items-center gap-2 rounded-full bg-teal px-5 text-sm font-semibold text-bg">
              All done for today <ArrowRight size={16} />
            </Link>
          )}
          <button onClick={onAgain} className="flex h-11 items-center gap-2 rounded-full border border-border px-4 text-sm text-parchment-muted hover:text-teal">
            <RotateCcw size={15} /> Again
          </button>
          <button
            onClick={onToggleWeak}
            className={`h-11 rounded-full border px-4 text-sm transition-colors ${showWeak ? "border-stuck/40 bg-stuck/10 text-stuck" : "border-border text-parchment-muted hover:text-teal"}`}
          >
            {showWeak ? "Hide" : "Show"} weak spots
          </button>
          <button onClick={onDiscard} className="ml-auto text-xs text-parchment-muted/70 underline-offset-2 hover:underline">
            Don&apos;t count this
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label, tone }: { value: string; label: string; tone?: "stuck" }) {
  return (
    <div className="rounded-2xl bg-surface-raised px-2 py-3">
      <div className={`font-serif text-xl ${tone === "stuck" ? "text-stuck" : ""}`}>{value}</div>
      <div className="mt-0.5 text-[11px] text-parchment-muted">{label}</div>
    </div>
  );
}

function WordList({ title, tone, words, showEnglish }: { title: string; tone: "stuck" | "hint"; words: (Flat[number]["token"] | undefined)[]; showEnglish: boolean }) {
  return (
    <div className="mt-5">
      <p className="text-[11px] font-medium uppercase tracking-wider text-parchment-muted">{title}</p>
      <div className="mt-2 flex flex-wrap gap-2" dir="rtl">
        {words.map((w) =>
          w ? (
            <span
              key={w.key}
              className={`inline-flex flex-col items-center rounded-xl border px-3 py-1.5 ${tone === "stuck" ? "border-stuck/30 bg-stuck/5" : "border-hint/30 bg-hint/5"}`}
            >
              <span className="font-quran text-xl leading-snug">{w.ar}</span>
              {showEnglish && <span dir="ltr" className="text-[11px] text-parchment-muted">{w.en}</span>}
            </span>
          ) : null,
        )}
      </div>
    </div>
  );
}
