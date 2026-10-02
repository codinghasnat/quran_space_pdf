"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BookOpen, Check, Clock, Hourglass, Layers, Minus, Plus, RefreshCw, Sparkles, Sun } from "lucide-react";
import { daysBetween } from "@/lib/dates";
import { STAGE_INFO, WHY_REASONS } from "@/lib/hifz/content";
import type { DayPlan } from "@/lib/hifz/plan";
import type { LineInfo } from "@/lib/hifz/quran";
import { append, replace, updateSettings } from "@/lib/hifz/store";
import { weeklyReview } from "@/lib/hifz/tuning";
import type { TuningChange } from "@/lib/hifz/types";
import { useJourney, type Journey } from "@/lib/hifz/useJourney";
import { SURAHS } from "@/lib/surahs";
import AppShell from "./AppShell";
import { HeatLegend, MiniHeatmap } from "./Heatmap";

const BUDGET_KEY = (day: string) => `hifz:budget:${day}`;

export function describeLines(lines: LineInfo[]): string {
  if (!lines.length) return "";
  const s = lines[0].surah;
  const a1 = Math.min(...lines.map((l) => l.a1));
  const a2 = Math.max(...lines.map((l) => l.a2));
  return `${SURAHS[s - 1]?.name ?? ""} ${a1 === a2 ? a1 : `${a1}–${a2}`}`;
}

export default function TodayScreen() {
  const router = useRouter();
  const [budget, setBudget] = useState<number | undefined>(undefined);
  const journey = useJourney(budget);

  useEffect(() => {
    if (!journey) return;
    try {
      const saved = localStorage.getItem(BUDGET_KEY(journey.day));
      if (saved && budget === undefined) setBudget(Number(saved));
    } catch {}
  }, [journey, budget]);

  useEffect(() => {
    if (journey && !journey.data.profile.onboarded) router.replace("/welcome");
  }, [journey, router]);

  if (!journey || !journey.data.profile.onboarded) {
    return (
      <AppShell>
        <div className="mt-10 h-64 animate-pulse rounded-[28px] bg-surface-raised" />
      </AppShell>
    );
  }

  const setDayBudget = (m: number) => {
    const v = Math.max(10, Math.min(300, m));
    setBudget(v);
    try {
      localStorage.setItem(BUDGET_KEY(journey.day), String(v));
    } catch {}
  };

  return (
    <AppShell>
      <div className="grid gap-6 pt-8 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Hero journey={journey} />
          <TuningPrompt journey={journey} />
          <BudgetBar plan={journey.plan} onChange={setDayBudget} />
          <StageCards journey={journey} />
          {journey.plan.notes.length > 0 && (
            <div className="space-y-2">
              {journey.plan.notes.map((n) => (
                <p key={n} className="flex items-start gap-2 rounded-2xl bg-hint/10 px-4 py-3 text-sm text-parchment">
                  <Sparkles size={15} className="mt-0.5 shrink-0 text-hint" /> {n}
                </p>
              ))}
            </div>
          )}
        </div>
        <aside className="space-y-6">
          <Link
            href="/mushaf"
            className="group flex items-center gap-4 rounded-[24px] border border-teal/30 bg-surface p-5 transition-all hover:-translate-y-0.5 hover:border-teal/60 glow-soft"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal text-bg">
              <BookOpen size={22} />
            </span>
            <span className="flex-1">
              <span className="block font-serif text-xl">Open the mushaf</span>
              <span className="block text-xs text-parchment-muted">Any surah, any page. What you know stays covered.</span>
            </span>
            <ArrowRight size={16} className="text-teal transition-transform group-hover:translate-x-0.5" />
          </Link>
          <WhyCard journey={journey} />
          <div className="rounded-[24px] border border-border bg-surface p-5">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="font-serif text-lg">Progress</h2>
              <Link href="/progress" className="text-xs text-teal hover:underline">Open</Link>
            </div>
            <MiniHeatmap states={journey.states} />
            <HeatLegend className="mt-3" />
          </div>
        </aside>
      </div>
    </AppShell>
  );
}

function monthYear(day: string) {
  const [y, m] = day.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function Hero({ journey }: { journey: Journey }) {
  const { projection: p, data, states, pace } = journey;
  const memorisedLines = [...states.values()].reduce((a, s) => a + s.memorisedLines, 0);
  const total = journey.index.lines.length;
  const pages = [...states.values()].filter((s) => s.status === "memorised").length;
  const share = memorisedLines / total;
  const hero = data.profile.hero;

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-teal/20 bg-surface p-7">
      <div className="aurora pointer-events-none absolute inset-0 opacity-80" />
      <div className="relative">
        {p.calibrating > 0 || !hero ? (
          <>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-teal">Your journey</p>
            <h1 className="mt-2 font-serif text-4xl leading-tight">
              {p.calibrating > 0 ? "Finding your pace" : "Your hafiz date appears soon"}
            </h1>
            <p className="mt-2 max-w-md text-sm text-parchment-muted">
              {p.calibrating > 0
                ? `Calibrating · ${p.calibrating} day${p.calibrating === 1 ? "" : "s"} left. Your first month sets an honest pace, then your hafiz date appears here.`
                : "Complete a few sabaqs and it will settle."}
            </p>
          </>
        ) : (
          <>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-teal">Hafiz by</p>
            <h1 className="mt-1 font-serif text-5xl leading-tight drop-shadow-[0_0_24px_rgb(var(--teal)/0.25)]">{monthYear(hero.date)}</h1>
            <p className="mt-2 text-sm text-parchment-muted">
              Likely {monthYear(hero.likely)} at your current pace
              {pace && (
                <span
                  className={`ml-3 inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium ${
                    pace === "behind" ? "bg-hint/15 text-hint" : "bg-heat-strong/15 text-heat-strong"
                  }`}
                >
                  {pace === "on track" ? "On track" : pace === "ahead" ? "Ahead" : "Behind"}
                </span>
              )}
            </p>
            {hero.reason && <p className="mt-1 text-xs text-parchment-muted/80">{hero.reason}</p>}
            {pace === "behind" && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => updateSettings((s) => ({ ...s, dailyMinutes: s.dailyMinutes + 15 }))}
                  className="h-8 rounded-full bg-teal px-3.5 text-xs font-semibold text-bg"
                >
                  Add 15 min a day
                </button>
                <span className="self-center text-xs text-parchment-muted">or let the date move; it will settle within a week.</span>
              </div>
            )}
          </>
        )}

        <div className="mt-7">
          <div className="flex items-baseline justify-between text-sm">
            <span>
              <span className="font-serif text-2xl">{pages}</span>
              <span className="text-parchment-muted"> of 604 pages</span>
            </span>
            <span className="text-parchment-muted">{(share * 100).toFixed(share < 0.1 ? 1 : 0)}%</span>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-heat-blank">
            <div
              className="h-full rounded-full bg-gradient-to-r from-teal to-heat-strong shadow-[0_0_14px_rgb(var(--heat-strong)/0.6)] transition-all duration-1000"
              style={{ width: `${Math.max(share * 100, share > 0 ? 1.5 : 0)}%` }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function BudgetBar({ plan, onChange }: { plan: DayPlan; onChange: (m: number) => void }) {
  const used = plan.sabqi.minutes + (plan.sabaq?.minutes ?? 0) + plan.dawr.minutes;
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-[22px] border border-border bg-surface px-5 py-4">
      <Clock size={18} className="text-teal" />
      <span className="text-sm">Today I have</span>
      <div className="flex items-center gap-1 rounded-full bg-surface-raised p-1">
        <button onClick={() => onChange(plan.budget - 15)} aria-label="Less time" className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-surface">
          <Minus size={14} />
        </button>
        <span className="min-w-[72px] text-center font-serif text-lg tabular-nums">{plan.budget} min</span>
        <button onClick={() => onChange(plan.budget + 15)} aria-label="More time" className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-surface">
          <Plus size={14} />
        </button>
      </div>
      <span className="text-xs text-parchment-muted">
        about {used} min planned{plan.restDay ? " · a rest day, but every bit counts" : ""}
      </span>
    </div>
  );
}

function StageCards({ journey }: { journey: Journey }) {
  const { plan } = journey;
  const sabaqDone = !!plan.sabaqToday;
  const sabqiDone = plan.sabqi.pages.length > 0 && plan.sabqi.pages.every((p) => plan.done.sabqi.has(p));
  const dawrDone = plan.dawr.pages.length > 0 && plan.dawr.pages.every((p) => plan.done.dawr.has(p));
  // Sabqi first when there is any (it carries the most weight), then sabaq, then dawr
  const next =
    plan.sabqi.pages.length && !sabqiDone ? "sabqi" : plan.sabaq && !sabaqDone ? "sabaq" : plan.dawr.pages.length && !dawrDone ? "dawr" : null;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <StageCard
        stage="sabaq"
        icon={<BookOpen size={20} />}
        href="/session/sabaq"
        glow={next === "sabaq"}
        done={sabaqDone}
        doneText={plan.sabaqToday?.settled ? "Settled, alhamdulillah" : "Done for today; it comes back tomorrow"}
        empty={plan.finished ? "Every line is in your hifz." : "Not today: sabqi needs the time."}
        detail={
          plan.sabaq
            ? {
                title: `${plan.sabaq.lines.length} lines`,
                sub: describeLines(plan.sabaq.lines),
                minutes: plan.sabaq.minutes,
                badge: plan.sabaq.repeat ? "Once more" : null,
              }
            : null
        }
      />
      <StageCard
        stage="sabqi"
        icon={<RefreshCw size={20} />}
        href="/session/sabqi"
        glow={next === "sabqi"}
        done={sabqiDone}
        doneText="Recent pages locked in"
        empty="Your sabaqs will be revised here daily."
        progress={plan.sabqi.pages.length ? [plan.sabqi.pages.filter((p) => plan.done.sabqi.has(p)).length, plan.sabqi.pages.length] : null}
        detail={
          plan.sabqi.pages.length
            ? { title: `${plan.sabqi.pages.length} page${plan.sabqi.pages.length === 1 ? "" : "s"}`, sub: pageRange(plan.sabqi.pages), minutes: plan.sabqi.minutes, badge: null }
            : null
        }
      />
      <StageCard
        stage="dawr"
        icon={<Layers size={20} />}
        href="/session/dawr"
        glow={next === "dawr"}
        done={dawrDone}
        doneText="Rotation done for today"
        empty="Pages join your dawr once they leave sabqi."
        progress={plan.dawr.pages.length ? [plan.dawr.pages.filter((p) => plan.done.dawr.has(p)).length, plan.dawr.pages.length] : null}
        detail={
          plan.dawr.pages.length
            ? {
                title: `${plan.dawr.pages.length} page${plan.dawr.pages.length === 1 ? "" : "s"}`,
                sub: `${plan.dawr.chunks.length} chunk${plan.dawr.chunks.length === 1 ? "" : "s"} through the day`,
                minutes: plan.dawr.minutes,
                badge: null,
              }
            : null
        }
      />
    </div>
  );
}

function pageRange(pages: number[]) {
  if (pages.length <= 3) return `Page${pages.length > 1 ? "s" : ""} ${pages.join(", ")}`;
  return `Pages ${pages[0]}–${pages.at(-1)}`;
}

function StageCard({
  stage, icon, href, glow, done, doneText, empty, detail, progress,
}: {
  stage: keyof typeof STAGE_INFO;
  icon: React.ReactNode;
  href: string;
  glow: boolean;
  done: boolean;
  doneText: string;
  empty: string;
  detail: { title: string; sub: string; minutes: number; badge: string | null } | null;
  progress?: [number, number] | null;
}) {
  const info = STAGE_INFO[stage];
  const body = (
    <div
      className={`group relative flex h-full flex-col rounded-[24px] border p-5 transition-all duration-300 ${
        done
          ? "border-heat-strong/30 bg-heat-strong/[0.06]"
          : glow
            ? "glow-breathe border-teal/50 bg-surface"
            : "border-border bg-surface hover:-translate-y-0.5 hover:border-teal/40"
      }`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
            done ? "bg-heat-strong text-bg" : glow ? "bg-teal text-bg" : "bg-teal/10 text-teal"
          }`}
        >
          {done ? <Check size={20} className="pop-in" /> : icon}
        </span>
        {detail?.badge && <span className="rounded-full bg-hint/15 px-2.5 py-1 text-[11px] font-medium text-hint">{detail.badge}</span>}
        {progress && !done && (
          <span className="text-xs tabular-nums text-parchment-muted">
            {progress[0]}/{progress[1]}
          </span>
        )}
      </div>
      <p className="mt-4 font-serif text-2xl">{info.name}</p>
      <p className="text-xs uppercase tracking-wider text-parchment-muted">{info.tagline}</p>
      <div className="mt-4 flex-1">
        {done ? (
          <p className="text-sm text-heat-strong">{doneText}</p>
        ) : detail ? (
          <>
            <p className="text-sm font-medium">{detail.title}</p>
            <p className="text-sm text-parchment-muted">{detail.sub}</p>
          </>
        ) : (
          <p className="text-sm text-parchment-muted">{empty}</p>
        )}
      </div>
      {detail && !done && (
        <div className="mt-4 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs text-parchment-muted">
            <Hourglass size={13} /> ~{detail.minutes} min
          </span>
          <span className="flex items-center gap-1 text-sm font-medium text-teal transition-transform group-hover:translate-x-0.5">
            Begin <ArrowRight size={15} />
          </span>
        </div>
      )}
    </div>
  );
  return detail && !done ? <Link href={href}>{body}</Link> : body;
}

function WhyCard({ journey }: { journey: Journey }) {
  const why = journey.data.profile.why;
  const recentSetback = useMemo(() => {
    const last = journey.data.sabaqs.at(-1);
    const lastDay = journey.data.recitations.at(-1)?.day;
    return (last && !last.settled) || (lastDay && daysBetween(lastDay, journey.day) > 1);
  }, [journey]);
  if (why === null) return null;
  const r = WHY_REASONS[why];
  return (
    <div className={`rounded-[24px] border p-5 ${recentSetback ? "border-teal/40 bg-teal/[0.06] glow-soft" : "border-border bg-surface"}`}>
      <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-teal">
        <Sun size={14} /> {recentSetback ? "Remember why" : "Your why"}
      </p>
      <p className="mt-3 font-serif text-lg leading-snug">{r.text}</p>
      <a href={r.href} target="_blank" rel="noreferrer" className="mt-2 block text-xs text-parchment-muted hover:text-teal">
        {r.source}
      </a>
    </div>
  );
}

function TuningPrompt({ journey }: { journey: Journey }) {
  const proposal = useMemo(() => {
    const pending = journey.data.tuning.find((t) => t.accepted === null);
    return pending ?? weeklyReview(journey.data, journey.day);
  }, [journey]);

  // A review with nothing to change is logged quietly so the next one is a week away
  useEffect(() => {
    if (proposal && proposal.accepted === true && !journey.data.tuning.includes(proposal)) append("tuning", proposal);
  }, [proposal, journey.data.tuning]);

  if (!proposal || proposal.accepted !== null) return null;
  const answer = (accepted: boolean) => {
    const t: TuningChange = { ...proposal, accepted };
    const others = journey.data.tuning.filter((x) => x !== proposal);
    replace("tuning", [...others, t]);
    if (accepted) updateSettings((s) => ({ ...s, [t.variable]: t.to }));
  };
  const what = proposal.variable === "sabaqLines" ? `Sabaq ${proposal.from} → ${proposal.to} lines` : `Repetitions ${proposal.from} → ${proposal.to}`;
  return (
    <div className="pop-in flex flex-wrap items-center gap-4 rounded-[22px] border border-teal/30 bg-teal/[0.06] px-5 py-4">
      <Sparkles size={18} className="text-teal" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Weekly check-in: {what}</p>
        <p className="text-xs text-parchment-muted">{proposal.reason}</p>
      </div>
      <button onClick={() => answer(false)} className="h-8 rounded-full px-3.5 text-xs text-parchment-muted hover:text-parchment">
        Keep as is
      </button>
      <button onClick={() => answer(true)} className="h-8 rounded-full bg-teal px-3.5 text-xs font-semibold text-bg">
        Sounds good
      </button>
    </div>
  );
}
