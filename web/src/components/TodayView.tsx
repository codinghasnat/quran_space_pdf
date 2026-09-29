"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BookOpen, Check, Flame, Languages, Settings2, Sparkles } from "lucide-react";
import { loadIndex, loadPage, verseRange } from "@/lib/data";
import { formatDay, isoDay } from "@/lib/dates";
import { forecast, planDay, streak, type Kind, type PageProgress } from "@/lib/progress";
import { useProgress } from "@/lib/store";
import { surahName } from "@/lib/surahs";
import type { PageIndexEntry } from "@/lib/types";
import PageMap from "./PageMap";
import SettingsPanel from "./SettingsPanel";
import ThemeToggle from "./ThemeToggle";

export default function TodayView() {
  const [progress, , hydrated] = useProgress();
  const [index, setIndex] = useState<Map<number, PageIndexEntry>>(new Map());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const day = isoDay();

  useEffect(() => {
    loadIndex().then((entries) => setIndex(new Map(entries.map((e) => [e.page, e]))));
  }, []);

  const plan = useMemo(() => planDay(progress, day), [progress, day]);
  const fc = useMemo(() => forecast(progress, day), [progress, day]);
  const days = streak(progress.sessions, day);
  const todaysSabaq = plan.sabaq.type === "finished" ? null : plan.sabaq.page;
  const firstRun = hydrated && !progress.setupDone && progress.sessions.length === 0;
  const weakWords = useMemo(
    () =>
      Object.entries(progress.words)
        .map(([key, w]) => ({ key, ...w, score: w.stuck + w.mistake + w.meaning + w.hint * 0.5 }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 8),
    [progress.words],
  );

  const describe = (page: number) => {
    const e = index.get(page);
    return e ? `${surahName(e.firstVerse)} ${verseRange(e.firstVerse, e.lastVerse)}` : index.size ? "Not built yet" : "";
  };

  return (
    <div className="mx-auto max-w-[680px] px-4 pb-16">
      <header className="flex items-center gap-3 pb-2 pt-8">
        <div className="flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wider text-teal">
            {/* Formatted after hydration: the server's locale and timezone aren't yours */}
            {hydrated ? new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" }) : "\u00a0"}
          </p>
          <h1 className="font-serif text-3xl">Today</h1>
        </div>
        <div
          className={`flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium ${days > 0 ? "bg-teal/10 text-teal" : "bg-parchment-muted/10 text-parchment-muted"}`}
          title="Day streak"
        >
          <Flame size={15} /> {days}
        </div>
        <button
          onClick={() => setSettingsOpen((v) => !v)}
          aria-label="Settings"
          className={`flex h-9 w-9 items-center justify-center rounded-full border border-border transition-colors ${settingsOpen ? "bg-teal text-bg" : "bg-surface text-parchment-muted hover:text-teal"}`}
        >
          <Settings2 size={16} />
        </button>
        <ThemeToggle />
      </header>

      {(settingsOpen || firstRun) && <SettingsPanel firstRun={firstRun} onClose={() => setSettingsOpen(false)} />}

      {hydrated && !firstRun && (
        <>
          <SabaqCard plan={plan.sabaq} describe={describe} />

          <QueueSection
            title="Sabqi"
            subtitle="Recent pages, every day until they settle"
            kind="sabqi"
            pages={plan.sabqi}
            done={plan.doneToday}
            progress={progress.pages}
            describe={describe}
            empty="Pages you learn will be revised here daily."
          />
          <QueueSection
            title="Manzil"
            subtitle="Older pages that are due, weakest first"
            kind="manzil"
            pages={plan.manzil}
            done={plan.doneToday}
            progress={progress.pages}
            describe={describe}
            empty="Nothing due. Pages graduate here once they hold for a week."
          />

          {plan.meaningCheck !== null && (
            <Link
              href={`/practice/${plan.meaningCheck}?kind=free&mode=meaning`}
              className="mt-4 flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-teal/50"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-hint/10 text-hint">
                <Languages size={18} />
              </span>
              <span className="flex-1">
                <span className="block text-sm font-medium">Do you understand page {plan.meaningCheck}?</span>
                <span className="block text-xs text-parchment-muted">
                  You know it by heart. Cover the meanings and test yourself.
                </span>
              </span>
              <ArrowRight size={16} className="text-parchment-muted" />
            </Link>
          )}

          {fc && (
            <p className="mt-6 flex items-start gap-2 text-sm leading-relaxed text-parchment-muted">
              <Sparkles size={15} className="mt-0.5 shrink-0 text-teal" />
              <span>
                After today: page {fc.nextPages.filter((p) => p !== todaysSabaq).slice(0, 2).join(", ")}.{" "}
                {fc.pagesPerWeek > 0 ? (
                  <>
                    At {fc.pagesPerWeek} pages a week you&apos;ll finish Juz {fc.juz}
                    {fc.juzDoneOn ? ` around ${formatDay(fc.juzDoneOn)}` : ""}.
                  </>
                ) : (
                  "Your pace shows up here once you've done a few sabaq."
                )}
              </span>
            </p>
          )}

          <section className="mt-8">
            <SectionTitle title="Your mushaf" subtitle="Tap any page to practise it" />
            <PageMap progress={progress.pages} built={index} today={day} />
          </section>

          {weakWords.length > 0 && (
            <section className="mt-8">
              <SectionTitle title="Words that trip you up" subtitle="Across every session" />
              <div className="mt-3 flex flex-wrap gap-2" dir="rtl">
                {weakWords.map((w) => (
                  <Link
                    key={w.key}
                    href={`/practice/${w.page}?kind=free`}
                    className="inline-flex items-center gap-2 rounded-xl border border-stuck/25 bg-stuck/5 px-3 py-1.5 hover:border-stuck/50"
                  >
                    <WordText wordKey={w.key} page={w.page} />
                    <span dir="ltr" className="text-[11px] text-stuck">×{Math.round(w.score)}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="font-serif text-lg">{title}</h2>
      {subtitle && <p className="text-xs text-parchment-muted">{subtitle}</p>}
    </div>
  );
}

function SabaqCard({ plan, describe }: { plan: ReturnType<typeof planDay>["sabaq"]; describe: (p: number) => string }) {
  if (plan.type === "finished") {
    return (
      <div className="mt-4 rounded-3xl border border-border bg-surface p-6 text-center">
        <p className="font-serif text-xl">Every page is in your hifz. Alhamdulillah.</p>
      </div>
    );
  }
  if (plan.type === "done") {
    return (
      <div className="mt-4 flex items-center gap-4 rounded-3xl border border-teal/30 bg-teal/5 p-5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal text-bg">
          <Check size={20} />
        </span>
        <div className="flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wider text-teal">Sabaq done</p>
          <p className="font-serif text-lg">Page {plan.page}</p>
          {plan.next !== null && (
            <p className="text-xs text-parchment-muted">
              Tomorrow: {plan.next === plan.page ? `page ${plan.page} again` : `page ${plan.next}`}
            </p>
          )}
        </div>
        <Link href={`/practice/${plan.page}?kind=free`} className="text-xs text-parchment-muted underline-offset-2 hover:underline">
          Practise again
        </Link>
      </div>
    );
  }
  return (
    <Link
      href={`/practice/${plan.page}?kind=sabaq`}
      className="group mt-4 block rounded-3xl bg-teal p-6 text-bg shadow-sm transition-transform active:scale-[0.99]"
    >
      <p className="text-[11px] font-medium uppercase tracking-wider opacity-80">
        Sabaq · {plan.type === "repeat" ? "once more" : "new page"}
      </p>
      <div className="mt-1 flex items-end justify-between gap-4">
        <div>
          <p className="font-serif text-3xl">Page {plan.page}</p>
          <p className="mt-0.5 text-sm opacity-85">{plan.type === "repeat" ? plan.reason : describe(plan.page)}</p>
        </div>
        <span className="flex h-11 items-center gap-2 rounded-full bg-bg px-5 text-sm font-semibold text-teal">
          <BookOpen size={16} /> Start
        </span>
      </div>
    </Link>
  );
}

function QueueSection({
  title, subtitle, kind, pages, done, progress, describe, empty,
}: {
  title: string;
  subtitle: string;
  kind: Kind;
  pages: number[];
  done: Set<string>;
  progress: Record<number, PageProgress>;
  describe: (p: number) => string;
  empty: string;
}) {
  const finished = pages.filter((p) => done.has(`${kind}:${p}`)).length;
  return (
    <section className="mt-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-serif text-lg">
          {title}
          {pages.length > 0 && <span className="ml-2 font-sans text-xs text-parchment-muted">{finished}/{pages.length}</span>}
        </h2>
        <p className="text-xs text-parchment-muted">{subtitle}</p>
      </div>
      {pages.length === 0 ? (
        <p className="mt-2 text-sm text-parchment-muted/70">{empty}</p>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {pages.map((p) => {
            const isDone = done.has(`${kind}:${p}`);
            const grade = progress[p]?.lastGrade ?? 0;
            return (
              <Link
                key={p}
                href={`/practice/${p}?kind=${kind}`}
                className={`flex items-center gap-3 rounded-2xl border p-3 transition-colors ${isDone ? "border-teal/30 bg-teal/5" : "border-border bg-surface hover:border-teal/50"}`}
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-serif text-sm ${isDone ? "bg-teal text-bg" : "bg-surface-raised"}`}
                >
                  {isDone ? <Check size={16} /> : p}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">Page {p}</span>
                  <span className="block truncate text-xs text-parchment-muted">{describe(p)}</span>
                </span>
                <GradeDots grade={grade} />
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

function GradeDots({ grade }: { grade: number }) {
  return (
    <span className="flex gap-0.5" title={`Last time: ${grade}/5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`h-1.5 w-1.5 rounded-full ${i <= grade ? (grade < 3 ? "bg-stuck" : "bg-teal") : "bg-border"}`} />
      ))}
    </span>
  );
}

/** Arabic text of a word, looked up from its page data (cached after the first load). */
function WordText({ wordKey, page }: { wordKey: string; page: number }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    loadPage(page).then(
      (d) => setText(d.lines.flatMap((ln) => ln.words).find((w) => w.key === wordKey)?.ar ?? wordKey),
      () => setText(wordKey),
    );
  }, [wordKey, page]);
  return <span className="font-quran text-lg leading-snug">{text ?? "…"}</span>;
}
