"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, Check, Headphones, Layers, RefreshCw, Sparkles, Sprout } from "lucide-react";
import { WHY_REASONS } from "@/lib/hifz/content";
import { updateProfile, updateSettings, useHifz } from "@/lib/hifz/store";
import type { Claim, Direction } from "@/lib/hifz/types";
import { useQuranIndex } from "@/lib/hifz/useJourney";
import { SURAHS } from "@/lib/surahs";

const STEPS = ["why", "how", "direction", "known", "time", "ready"] as const;
type Step = (typeof STEPS)[number];
const DAYS = ["S", "M", "T", "W", "T", "F", "S"];
const CLAIM_CYCLE: (Claim | null)[] = [null, "solid", "rusty", "forgotten"];
const CLAIM_STYLE: Record<Claim, string> = {
  solid: "bg-heat-strong text-bg border-heat-strong",
  rusty: "bg-heat-weak text-parchment border-heat-weak",
  forgotten: "bg-heat-weak/40 text-parchment border-heat-weak/60",
};

export default function Onboarding() {
  const router = useRouter();
  const data = useHifz();
  const index = useQuranIndex();
  const [step, setStep] = useState<Step>("why");
  const [why, setWhy] = useState<number | null>(null);
  const [direction, setDirection] = useState<Direction>("backward");
  const [startSurah, setStartSurah] = useState<number | null>(null);
  const [claims, setClaims] = useState<Record<number, Claim>>({});
  const [upTo, setUpTo] = useState<Record<number, number>>({});
  const [partSurah, setPartSurah] = useState(2);
  const [partAyah, setPartAyah] = useState(25);
  const [minutes, setMinutes] = useState(90);
  const [days, setDays] = useState([0, 1, 2, 3, 4, 5, 6]);
  const [sabaqTime, setSabaqTime] = useState("After Fajr");
  const [sabaqLines, setSabaqLines] = useState(7);
  const [showAll, setShowAll] = useState(false);
  const finishing = useRef(false);

  // Already set up (e.g. a returning visitor): go to Today, unless we just finished and are heading to the sabaq
  useEffect(() => {
    if (data?.profile.onboarded && !finishing.current) router.replace("/today");
  }, [data, router]);

  const i = STEPS.indexOf(step);
  const ayahCount = (surah: number) => index?.bySurah.get(surah)?.at(-1)?.a2 ?? 286;
  const go = (d: number) => setStep(STEPS[Math.max(0, Math.min(STEPS.length - 1, i + d))]);

  const surahOrder = useMemo(() => {
    const ids = SURAHS.map((s) => s.id);
    return direction === "backward" ? [...ids].reverse() : ids;
  }, [direction]);
  const visibleSurahs = showAll ? surahOrder : surahOrder.slice(0, direction === "backward" ? 37 : 10);

  // Rough pages-a-month for the commitment slider: sabqi takes ~35 min, the rest goes to sabaq at ~6.5 min a line
  const pagesPerMonth = useMemo(() => {
    const lines = Math.max(0, Math.min(sabaqLines, (minutes - 35) / 6.5));
    return Math.round(((lines * 26) / 15) * (days.length / 7) * 10) / 10;
  }, [minutes, sabaqLines, days]);

  const finish = () => {
    if (!index) return;
    finishing.current = true;
    // Part-way through one surah and no other starting point chosen: carry on from there
    const partial = Object.keys(upTo).map(Number);
    const from = startSurah ?? (partial.length === 1 ? partial[0] : null);
    const start = from ? index.bySurah.get(from)?.[0] ?? null : null;
    updateSettings((s) => ({
      ...s,
      direction,
      start: start ? { page: start.page, line: start.line } : null,
      dailyMinutes: minutes,
      activeDays: days,
      sabaqTime,
      sabaqLines,
    }));
    updateProfile((p) => ({ ...p, why, claims, claimUpTo: upTo, onboarded: true, introSeen: true }));
    router.push("/session/sabaq");
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="aurora pointer-events-none absolute inset-0 opacity-60" />
      <div className="relative mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-10">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal font-quran text-lg text-bg glow-soft">ح</span>
          <div className="flex flex-1 gap-1.5">
            {STEPS.map((s, j) => (
              <span key={s} className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${j <= i ? "bg-teal" : "bg-border"}`} />
            ))}
          </div>
        </div>

        <div key={step} className="pop-in flex flex-1 flex-col justify-center py-10">
          {step === "why" && (
            <>
              <Title kicker="Before we begin" title="Why memorise?" text="Pick the one that moves you most. It will be there on hard days." />
              <div className="mt-8 grid gap-3">
                {WHY_REASONS.map((r, j) => (
                  <button
                    key={r.title}
                    onClick={() => setWhy(j)}
                    className={`rounded-[22px] border p-5 text-left transition-all ${
                      why === j ? "border-teal bg-teal/[0.07] glow-soft" : "border-border bg-surface/80 hover:border-teal/40"
                    }`}
                  >
                    <p className="flex items-center justify-between font-serif text-lg">
                      {r.title} {why === j && <Check size={18} className="text-teal" />}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-parchment-muted">{r.text}</p>
                    <p className="mt-2 text-xs text-teal/80">{r.source}</p>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === "how" && <HowItWorks />}

          {step === "direction" && (
            <>
              <Title kicker="Your path" title="Where do you start?" text="Most people begin with Juz 'Amma, from An-Nas backwards, each surah read forwards." />
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                <Choice active={direction === "backward"} onClick={() => setDirection("backward")} title="Juz 'Amma backwards" text="An-Nas, Al-Falaq, Al-Ikhlas… short surahs first." badge="Recommended" />
                <Choice active={direction === "forward"} onClick={() => setDirection("forward")} title="Al-Baqarah forwards" text="The mushaf in order, from the beginning." />
              </div>
              <label className="mt-6 block text-sm text-parchment-muted">
                Starting somewhere else? Pick the surah your next sabaq begins at
                <select
                  value={startSurah ?? ""}
                  onChange={(e) => setStartSurah(e.target.value ? Number(e.target.value) : null)}
                  className="mt-2 block h-11 w-full rounded-2xl border border-border bg-surface px-4 text-parchment"
                >
                  <option value="">The start of the path</option>
                  {surahOrder.map((id) => (
                    <option key={id} value={id}>{id}. {SURAHS[id - 1].name}</option>
                  ))}
                </select>
              </label>
            </>
          )}

          {step === "known" && (
            <>
              <Title
                kicker="What you carry already"
                title="Which surahs do you know?"
                text="Tap a surah to mark it solid, tap again for rusty, again for mostly forgotten. Short tests in the next two weeks will confirm it, so a rough guess is fine."
              />
              <div className="mt-6 flex flex-wrap gap-2">
                {visibleSurahs.map((id) => {
                  const c = claims[id];
                  return (
                    <button
                      key={id}
                      onClick={() =>
                        setClaims((prev) => {
                          const next = CLAIM_CYCLE[(CLAIM_CYCLE.indexOf(prev[id] ?? null) + 1) % CLAIM_CYCLE.length];
                          const out = { ...prev };
                          if (next) out[id] = next;
                          else {
                            delete out[id];
                            setUpTo(({ [id]: _, ...rest }) => rest);
                          }
                          return out;
                        })
                      }
                      className={`flex h-10 items-center gap-2 rounded-full border px-3.5 text-sm transition-all ${
                        c ? CLAIM_STYLE[c] : "border-border bg-surface/80 hover:border-teal/40"
                      }`}
                    >
                      <span className="text-xs opacity-70">{id}</span> {SURAHS[id - 1].name}
                      {upTo[id] && <span className="text-[10px] opacity-80">1–{upTo[id]}</span>}
                      {c && <span className="text-[10px] uppercase tracking-wide opacity-80">{c === "forgotten" ? "faded" : c}</span>}
                    </button>
                  );
                })}
                {!showAll && (
                  <button onClick={() => setShowAll(true)} className="h-10 rounded-full px-3.5 text-sm text-teal hover:underline">
                    Show all 114
                  </button>
                )}
              </div>
              <div className="mt-6 rounded-[22px] border border-border bg-surface/80 p-4">
                <p className="text-sm font-medium">Know part of a surah?</p>
                <p className="text-xs text-parchment-muted">Your sabaq will carry on right after it.</p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                  <select value={partSurah} onChange={(e) => setPartSurah(Number(e.target.value))} className="h-10 rounded-xl border border-border bg-bg px-3">
                    {SURAHS.map((s) => (
                      <option key={s.id} value={s.id}>{s.id}. {s.name}</option>
                    ))}
                  </select>
                  <span className="text-parchment-muted">from ayah 1 up to ayah</span>
                  <input
                    type="number"
                    min={1}
                    max={ayahCount(partSurah)}
                    value={partAyah}
                    onChange={(e) => setPartAyah(Math.max(1, Math.min(ayahCount(partSurah), Number(e.target.value) || 1)))}
                    className="h-10 w-20 rounded-xl border border-border bg-bg px-3"
                  />
                  <button
                    onClick={() => {
                      const full = partAyah >= ayahCount(partSurah);
                      setClaims((c) => ({ ...c, [partSurah]: c[partSurah] ?? "solid" }));
                      setUpTo(({ [partSurah]: _, ...rest }) => (full ? rest : { ...rest, [partSurah]: partAyah }));
                      if (!visibleSurahs.includes(partSurah)) setShowAll(true);
                    }}
                    className="h-10 rounded-full bg-teal px-4 font-semibold text-bg"
                  >
                    Add
                  </button>
                </div>
                {Object.keys(upTo).length === 1 && startSurah === null && (
                  <p className="mt-2 text-xs text-teal">
                    Your next sabaq will carry on in {SURAHS[Number(Object.keys(upTo)[0]) - 1]?.name} from ayah {Object.values(upTo)[0] + 1}.
                  </p>
                )}
              </div>
              <button onClick={() => (setClaims({}), setUpTo({}), go(1))} className="mt-6 flex items-center gap-2 self-start text-sm text-parchment-muted hover:text-teal">
                <Sprout size={16} /> I&apos;m starting fresh
              </button>
            </>
          )}

          {step === "time" && (
            <>
              <Title kicker="Your commitment" title="How much time can you give each day?" text="Be realistic; consistency matters more than size. You can change it any day." />
              <div className="mt-8 rounded-[24px] border border-border bg-surface/80 p-6">
                <div className="flex items-baseline justify-between">
                  <span className="font-serif text-5xl tabular-nums">{minutes}<span className="ml-1 text-xl text-parchment-muted">min</span></span>
                  <span className="text-sm text-teal">≈ {pagesPerMonth} new pages a month</span>
                </div>
                <input type="range" min={20} max={240} step={5} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="mt-4 w-full accent-[rgb(var(--teal))]" />
                <div className="mt-6 flex items-center gap-3">
                  <CalendarDays size={16} className="text-parchment-muted" />
                  {DAYS.map((d, j) => (
                    <button
                      key={j}
                      onClick={() => setDays((ds) => (ds.includes(j) ? ds.filter((x) => x !== j) : [...ds, j].sort()))}
                      className={`h-9 w-9 rounded-full text-sm transition-colors ${days.includes(j) ? "bg-teal text-bg" : "bg-surface-raised text-parchment-muted"}`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <label className="text-sm text-parchment-muted">
                    Sabaq time
                    <input value={sabaqTime} onChange={(e) => setSabaqTime(e.target.value)} className="mt-1.5 block h-10 w-full rounded-xl border border-border bg-bg px-3 text-parchment" />
                  </label>
                  <label className="text-sm text-parchment-muted">
                    Starting sabaq size: {sabaqLines} lines
                    <input type="range" min={2} max={15} value={sabaqLines} onChange={(e) => setSabaqLines(Number(e.target.value))} className="mt-3 block w-full accent-[rgb(var(--teal))]" />
                  </label>
                </div>
              </div>
            </>
          )}

          {step === "ready" && (
            <div className="text-center">
              <span className="pop-in mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-teal text-bg glow-breathe">
                <Sparkles size={32} />
              </span>
              <h1 className="mt-6 font-serif text-4xl">Bismillah.</h1>
              <p className="mx-auto mt-3 max-w-md text-parchment-muted">
                Your first sabaq is ready: listen, read, let it frost over, then recite it from memory. Your first clean recitation is day one of your streak.
              </p>
              {why !== null && <p className="mx-auto mt-6 max-w-md font-serif text-lg leading-snug">{WHY_REASONS[why].text}</p>}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <button onClick={() => go(-1)} disabled={i === 0} className="flex h-11 items-center gap-2 rounded-full px-4 text-sm text-parchment-muted hover:text-parchment disabled:opacity-0">
            <ArrowLeft size={16} /> Back
          </button>
          {step === "ready" ? (
            <button onClick={finish} disabled={!index} className="glow-breathe flex h-12 items-center gap-2 rounded-full bg-teal px-7 text-sm font-semibold text-bg">
              Begin my first sabaq <ArrowRight size={16} />
            </button>
          ) : (
            <button
              onClick={() => go(1)}
              disabled={step === "why" && why === null}
              className="flex h-12 items-center gap-2 rounded-full bg-teal px-7 text-sm font-semibold text-bg transition-opacity disabled:opacity-40"
            >
              {step === "how" ? "Got it" : "Continue"} <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Title({ kicker, title, text }: { kicker: string; title: string; text: string }) {
  return (
    <>
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-teal">{kicker}</p>
      <h1 className="mt-2 font-serif text-4xl leading-tight">{title}</h1>
      <p className="mt-3 max-w-xl leading-relaxed text-parchment-muted">{text}</p>
    </>
  );
}

function Choice({ active, onClick, title, text, badge }: { active: boolean; onClick: () => void; title: string; text: string; badge?: string }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-[22px] border p-5 text-left transition-all ${active ? "border-teal bg-teal/[0.07] glow-soft" : "border-border bg-surface/80 hover:border-teal/40"}`}
    >
      <p className="flex items-center justify-between font-serif text-xl">
        {title} {badge && <span className="rounded-full bg-teal/15 px-2 py-0.5 font-sans text-[10px] font-medium text-teal">{badge}</span>}
      </p>
      <p className="mt-1 text-sm text-parchment-muted">{text}</p>
    </button>
  );
}

const SCENES = [
  { icon: CalendarDays, title: "A plan from your time", text: "Tell it how many minutes you have. It splits them between sabaq, sabqi and dawr." },
  { icon: Headphones, title: "Listen, then read", text: "Hear the reciter on a loop, then read along on your own mushaf page." },
  { icon: Sparkles, title: "Let it frost over", text: "Each clean read frosts the line a little more, until you recite through the glass." },
  { icon: BookOpen, title: "Recite it covered, then eyes closed", text: "Check each line after you say it. Peeking doesn't count. Then do it with your eyes closed." },
  { icon: RefreshCw, title: "Lock it in with sabqi", text: "Recent sabaqs are recited every day until they hold. This is where hifz is won." },
  { icon: Layers, title: "Keep it fresh with dawr", text: "Older pages rotate through, weakest first, and your heatmap fills in green." },
];

function HowItWorks() {
  const [scene, setScene] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setScene((s) => (s + 1) % SCENES.length), 4200);
    return () => clearInterval(t);
  }, []);
  const S = SCENES[scene];
  return (
    <>
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-teal">How it works</p>
      <h1 className="mt-2 font-serif text-4xl">One day of hifz</h1>
      <div className="mt-8 overflow-hidden rounded-[28px] border border-teal/20 bg-surface/80 p-8">
        <div key={scene} className="pop-in flex items-start gap-5">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-teal text-bg glow-breathe">
            <S.icon size={28} />
          </span>
          <div>
            <p className="text-xs text-parchment-muted">{scene + 1} of {SCENES.length}</p>
            <p className="font-serif text-2xl">{S.title}</p>
            <p className="mt-2 leading-relaxed text-parchment-muted">{S.text}</p>
          </div>
        </div>
        <div className="mt-8 flex gap-1.5">
          {SCENES.map((_, j) => (
            <button key={j} onClick={() => setScene(j)} aria-label={`Scene ${j + 1}`} className={`h-1.5 flex-1 rounded-full transition-colors ${j === scene ? "bg-teal" : "bg-border"}`} />
          ))}
        </div>
      </div>
    </>
  );
}
