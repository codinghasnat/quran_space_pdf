"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Pencil } from "lucide-react";
import { daysBetween, formatDay, isoDay } from "@/lib/dates";
import { JUZ_STARTS, juzPages, lineId, type QuranIndex } from "@/lib/hifz/quran";
import { updateProfile } from "@/lib/hifz/store";
import { claimedAyahs, memorisedLineDays, type Colour, type PageState } from "@/lib/hifz/strength";
import type { AyahMark, Claim, HifzData } from "@/lib/hifz/types";
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
                      href={`/mushaf?page=${p}`}
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
            href={`/mushaf?page=${p}`}
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

type Brush = Claim | "none";
const BRUSHES: { b: Brush; label: string; cls: string }[] = [
  { b: "solid", label: "Solid", cls: "heat-strong text-bg" },
  { b: "rusty", label: "Rusty", cls: "heat-weak text-parchment" },
  { b: "forgotten", label: "Faded", cls: "bg-heat-weak/40 text-parchment" },
  { b: "none", label: "Not memorised", cls: "heat-blank text-parchment/70" },
];
const brushClass = (b: Brush) => BRUSHES.find((x) => x.b === b)!.cls;

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
  const claimed = useMemo(() => claimedAyahs(data, index), [data, index]);
  const [editing, setEditing] = useState(false);
  const [brush, setBrush] = useState<Brush>("solid");
  const [draft, setDraft] = useState<Record<string, AyahMark> | null>(null);
  const slips = useMemo(() => {
    const m = new Map<string, number>();
    for (const w of data.wordEvents) {
      const [s, a] = w.key.split(":");
      if (Number(s) === surah) m.set(`${s}:${a}`, (m.get(`${s}:${a}`) ?? 0) + 1);
    }
    return m;
  }, [data.wordEvents, surah]);

  // Each ayah: its page, whether it's known (you said so, or it sits on a memorised line), and that page's colour
  const ayahs = useMemo(() => {
    const out = new Map<number, { colour: Colour; page: number; level: Brush }>();
    const rank: Record<Colour, number> = { blank: 0, weak: 1, okay: 2, strong: 3 };
    for (const l of index.bySurah.get(surah) ?? []) {
      for (let a = l.a1; a <= l.a2; a++) {
        const k = `${surah}:${a}`;
        const claim = claimed.get(k)?.claim;
        const known = !!claim || memorised.has(lineId(l));
        const c: Colour = known ? states.get(l.page)?.colour ?? "weak" : "blank";
        const level: Brush = claim ?? (known ? "solid" : "none");
        const prev = out.get(a);
        if (!prev || (c !== "blank" && (prev.colour === "blank" || rank[c] < rank[prev.colour]))) out.set(a, { colour: c, page: l.page, level });
      }
    }
    return [...out.entries()].sort((a, b) => a[0] - b[0]);
  }, [index, surah, memorised, claimed, states]);

  // Painting: press on an ayah and drag across others; saved when you let go
  const paint = (a: number) => setDraft((d) => ({ ...(d ?? {}), [`${surah}:${a}`]: { c: brush, day: isoDay() } }));
  const commit = (marks: Record<string, AyahMark> | null) => {
    if (marks && Object.keys(marks).length) updateProfile((p) => ({ ...p, ayahMarks: { ...(p.ayahMarks ?? {}), ...marks } }));
    setDraft(null);
  };
  useEffect(() => {
    if (!draft) return;
    const up = () => commit(draft);
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, [draft]); // eslint-disable-line react-hooks/exhaustive-deps
  const markAll = () => commit(Object.fromEntries(ayahs.map(([a]) => [`${surah}:${a}`, { c: brush, day: isoDay() }])));

  const info = SURAHS[surah - 1];
  const known = ayahs.filter(([a, x]) => (draft?.[`${surah}:${a}`]?.c ?? x.level) !== "none").length;
  return (
    <div className="select-none">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h3 className="font-serif text-2xl">{info?.name}</h3>
        <span className="font-quran text-2xl text-parchment-muted">{info?.arabic}</span>
        <span className="text-sm text-parchment-muted">{known} of {ayahs.length} ayahs known</span>
        <div className="flex-1" />
        <button
          onClick={() => setEditing((e) => !e)}
          className={`flex h-9 items-center gap-2 rounded-full px-4 text-sm transition-colors ${editing ? "bg-teal text-bg glow-soft" : "border border-border hover:border-teal/50"}`}
        >
          <Pencil size={14} /> {editing ? "Done" : "Edit what I know"}
        </button>
      </div>

      {editing && (
        <div className="pop-in mb-5 flex flex-wrap items-center gap-2 rounded-2xl border border-teal/30 bg-teal/[0.05] p-3">
          <span className="px-1 text-xs text-parchment-muted">Paint with</span>
          {BRUSHES.map((x) => (
            <button
              key={x.b}
              onClick={() => setBrush(x.b)}
              className={`flex h-8 items-center gap-2 rounded-full px-3 text-xs transition-all ${brush === x.b ? "ring-2 ring-teal ring-offset-2 ring-offset-bg" : ""} border border-border bg-surface`}
            >
              <span className={`h-3 w-3 rounded-[4px] ${x.cls}`} /> {x.label}
            </button>
          ))}
          <div className="flex-1" />
          <button onClick={markAll} className="h-8 rounded-full bg-surface px-3 text-xs hover:text-teal">
            Whole surah: {BRUSHES.find((x) => x.b === brush)!.label.toLowerCase()}
          </button>
          <p className="w-full px-1 text-xs text-parchment-muted">
            Click an ayah, or press and drag across several. The mushaf covers exactly what you mark as known.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5" dir="rtl">
        {ayahs.map(([a, { colour, page, level }]) => {
          const k = `${surah}:${a}`;
          const tip = `Ayah ${k} · page ${page} · ${COLOUR_LABEL[colour]}${slips.get(k) ? ` · ${slips.get(k)} slip${slips.get(k) === 1 ? "" : "s"} so far` : ""}`;
          if (editing) {
            const shown = draft?.[k]?.c ?? level;
            return (
              <button
                key={a}
                onMouseDown={(e) => (e.preventDefault(), paint(a))}
                onMouseEnter={() => (draft ? paint(a) : onHover(tip))}
                onMouseLeave={() => onHover(null)}
                className={`relative flex h-9 w-9 items-center justify-center rounded-lg text-[11px] tabular-nums transition-all hover:scale-110 ${brushClass(shown)} ${
                  draft?.[k] ? "ring-2 ring-teal/60" : ""
                }`}
              >
                {a}
              </button>
            );
          }
          return (
            <Link
              key={a}
              href={`/mushaf?page=${page}`}
              onMouseEnter={() => onHover(tip)}
              onMouseLeave={() => onHover(null)}
              className={`relative flex h-9 w-9 items-center justify-center rounded-lg text-[11px] tabular-nums transition-transform hover:scale-110 ${HEAT_CLASS[colour]} ${
                colour === "strong" ? "text-bg" : "text-parchment/70"
              }`}
            >
              {a}
              {slips.get(k) ? <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-stuck" /> : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
