"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, EyeOff, Search, Undo2 } from "lucide-react";
import { useKeys, usePages } from "@/lib/hifz/hooks";
import {
  activeLineKey, initialPortion, portionDone, portionResult, portionWords, reducePortion, type PortionAction, type PortionState, type PortionWord,
} from "@/lib/hifz/portion";
import { juzOfPage, lineId, TOTAL_PAGES } from "@/lib/hifz/quran";
import { recordPortion } from "@/lib/hifz/record";
import { claimedAyahs, memorisedLineDays } from "@/lib/hifz/strength";
import { useJourney } from "@/lib/hifz/useJourney";
import { SURAHS } from "@/lib/surahs";
import AppShell from "./AppShell";
import FlagCovers from "./FlagCovers";
import { COLOUR_LABEL } from "./Heatmap";
import MushafPage from "./MushafPage";
import { Kbd } from "./SabaqSession";
import { chime } from "./SessionShell";

const LAST_PAGE = "hifz:reader-page";

/** Your mushaf, any page. What you've memorised is covered; tap a word open when you need it and it's remembered. */
export default function MushafReader() {
  const router = useRouter();
  const params = useSearchParams();
  const journey = useJourney();
  const [page, setPage] = useState<number | null>(null);
  const [cover, setCover] = useState(true);
  const [query, setQuery] = useState("");

  // Open on ?page=, else where you left off, else today's sabaq page
  useEffect(() => {
    if (page !== null || !journey) return;
    const fromUrl = Number(params.get("page"));
    let last = 0;
    try {
      last = Number(localStorage.getItem(LAST_PAGE));
    } catch {}
    setPage(fromUrl || last || journey.plan.sabaq?.lines[0]?.page || 1);
  }, [journey, params, page]);

  const go = (p: number) => {
    const n = Math.max(1, Math.min(TOTAL_PAGES, p));
    setPage(n);
    try {
      localStorage.setItem(LAST_PAGE, String(n));
    } catch {}
    router.replace(`/mushaf?page=${n}`, { scroll: false });
  };

  const surahsOnPage = useMemo(
    () => (journey && page ? [...new Set((journey.index.byPage.get(page) ?? []).map((l) => l.surah))] : []),
    [journey, page],
  );
  const filtered = SURAHS.filter((s) => !query || s.name.toLowerCase().includes(query.toLowerCase()) || String(s.id) === query.trim());

  return (
    <AppShell wide>
      <div className="grid gap-6 pt-6 lg:grid-cols-[240px_1fr_300px]">
        <nav className="hidden lg:block">
          <div className="sticky top-24">
            <label className="flex h-10 items-center gap-2 rounded-full border border-border bg-surface px-3.5 text-sm">
              <Search size={14} className="text-parchment-muted" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a surah" className="w-full bg-transparent outline-none" />
            </label>
            <div className="mt-3 max-h-[calc(100vh-11rem)] space-y-0.5 overflow-y-auto pr-1">
              {filtered.map((s) => {
                const first = journey?.index.bySurah.get(s.id)?.[0]?.page;
                const here = surahsOnPage.includes(s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => first && go(first)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                      here ? "bg-teal/10 text-teal" : "text-parchment-muted hover:bg-surface hover:text-parchment"
                    }`}
                  >
                    <span className="w-6 text-right text-xs tabular-nums opacity-60">{s.id}</span>
                    <span className="flex-1">{s.name}</span>
                    <span className="font-quran text-base opacity-80">{s.arabic}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </nav>

        {journey && page ? (
          <ReaderPage key={page} page={page} journey={journey} cover={cover} onGo={go} />
        ) : (
          <div className="mx-auto aspect-[3/5] h-[calc(100vh-8.5rem)] animate-pulse rounded-3xl bg-surface-raised" />
        )}

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-[24px] border border-border bg-surface p-5">
            <div className="flex items-center justify-between">
              <button onClick={() => page && go(page + 1)} aria-label="Next page" className="flex h-9 w-9 items-center justify-center rounded-full border border-border hover:border-teal/50">
                <ChevronLeft size={16} />
              </button>
              <label className="flex items-baseline gap-1.5 font-serif text-2xl">
                Page
                <input
                  type="number"
                  min={1}
                  max={TOTAL_PAGES}
                  value={page ?? ""}
                  onChange={(e) => Number(e.target.value) && go(Number(e.target.value))}
                  className="w-16 bg-transparent text-center outline-none"
                />
              </label>
              <button onClick={() => page && go(page - 1)} aria-label="Previous page" className="flex h-9 w-9 items-center justify-center rounded-full border border-border hover:border-teal/50">
                <ChevronRight size={16} />
              </button>
            </div>
            <p className="mt-2 text-center text-xs text-parchment-muted">
              Juz {page ? juzOfPage(page) : "–"} · {surahsOnPage.map((s) => SURAHS[s - 1]?.name).join(", ")}
            </p>
            {page && journey && journey.states.get(page)?.memorisedLines ? (
              <p className="mt-1 text-center text-xs text-teal">{COLOUR_LABEL[journey.states.get(page)!.colour]}</p>
            ) : null}
          </div>

          <button
            onClick={() => setCover((c) => !c)}
            className={`flex h-11 w-full items-center justify-center gap-2 rounded-full border text-sm transition-colors ${
              cover ? "border-teal/40 bg-teal/10 text-teal" : "border-border text-parchment-muted"
            }`}
          >
            {cover ? <EyeOff size={15} /> : <Eye size={15} />} {cover ? "Covering what you know" : "Showing everything"}
          </button>
          <p className="px-2 text-xs leading-relaxed text-parchment-muted">
            {cover
              ? "Lines you've memorised are covered. Recite them; press Space to check a line, or tap a word open when you're stuck. Those words feed your trigger words and the page's strength."
              : "Tap any word to see it up close with its meaning."}
          </p>
        </aside>
      </div>
    </AppShell>
  );
}

function ReaderPage({
  page, journey, cover, onGo,
}: {
  page: number;
  journey: NonNullable<ReturnType<typeof useJourney>>;
  cover: boolean;
  onGo: (p: number) => void;
}) {
  const { pages } = usePages([page]);
  const data = pages?.[0] ?? null;
  const memorised = useMemo(() => memorisedLineDays(journey.data, journey.index), [journey.data, journey.index]);
  const claimed = useMemo(() => claimedAyahs(journey.data, journey.index), [journey.data, journey.index]);
  // A word is covered when its line is memorised, or its ayah is one you've marked as known
  const knownWord = (key: string, line: number) =>
    memorised.has(`${page}:${line}`) || claimed.has(key.split(":").slice(0, 2).join(":"));
  const known = useMemo(
    () =>
      (journey.index.byPage.get(page) ?? [])
        .filter((l) => memorised.has(lineId(l)) || Array.from({ length: l.a2 - l.a1 + 1 }, (_, i) => `${l.surah}:${l.a1 + i}`).some((k) => claimed.has(k)))
        .map((l) => l.line),
    [journey.index, memorised, claimed, page],
  );
  const byPage = useMemo(() => new Map([[page, known]]), [page, known]);
  const words = useMemo(
    () => (data && known.length ? portionWords([data], byPage, (t, line) => knownWord(t.key, line)) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, byPage, known.length, memorised, claimed],
  );
  const [portion, dispatch] = useReducer((s: PortionState, a: PortionAction) => reducePortion(words, s, a), undefined, () => initialPortion([]));
  useEffect(() => dispatch({ type: "reset" }), [words]);
  const [note, setNote] = useState<string | null>(null);
  const started = useRef(Date.now());

  // Whatever was tapped open counts, even if you move on before finishing the page
  const latest = useRef<{ words: PortionWord[]; portion: PortionState; saved: boolean }>({ words, portion, saved: false });
  latest.current = { ...latest.current, words, portion };
  const save = () => {
    const { words: w, portion: p, saved } = latest.current;
    if (saved || !w.length) return null;
    const r = portionResult(w, p);
    const touched = p.marks.some((m) => m !== "covered") || p.wrong.some(Boolean);
    if (!touched) return null;
    recordPortion("drill", "covered", r, Math.round((Date.now() - started.current) / 1000));
    latest.current.saved = true;
    return r;
  };
  useEffect(() => () => void save(), []); // on leaving the page
  useEffect(() => {
    if (!cover || !words.length || !portionDone(portion) || latest.current.saved) return;
    const r = save();
    if (!r) return;
    if (r.clean) chime();
    setNote(r.clean ? "Recited cleanly from memory. Alhamdulillah." : `${r.peeked.length + r.wrongWords.length} slip${r.peeked.length + r.wrongWords.length === 1 ? "" : "s"}, saved for your review.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portion]);

  useKeys((e) => {
    const k = e.key;
    if (k === "ArrowLeft") onGo(page + 1); // Arabic pages turn leftwards
    else if (k === "ArrowRight") onGo(page - 1);
    else if (cover && (k === " " || k === "Enter")) (e.preventDefault(), dispatch({ type: "check" }));
    else if (cover && (k.toLowerCase() === "z" || k === "Backspace")) dispatch({ type: "undo" });
  });

  const active = activeLineKey(words, portion);
  const covering = cover && words.length > 0 && !latest.current.saved;

  return (
    <div className="flex flex-col items-center">
      {data ? (
        <MushafPage
          data={data}
          glowLine={covering && active ? Number(active.split(":")[1]) : null}
          portion={covering ? { words, state: portion, onTap: (i) => dispatch({ type: "tap", index: i }) } : undefined}
          glossOnTap={!covering}
        />
      ) : (
        <div className="aspect-[3/5] h-[calc(100vh-8.5rem)] animate-pulse rounded-3xl bg-surface-raised" />
      )}
      <div className="mt-3 flex min-h-[40px] flex-wrap items-center justify-center gap-3 text-sm">
        {covering ? (
          <>
            <button onClick={() => dispatch({ type: "undo" })} aria-label="Undo" className="flex h-9 w-9 items-center justify-center rounded-full border border-border">
              <Undo2 size={15} />
            </button>
            <button onClick={() => dispatch({ type: "check" })} className="h-9 rounded-full bg-teal px-4 font-semibold text-bg">
              Check line <Kbd dark>Space</Kbd>
            </button>
            <FlagCovers page={page} line={active ? Number(active.split(":")[1]) : null} />
          </>
        ) : note ? (
          <p className="pop-in rounded-full bg-heat-strong/10 px-4 py-2 text-heat-strong">{note}</p>
        ) : cover && !known.length ? (
          <p className="text-parchment-muted">Nothing memorised on this page yet, so nothing is covered.</p>
        ) : null}
      </div>
    </div>
  );
}
