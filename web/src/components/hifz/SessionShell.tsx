"use client";

import Link from "next/link";
import { ChevronLeft, Pause, Play } from "lucide-react";
import { formatClock } from "@/lib/hifz/hooks";

export default function SessionShell({
  title, subtitle, seconds, paused, onTogglePause, children, steps, step,
}: {
  title: string;
  subtitle?: string;
  seconds: number;
  paused: boolean;
  onTogglePause: () => void;
  children: React.ReactNode;
  steps?: { key: string; label: string; done: boolean; locked?: boolean; onClick?: () => void }[];
  step?: string;
}) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-bg/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-4 px-5">
          <Link href="/today" className="-ml-2 flex items-center gap-1 rounded-full px-2 py-1 text-sm text-parchment-muted hover:text-teal">
            <ChevronLeft size={18} /> Today
          </Link>
          <div className="min-w-0">
            <p className="font-serif text-lg leading-none">{title}</p>
            {subtitle && <p className="mt-0.5 truncate text-xs text-parchment-muted">{subtitle}</p>}
          </div>
          {steps && (
            <ol className="mx-auto hidden items-center gap-1 md:flex">
              {steps.map((s, i) => (
                <li key={s.key} className="flex items-center gap-1">
                  {i > 0 && <span className={`h-px w-5 ${s.done || s.key === step ? "bg-teal/60" : "bg-border"}`} />}
                  <button
                    disabled={s.locked}
                    onClick={s.onClick}
                    className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-xs transition-all ${
                      s.key === step
                        ? "bg-teal text-bg shadow-[0_0_18px_rgb(var(--teal)/0.45)]"
                        : s.done
                          ? "bg-teal/10 text-teal"
                          : s.locked
                            ? "text-parchment-muted/40"
                            : "text-parchment-muted hover:text-parchment"
                    }`}
                  >
                    {s.label}
                  </button>
                </li>
              ))}
            </ol>
          )}
          <div className="ml-auto flex items-center gap-2">
            <span className={`font-mono text-sm tabular-nums ${paused ? "text-parchment-muted/50" : "text-parchment-muted"}`}>
              {formatClock(seconds)}
            </span>
            <button
              onClick={onTogglePause}
              aria-label={paused ? "Resume" : "Pause"}
              className={`flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${
                paused ? "border-teal bg-teal text-bg" : "border-border bg-surface text-parchment-muted hover:text-teal"
              }`}
            >
              {paused ? <Play size={15} className="ml-0.5" /> : <Pause size={15} />}
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1280px] px-5 pb-24 pt-6">{children}</main>
    </div>
  );
}

let ctx: AudioContext | null = null;

/** A soft two-note chime for a clean recitation. */
export function chime(big = false) {
  try {
    ctx ??= new AudioContext();
    const notes = big ? [659.25, 783.99, 987.77] : [783.99, 1046.5];
    notes.forEach((f, i) => {
      const o = ctx!.createOscillator();
      const g = ctx!.createGain();
      o.type = "sine";
      o.frequency.value = f;
      const t = ctx!.currentTime + i * 0.12;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.08, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      o.connect(g).connect(ctx!.destination);
      o.start(t);
      o.stop(t + 1);
    });
  } catch {}
}

/** A progress ring for repetitions. */
export function RepRing({ done, target, size = 64, label }: { done: number; target: number; size?: number; label?: string }) {
  const r = size / 2 - 5;
  const c = 2 * Math.PI * r;
  const share = Math.min(1, done / Math.max(1, target));
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="5" className="stroke-heat-blank" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - share)}
          className="stroke-teal transition-[stroke-dashoffset] duration-700"
          style={{ filter: share > 0 ? "drop-shadow(0 0 4px rgb(var(--teal) / 0.6))" : undefined }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="font-serif text-lg tabular-nums">{done}</span>
        <span className="text-[10px] text-parchment-muted">{label ?? `of ${target}`}</span>
      </div>
    </div>
  );
}
