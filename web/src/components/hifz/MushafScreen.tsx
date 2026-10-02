"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { loadPage } from "@/lib/data";
import { useJourney } from "@/lib/hifz/useJourney";
import AppShell from "./AppShell";
import { HeatmapExplorer } from "./Heatmap";

export default function MushafScreen() {
  const journey = useJourney();
  const triggers = useMemo(() => {
    if (!journey) return [];
    const m = new Map<string, { key: string; page: number; n: number; last: string }>();
    for (const w of journey.data.wordEvents) {
      const e = m.get(w.key) ?? { key: w.key, page: w.page, n: 0, last: w.day };
      e.n++;
      e.last = w.day > e.last ? w.day : e.last;
      m.set(w.key, e);
    }
    return [...m.values()].sort((a, b) => b.n - a.n || (a.last < b.last ? 1 : -1)).slice(0, 24);
  }, [journey]);

  return (
    <AppShell>
      <div className="pt-8">
        <h1 className="font-serif text-4xl">Your mushaf</h1>
        <p className="mt-1 text-parchment-muted">Every page, coloured by how well it&apos;s holding today.</p>
        <div className="mt-6">
          {journey ? (
            <HeatmapExplorer data={journey.data} index={journey.index} states={journey.states} today={journey.day} />
          ) : (
            <div className="h-96 animate-pulse rounded-3xl bg-surface-raised" />
          )}
        </div>

        {triggers.length > 0 && (
          <section className="mt-10">
            <h2 className="font-serif text-2xl">Trigger words</h2>
            <p className="text-sm text-parchment-muted">The words you most often needed to see. They usually start an ayah or a page.</p>
            <div className="mt-4 flex flex-wrap gap-2" dir="rtl">
              {triggers.map((t) => (
                <Link
                  key={t.key}
                  href={`/practice/${t.page}`}
                  className="inline-flex items-center gap-2 rounded-2xl border border-hint/30 bg-hint/[0.07] px-3.5 py-2 transition-colors hover:border-hint/60"
                >
                  <WordText wordKey={t.key} page={t.page} />
                  <span dir="ltr" className="text-[11px] text-hint">×{t.n}</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}

export function WordText({ wordKey, page }: { wordKey: string; page: number }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    loadPage(page).then(
      (d) => setText(d.lines.flatMap((ln) => ln.words).find((w) => w.key === wordKey)?.ar ?? wordKey),
      () => setText(wordKey),
    );
  }, [wordKey, page]);
  return <span className="font-quran text-xl leading-snug">{text ?? "…"}</span>;
}
