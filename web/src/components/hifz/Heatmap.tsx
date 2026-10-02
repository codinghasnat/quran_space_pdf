"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { daysBetween, formatDay } from "@/lib/dates";
import { JUZ_STARTS, juzPages, lineId, type QuranIndex } from "@/lib/hifz/quran";
import { memorisedLineDays, type Colour, type PageState } from "@/lib/hifz/strength";
import type { HifzData } from "@/lib/hifz/types";
import { SURAHS } from "@/lib/surahs";

export const COLOUR_LABEL: Record<Colour, string> = {
  blank: "Not memorised",
  strong: "Strong",
  okay: "Okay, keep revising",
  weak: "Practise this again",
};

const HEAT_CLASS: Record<Colour, string> = {
  blank: "heat-blank",
  strong: "heat-strong",
  okay: "heat-okay",
  weak: "heat-weak",
};

export function HeatLegend({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-parchment-muted ${className}`}>
      {(["strong", "okay", "weak", "blank"] as Colour[]).map((c) => (
        <span key={c} className="flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-[3px] ${HEAT_CLASS[c]}`} /> {COLOUR_LABEL[c]}
        </span>
      ))}
    </div>
  );
}

/** One cell: a page (or ayah) coloured by strength; part-memorised pages fill from the bottom. */
function Cell({ state, size = "sm", label }: { state: PageState | undefined; size?: "xs" | "sm" | "lg"; label?: string }) {
  const colour = state?.colour ?? "blank";
  const fill = state && state.memorisedLines < state.totalLines ? state.memorisedLines / state.totalLines : 1;
  const dims = size === "xs" ? "h-2 w-full rounded-[2px]" : size === "sm" ? "h-6 w-full rounded-[6px]" : "h-14 w-full rounded-xl";
  return (
    <span className={`relative block overflow-hidden heat-blank ${dims}`}>
      {colour !== "blank" && (
        <span
          className={`absolute inset-x-0 bottom-0 ${HEAT_CLASS[colour]} ${colour === "strong" ? "shadow-[0_0_8px_rgb(var(--heat-strong)/0.6)]" : ""}`}
          style={{ height: `${fill * 100}%` }}
        />
      )}
      {label && <span className="absolute inset-0 flex items-center justify-center text-xs tabular-nums text-parchment/70">{label}</span>}
    </span>
  );
}

export function MiniHeatmap({ states }: { states: Map<number, PageState> }) {
  return (
    <div className="space-y-[3px]">
      {JUZ_STARTS.map((_, j) => (
        <div key={j} className="flex items-center gap-1.5">
          <span className="w-4 text-right text-[9px] tabular-nums text-parchment-muted/60">{j + 1}</span>
          <div className="grid flex-1 grid-cols-[repeat(23,minmax(0,1fr))] gap-[2px]">
            {juzPages(j + 1).map((p) => (
              <Cell key={p} state={states.get(p)} size="xs" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function pageTip(s: PageState | undefined, today: string): string {
  if (!s || s.memorisedLines === 0) return "Not memorised yet";
  const parts = [COLOUR_LABEL[s.colour]];
  if (s.memorisedLines < s.totalLines) parts.push(`${s.memorisedLines}/${s.totalLines} lines`);
  if (s.status === "rebuilding") parts.push("rebuilding");
  if (s.last) {
    const d = daysBetween(s.last, today);
    parts.push(d === 0 ? "recited today" : d === 1 ? "recited yesterday" : `last recited ${formatDay(s.last)}`);
  }
  parts.push(`${Math.round(s.R * 100)}% recall today`);
  return parts.join(" · ");
}

type View = "mushaf" | "juz" | "surah";

export function HeatmapExplorer({
  data, index, states, today,
}: {
  data: HifzData;
  index: QuranIndex;
  states: Map<number, PageState>;
  today: string;
}) {
  const [view, setView] = useState<View>("mushaf");
  const [juz, setJuz] = useState(30);
  const [surah, setSurah] = useState(114);
  const [hover, setHover] = useState<string | null>(null);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-full bg-surface-raised p-1 text-sm">
          {(["mushaf", "juz", "surah"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`h-8 rounded-full px-4 capitalize transition-colors ${view === v ? "bg-teal text-bg shadow-sm" : "text-parchment-muted hover:text-parchment"}`}
            >
              {v === "mushaf" ? "Whole mushaf" : v}
            </button>
          ))}
        </div>
        {view === "juz" && (
          <select value={juz} onChange={(e) => setJuz(Number(e.target.value))} className="h-9 rounded-full border border-border bg-surface px-3 text-sm">
            {JUZ_STARTS.map((_, j) => (
              <option key={j} value={j + 1}>Juz {j + 1}</option>
            ))}
          </select>
        )}
        {view === "surah" && (
          <select value={surah} onChange={(e) => setSurah(Number(e.target.value))} className="h-9 rounded-full border border-border bg-surface px-3 text-sm">
            {SURAHS.map((s) => (
              <option key={s.id} value={s.id}>{s.id}. {s.name}</option>
            ))}
          </select>
        )}
        <div className="flex-1" />
        <HeatLegend />
      </div>

      <p className="mt-4 h-5 text-sm text-parchment-muted">{hover ?? "Hover a page to see how it's holding; click to practise it."}</p>

      <div className="mt-3 rounded-[24px] border border-border bg-surface p-5">
        {view === "mushaf" && (
          <div className="space-y-1.5">
            {JUZ_STARTS.map((_, j) => (
              <div key={j} className="flex items-center gap-3">
                <button onClick={() => (setJuz(j + 1), setView("juz"))} className="w-12 text-right text-xs text-parchment-muted hover:text-teal">
                  Juz {j + 1}
                </button>
                <div className="grid flex-1 grid-cols-[repeat(23,minmax(0,1fr))] gap-1">
                  {juzPages(j + 1).map((p) => (
                    <Link
                      key={p}
                      href={`/practice/${p}`}
                      onMouseEnter={() => setHover(`Page ${p} · ${pageTip(states.get(p), today)}`)}
                      onMouseLeave={() => setHover(null)}
                      className="transition-transform hover:z-10 hover:scale-125"
                    >
                      <Cell state={states.get(p)} />
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {view === "juz" && <JuzView juz={juz} index={index} states={states} today={today} onHover={setHover} />}
        {view === "surah" && <SurahView surah={surah} data={data} index={index} states={states} onHover={setHover} />}
      </div>
    </div>
  );
}

function JuzView({
  juz, index, states, today, onHover,
}: {
  juz: number;
  index: QuranIndex;
  states: Map<number, PageState>;
  today: string;
  onHover: (s: string | null) => void;
}) {
  const pages = juzPages(juz);
  return (
    <div className="grid grid-cols-5 gap-3 sm:grid-cols-7 lg:grid-cols-10">
      {pages.map((p) => {
        const lines = index.byPage.get(p) ?? [];
        const starts = [...new Set(lines.filter((l) => l.a1 === 1).map((l) => l.surah))];
        return (
          <Link
            key={p}
            href={`/practice/${p}`}
            onMouseEnter={() => onHover(`Page ${p} · ${pageTip(states.get(p), today)}`)}
            onMouseLeave={() => onHover(null)}
            className="group"
          >
            <span className="block transition-transform group-hover:-translate-y-0.5">
              <Cell state={states.get(p)} size="lg" label={String(p)} />
            </span>
            <span className="mt-1 block truncate text-center text-[10px] text-parchment-muted">
              {starts.length ? SURAHS[starts[0] - 1]?.name : " "}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

function SurahView({
  surah, data, index, states, onHover,
}: {
  surah: number;
  data: HifzData;
  index: QuranIndex;
  states: Map<number, PageState>;
  onHover: (s: string | null) => void;
}) {
  const memorised = useMemo(() => memorisedLineDays(data, index), [data, index]);
  const slips = useMemo(() => {
    const m = new Map<string, number>();
    for (const w of data.wordEvents) {
      const [s, a] = w.key.split(":");
      if (Number(s) === surah) m.set(`${s}:${a}`, (m.get(`${s}:${a}`) ?? 0) + 1);
    }
    return m;
  }, [data.wordEvents, surah]);

  // Each ayah takes the weakest colour of the memorised lines it sits on
  const ayahs = useMemo(() => {
    const out = new Map<number, { colour: Colour; page: number }>();
    const rank: Record<Colour, number> = { blank: 0, weak: 1, okay: 2, strong: 3 };
    for (const l of index.bySurah.get(surah) ?? []) {
      const c: Colour = memorised.has(lineId(l)) ? states.get(l.page)?.colour ?? "blank" : "blank";
      for (let a = l.a1; a <= l.a2; a++) {
        const prev = out.get(a);
        if (!prev || (c !== "blank" && (prev.colour === "blank" || rank[c] < rank[prev.colour])) ) out.set(a, { colour: c, page: l.page });
      }
    }
    return [...out.entries()].sort((a, b) => a[0] - b[0]);
  }, [index, surah, memorised, states]);

  const info = SURAHS[surah - 1];
  return (
    <div>
      <div className="mb-4 flex items-baseline gap-3">
        <h3 className="font-serif text-2xl">{info?.name}</h3>
        <span className="font-quran text-2xl text-parchment-muted">{info?.arabic}</span>
        <span className="text-sm text-parchment-muted">{ayahs.length} ayahs</span>
      </div>
      <div className="flex flex-wrap gap-1.5" dir="rtl">
        {ayahs.map(([a, { colour, page }]) => (
          <Link
            key={a}
            href={`/practice/${page}`}
            onMouseEnter={() =>
              onHover(`Ayah ${surah}:${a} · page ${page} · ${COLOUR_LABEL[colour]}${slips.get(`${surah}:${a}`) ? ` · ${slips.get(`${surah}:${a}`)} slip${slips.get(`${surah}:${a}`) === 1 ? "" : "s"} so far` : ""}`)
            }
            onMouseLeave={() => onHover(null)}
            className={`relative flex h-9 w-9 items-center justify-center rounded-lg text-[11px] tabular-nums transition-transform hover:scale-110 ${HEAT_CLASS[colour]} ${
              colour === "strong" ? "text-bg" : "text-parchment/70"
            }`}
          >
            {a}
            {slips.get(`${surah}:${a}`) ? <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-stuck" /> : null}
          </Link>
        ))}
      </div>
    </div>
  );
}
