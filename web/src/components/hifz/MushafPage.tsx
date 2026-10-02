"use client";

import { useState } from "react";
import type { PortionState, PortionWord } from "@/lib/hifz/portion";
import type { PageData, Token } from "@/lib/types";

const pct = (v: number) => `${(v * 100).toFixed(3)}%`;

export type MushafPageProps = {
  data: PageData;
  /** Lines (mushaf numbers) in play; the rest of the page fades back. Null = whole page. */
  focus?: number[] | null;
  glowLine?: number | null;
  /** Frosted glass per line, in px of blur. */
  blur?: Map<number, number>;
  /** Covered recitation: the portion's words and their state. */
  portion?: { words: PortionWord[]; state: PortionState; onTap: (index: number) => void };
  /** Read mode: tap a word to see it larger with its meaning. */
  glossOnTap?: boolean;
  /** Eyes closed: the page stays (covered) but takes on a quiet, inward look. */
  eyesClosed?: boolean;
  /** Size the page to the screen height (laptop), like an open mushaf. */
  fit?: boolean;
  className?: string;
};

export default function MushafPage({
  data, focus = null, glowLine = null, blur, portion, glossOnTap, eyesClosed, fit = true, className = "",
}: MushafPageProps) {
  const [gloss, setGloss] = useState<{ token: Token; x: number; y: number } | null>(null);
  const indexOf = new Map<string, number>();
  portion?.words.forEach((w, i) => {
    if (w.page === data.page) indexOf.set(w.token.key, i);
  });

  return (
    <div
      className={`relative mx-auto max-w-full select-none overflow-hidden rounded-[22px] border bg-surface transition-shadow duration-700 ${
        eyesClosed ? "border-teal/50 shadow-[0_0_0_4px_rgb(var(--teal)/0.12),0_0_60px_-6px_rgb(var(--teal)/0.45)]" : "border-border shadow-[0_8px_40px_-12px_rgb(var(--teal)/0.25)]"
      } ${className}`}
      style={{
        aspectRatio: `${data.width} / ${data.height}`,
        ...(fit ? { height: "min(calc(100vh - 8.5rem), 1400px)", width: "auto" } : { width: "100%" }),
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- static scans, sized by the wrapper */}
      <img
        src={`/pages/${data.page}.webp`}
        alt={`Mushaf page ${data.page}`}
        className="absolute inset-0 h-full w-full"
        draggable={false}
      />

      {data.lines.map((ln) => {
        const inFocus = !focus || focus.includes(ln.line);
        const b = blur?.get(ln.line) ?? 0;
        return (
          <div key={ln.line}>
            {!inFocus && (
              <div
                className="absolute inset-x-0 bg-surface/75 transition-opacity duration-500"
                style={{ top: pct(ln.y0), height: pct(ln.y1 - ln.y0 + 0.002) }}
              />
            )}
            {inFocus && glowLine === ln.line && (
              <div
                className="line-glow pointer-events-none absolute inset-x-0 rounded-lg transition-all duration-300"
                style={{ top: pct(ln.y0), height: pct(ln.y1 - ln.y0) }}
              />
            )}
            {inFocus && blur && (
              <div
                className="glass-line pointer-events-none absolute inset-x-1 rounded-xl"
                style={{
                  top: pct(ln.y0),
                  height: pct(ln.y1 - ln.y0),
                  ["--blur" as string]: `${b}px`,
                  ["--sheen" as string]: Math.min(1, b / 8),
                }}
              />
            )}
          </div>
        );
      })}

      {portion &&
        data.lines.map((ln) =>
          ln.words.map((token) => {
            const i = indexOf.get(token.key);
            if (i === undefined) return null;
            const mark = portion.state.marks[i];
            const wrong = portion.state.wrong[i];
            return (
              <button
                key={token.key}
                onClick={() => portion.onTap(i)}
                aria-label={mark === "covered" ? "Uncover word" : "Mark as said wrong"}
                className="group absolute"
                style={{ left: pct(token.x0 - 0.004), width: pct(token.x1 - token.x0 + 0.008), top: pct(ln.y0), height: pct(ln.y1 - ln.y0) }}
              >
                <span
                  className={`cover-word block h-full w-full rounded-[6px] transition-all duration-300 ${
                    mark === "covered" ? "opacity-100 group-hover:brightness-[0.97]" : "scale-95 opacity-0"
                  }`}
                />
                {mark === "peeked" && <span className="absolute inset-x-1 bottom-0.5 h-[3px] rounded-full bg-hint/90" />}
                {wrong && <span className="absolute inset-[2px] rounded-lg ring-2 ring-stuck/80" />}
              </button>
            );
          }),
        )}

      {glossOnTap &&
        data.lines.map((ln) =>
          ln.words.map((token) =>
            token.type !== "word" || (focus && !focus.includes(ln.line)) ? null : (
              <button
                key={`g-${token.key}`}
                className="absolute rounded-md transition-colors hover:bg-teal/10"
                style={{ left: pct(token.x0), width: pct(token.x1 - token.x0), top: pct(ln.y0), height: pct(ln.y1 - ln.y0) }}
                onClick={() => setGloss({ token, x: (token.x0 + token.x1) / 2, y: ln.y0 })}
                aria-label={`Meaning of ${token.en}`}
              />
            ),
          ),
        )}

      {gloss && (
        <div
          className="pop-in absolute z-10 -translate-x-1/2 -translate-y-full rounded-2xl border border-teal/30 bg-surface/95 px-4 py-2.5 text-center shadow-xl backdrop-blur"
          style={{ left: pct(Math.min(0.85, Math.max(0.15, gloss.x))), top: pct(Math.max(0.08, gloss.y)) }}
          onClick={() => setGloss(null)}
        >
          <p className="font-quran text-3xl leading-tight text-parchment" dir="rtl">{gloss.token.ar}</p>
          <p className="mt-1 text-sm text-teal">{gloss.token.en}</p>
        </div>
      )}

      {eyesClosed && (
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgb(var(--teal)/0.10))]" />
      )}
    </div>
  );
}
