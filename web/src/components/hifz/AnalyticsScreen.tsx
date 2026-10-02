"use client";

import { useMemo } from "react";
import { addDays, formatDay } from "@/lib/dates";
import { memorisedLineDays, pageStates, type Colour } from "@/lib/hifz/strength";
import { sabqiHealth } from "@/lib/hifz/tuning";
import { useJourney, type Journey } from "@/lib/hifz/useJourney";
import AppShell from "./AppShell";
import { LineChart, STAGE_COLOURS, StackedBars } from "./Charts";

export default function AnalyticsScreen() {
  const journey = useJourney();
  return (
    <AppShell>
      <div className="pt-8">
        <h1 className="font-serif text-4xl">Analytics</h1>
        <p className="mt-1 text-parchment-muted">How your hifz is growing, and where the time goes.</p>
        {journey ? <Body journey={journey} /> : <div className="mt-6 h-96 animate-pulse rounded-3xl bg-surface-raised" />}
      </div>
    </AppShell>
  );
}

function Body({ journey }: { journey: Journey }) {
  const { data, day, index } = journey;
  const start = data.profile.createdOn;

  const stats = useMemo(() => {
    const minutes = data.recitations.reduce((a, r) => a + r.seconds, 0) / 60;
    const clean = data.recitations.filter((r) => r.clean).length;
    const settled = data.sabaqs.filter((s) => s.settled);
    return {
      minutes: Math.round(minutes),
      days: new Set(data.recitations.map((r) => r.day)).size,
      cleanShare: data.recitations.length ? clean / data.recitations.length : null,
      settled: settled.length,
      health: sabqiHealth(data, day),
    };
  }, [data, day]);

  // Pages memorised (in lines / 15) by day since the start, from the same line history the heatmap uses
  const growth = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const d of memorisedLineDays(data, index).values()) byDay.set(d < start ? start : d, (byDay.get(d < start ? start : d) ?? 0) + 1);
    const pts: { x: string; y: number }[] = [];
    let acc = 0;
    for (let d = start; d <= day; d = addDays(d, 1)) {
      acc += byDay.get(d) ?? 0;
      pts.push({ x: formatDay(d), y: acc / 15 });
    }
    return pts;
  }, [data, start, day, index]);

  const last30 = useMemo(() => {
    const out: { x: string; values: Record<string, number> }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = addDays(day, -i);
      const values = { sabaq: 0, sabqi: 0, dawr: 0 };
      for (const r of data.recitations) if (r.day === d && r.stage in values) values[r.stage as keyof typeof values] += r.seconds / 60;
      out.push({ x: formatDay(d), values });
    }
    return out;
  }, [data, day]);

  const health = useMemo(() => {
    const pts: { x: string; y: number }[] = [];
    for (let i = 59; i >= 0; i--) {
      const d = addDays(day, -i);
      const h = sabqiHealth(data, d);
      if (h !== null) pts.push({ x: formatDay(d), y: h * 100 });
    }
    return pts;
  }, [data, day]);

  const sabaqTrend = useMemo(
    () =>
      data.sabaqs
        .filter((s) => s.settled)
        .map((s) => ({ x: formatDay(s.day), y: s.seconds / 60 / Math.max(1, s.lines.length) })),
    [data],
  );
  const repsTrend = useMemo(
    () => data.sabaqs.filter((s) => s.settled).map((s) => ({ x: formatDay(s.day), y: s.repsToFirstClean })),
    [data],
  );

  const mix = useMemo(() => {
    const out: { x: string; values: Record<string, number> }[] = [];
    for (let w = 7; w >= 0; w--) {
      const d = addDays(day, -7 * w);
      if (d < start) continue;
      const counts: Record<Colour, number> = { strong: 0, okay: 0, weak: 0, blank: 0 };
      for (const s of pageStates(data, index, d).values()) if (s.memorisedLines > 0) counts[s.colour]++;
      out.push({ x: formatDay(d), values: counts });
    }
    return out;
  }, [data, index, day, start]);

  const bests = useMemo(() => {
    const bySize = new Map<number, { minutes: number; first: number }>();
    for (const s of data.sabaqs.filter((x) => x.settled)) {
      const n = s.lines.length;
      const b = bySize.get(n) ?? { minutes: Infinity, first: Infinity };
      bySize.set(n, { minutes: Math.min(b.minutes, s.seconds / 60), first: Math.min(b.first, s.repsToFirstClean) });
    }
    return [...bySize.entries()].sort((a, b) => a[0] - b[0]);
  }, [data]);

  const weakPages = useMemo(() => {
    const m = new Map<number, number>();
    for (const w of data.wordEvents) m.set(w.page, (m.get(w.page) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [data]);

  return (
    <div className="mt-6 space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Stat label="Minutes with the Quran" value={String(stats.minutes)} />
        <Stat label="Days practised" value={String(stats.days)} />
        <Stat label="Sabaqs settled" value={String(stats.settled)} />
        <Stat label="Clean recitations" value={stats.cleanShare === null ? "–" : `${Math.round(stats.cleanShare * 100)}%`} />
        <Stat label="Sabqi health (14 days)" value={stats.health === null ? "–" : `${Math.round(stats.health * 100)}%`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Pages memorised" sub="Including what you knew at the start">
          <LineChart points={growth} format={(v) => v.toFixed(v < 10 ? 1 : 0)} empty="Your growth curve starts with your first sabaq." />
        </Card>
        <Card title="Minutes a day, by stage" sub="Last 30 days">
          <StackedBars
            bars={last30}
            series={[
              { key: "sabaq", label: "Sabaq", colour: STAGE_COLOURS.sabaq },
              { key: "sabqi", label: "Sabqi", colour: STAGE_COLOURS.sabqi },
              { key: "dawr", label: "Dawr", colour: STAGE_COLOURS.dawr },
            ]}
            empty="Time you spend shows up here."
          />
        </Card>
        <Card title="Sabqi health" sub="Share of sabqi pages recited cleanly, rolling 14 days">
          <LineChart points={health} yMax={100} format={(v) => `${Math.round(v)}%`} empty="Needs about a week of sabqi to show." />
        </Card>
        <Card title="Heatmap over time" sub="Memorised pages by colour, week by week">
          <StackedBars
            bars={mix}
            series={[
              { key: "strong", label: "Strong", colour: "rgb(var(--heat-strong))" },
              { key: "okay", label: "Okay", colour: "rgb(var(--heat-okay))" },
              { key: "weak", label: "Practise again", colour: "rgb(var(--heat-weak))" },
            ]}
            empty="Shows once you have memorised pages."
          />
        </Card>
        <Card title="Minutes per sabaq line" sub="Should drift down as your memory sharpens">
          <LineChart points={sabaqTrend} format={(v) => v.toFixed(1)} empty="Appears after two settled sabaqs." />
        </Card>
        <Card title="Attempts to the first clean recitation" sub="The other speed variable">
          <LineChart points={repsTrend} empty="Appears after two settled sabaqs." colour={STAGE_COLOURS.sabqi} />
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Personal bests" sub="Compared like for like, by sabaq size">
          {bests.length ? (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-parchment-muted">
                <tr><th className="pb-2 font-normal">Sabaq size</th><th className="pb-2 font-normal">Quickest to settle</th><th className="pb-2 font-normal">Fewest attempts to first clean</th></tr>
              </thead>
              <tbody>
                {bests.map(([n, b]) => (
                  <tr key={n} className="border-t border-border">
                    <td className="py-2">{n} lines</td>
                    <td className="py-2">{Math.round(b.minutes)} min</td>
                    <td className="py-2">{b.first}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-parchment-muted">Your records appear after your first settled sabaq.</p>
          )}
        </Card>
        <Card title="Pages with the most slips" sub="Peeks and mistakes, all time">
          {weakPages.length ? (
            <div className="space-y-2">
              {weakPages.map(([p, n]) => (
                <div key={p} className="flex items-center gap-3 text-sm">
                  <span className="w-16 text-parchment-muted">Page {p}</span>
                  <span className="h-2 rounded-full bg-hint" style={{ width: `${(n / weakPages[0][1]) * 70}%` }} />
                  <span className="text-xs tabular-nums text-parchment-muted">{n}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-parchment-muted">No slips recorded yet.</p>
          )}
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-border bg-surface p-4">
      <p className="font-serif text-3xl tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-parchment-muted">{label}</p>
    </div>
  );
}

function Card({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[24px] border border-border bg-surface p-5">
      <h2 className="font-serif text-lg">{title}</h2>
      <p className="mb-4 text-xs text-parchment-muted">{sub}</p>
      {children}
    </section>
  );
}
