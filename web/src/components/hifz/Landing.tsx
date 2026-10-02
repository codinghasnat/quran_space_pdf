"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, BarChart3, BookOpen, CalendarClock, EyeOff, Flame, LayoutGrid, Lock, Sparkles } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { loadPage } from "@/lib/data";
import { WHY_REASONS } from "@/lib/hifz/content";
import { useHifz } from "@/lib/hifz/store";
import type { PageData } from "@/lib/types";
import { HowItWorks } from "./Onboarding";

const DIFFERENT = [
  { icon: CalendarClock, title: "A plan built from your time", text: "Tell it how many minutes you have. It splits them between sabaq, sabqi and dawr, sabqi first, always." },
  { icon: EyeOff, title: "Honest about what you know", text: "Covered and eyes-closed recitation. Peeking doesn't count, and the words you needed become tomorrow's focus." },
  { icon: LayoutGrid, title: "Your whole mushaf, at a glance", text: "Every page coloured by how well it's holding today: strong, okay, or practise again." },
  { icon: Flame, title: "A date to aim for", text: "After a month it projects when you'll complete hifz at your pace, and keeps it steady as you go." },
  { icon: BookOpen, title: "Meaning alongside memory", text: "Your own word-by-word mushaf, with every word's meaning a tap away while you learn." },
];

export default function Landing() {
  const router = useRouter();
  const params = useSearchParams();
  const data = useHifz();
  const returning = !!data?.profile.onboarded;

  // Returning learners go straight to Today, unless they came back here on purpose
  useEffect(() => {
    if (returning && params.get("landing") === null) router.replace("/today");
  }, [returning, params, router]);

  const start = returning ? "/today" : "/welcome";

  return (
    <div className="min-h-screen overflow-x-hidden">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-bg/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1100px] items-center gap-3 px-4 sm:px-6">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal font-quran text-lg text-bg glow-soft">ح</span>
          <span className="font-serif text-xl">Hifz</span>
          <div className="flex-1" />
          <Link href={start} className="hidden text-sm text-parchment-muted hover:text-teal sm:block">
            {returning ? "Open the app" : "Already started? Open the app"}
          </Link>
          <ThemeToggle />
        </div>
      </header>

      {/* Hero */}
      <section className="relative">
        <div className="aurora pointer-events-none absolute inset-0 opacity-90" />
        <div className="relative mx-auto grid max-w-[1100px] items-center gap-12 px-4 py-16 sm:px-6 md:grid-cols-[1.1fr_0.9fr] md:py-24">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-teal">A companion for hifz</p>
            <h1 className="mt-4 font-serif text-5xl leading-[1.05] sm:text-6xl">
              Memorise the Quran, one honest page at a time.
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-parchment-muted">
              Learn from your own mushaf. Hifz plans each day&apos;s sabaq, sabqi and dawr from the time you have, lets the page
              frost over as it settles in your memory, and shows you exactly what&apos;s holding and what needs you.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link href={start} className="glow-breathe flex items-center gap-2 rounded-full bg-teal px-7 py-3.5 text-sm font-semibold text-bg">
                Start memorising <ArrowRight size={16} />
              </Link>
              <span className="text-sm text-parchment-muted">Free · no account · stays on your device</span>
            </div>
          </div>
          <FrostingPage />
        </div>
      </section>

      {/* Why */}
      <section className="mx-auto max-w-[1100px] px-4 py-20 sm:px-6">
        <SectionTitle kicker="Why memorise" title="A promise that it can be done" />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {WHY_REASONS.map((r, i) => (
            <a
              key={r.title}
              href={r.href}
              target="_blank"
              rel="noreferrer"
              className={`group rounded-[24px] border border-border bg-surface p-6 transition-all hover:-translate-y-0.5 hover:border-teal/40 ${i === 0 ? "lg:col-span-2" : ""}`}
            >
              <p className="font-serif text-xl">{r.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-parchment-muted">{r.text}</p>
              <p className="mt-3 text-xs text-teal opacity-80 group-hover:opacity-100">{r.source}</p>
            </a>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-border/60 bg-surface/50">
        <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
          <HowItWorks />
        </div>
      </section>

      {/* What's different */}
      <section className="mx-auto max-w-[1100px] px-4 py-20 sm:px-6">
        <SectionTitle kicker="What makes it different" title="Built around how hifz really works" />
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {DIFFERENT.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-[24px] border border-border bg-surface p-6">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal/10 text-teal">
                <Icon size={20} />
              </span>
              <p className="mt-4 font-serif text-xl">{title}</p>
              <p className="mt-2 text-sm leading-relaxed text-parchment-muted">{text}</p>
            </div>
          ))}
          <div className="flex flex-col justify-center rounded-[24px] border border-teal/30 bg-teal/[0.06] p-6">
            <BarChart3 size={20} className="text-teal" />
            <p className="mt-4 font-serif text-xl">It tunes itself to you</p>
            <p className="mt-2 text-sm leading-relaxed text-parchment-muted">
              Week by week, your sabaq grows a little and the repetitions it needs shrink a little, but only while sabqi stays healthy.
            </p>
          </div>
        </div>
      </section>

      {/* Privacy */}
      <section className="mx-auto max-w-[1100px] px-4 pb-8 sm:px-6">
        <div className="flex flex-wrap items-center gap-5 rounded-[28px] border border-border bg-surface p-7">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-raised text-teal">
            <Lock size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-serif text-xl">Everything stays on your device</p>
            <p className="mt-1 text-sm text-parchment-muted">No account, no tracking. Export a backup any time from Settings.</p>
          </div>
        </div>
      </section>

      {/* Closing */}
      <section className="relative">
        <div className="aurora pointer-events-none absolute inset-0 opacity-70" />
        <div className="relative mx-auto max-w-[1100px] px-4 py-24 text-center sm:px-6">
          <Sparkles className="mx-auto text-teal" size={28} />
          <h2 className="mx-auto mt-4 max-w-xl font-serif text-4xl leading-tight">The best time to start was years ago. The next best is today.</h2>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link href={start} className="glow-breathe flex items-center gap-2 rounded-full bg-teal px-7 py-3.5 text-sm font-semibold text-bg">
              Start memorising <ArrowRight size={16} />
            </Link>
            <Link href="/today" className="text-sm text-parchment-muted hover:text-teal">Already started? Open the app</Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function SectionTitle({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-teal">{kicker}</p>
      <h2 className="mt-3 font-serif text-4xl leading-tight">{title}</h2>
    </div>
  );
}

/** A real mushaf page whose lines frost over one by one, then clear: the method in one picture. */
function FrostingPage() {
  const [page, setPage] = useState<PageData | null>(null);
  useEffect(() => {
    loadPage(604).then(setPage, () => {});
  }, []);
  const lines = page?.lines.filter((l) => l.words.length) ?? [];
  return (
    <div className="relative mx-auto w-fit max-w-full">
      <div className="absolute -inset-6 rounded-[40px] bg-teal/20 blur-3xl" />
      <div
        className="relative overflow-hidden rounded-[26px] border border-teal/30 bg-surface shadow-[0_30px_80px_-30px_rgb(var(--teal)/0.6)]"
        style={{ aspectRatio: page ? `${page.width} / ${page.height}` : "1076 / 2178", height: "min(74vh, 680px)", maxWidth: "100%" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- static scan */}
        <img src="/pages/604.webp" alt="A page of the mushaf: Al-Ikhlas, Al-Falaq and An-Nas" className="absolute inset-0 h-full w-full" />
        {lines.map((l, i) => (
          <div
            key={l.line}
            className="frost-loop absolute inset-x-1 rounded-xl"
            style={{ top: `${l.y0 * 100}%`, height: `${(l.y1 - l.y0) * 100}%`, animationDelay: `${i * 0.9}s` }}
          />
        ))}
      </div>
    </div>
  );
}
