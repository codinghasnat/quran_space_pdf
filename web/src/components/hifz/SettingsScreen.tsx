"use client";

import { useRef, useState } from "react";
import { Download, RotateCcw, Upload } from "lucide-react";
import { STATIC_RECITATIONS } from "@/lib/hifz/reciters";
import { exportData, importData, resetAll, updateSettings, useHifz } from "@/lib/hifz/store";
import type { Settings } from "@/lib/hifz/types";
import { SURAHS } from "@/lib/surahs";
import AppShell from "./AppShell";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function SettingsScreen() {
  const data = useHifz();
  const file = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  if (!data) return <AppShell><div className="mt-8 h-96 animate-pulse rounded-3xl bg-surface-raised" /></AppShell>;
  const s = data.settings;
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => updateSettings((x) => ({ ...x, [k]: v }));

  const download = () => {
    const blob = new Blob([exportData()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `hifz-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <AppShell>
      <div className="max-w-2xl pt-8">
        <h1 className="font-serif text-4xl">Settings</h1>
        <p className="mt-1 text-parchment-muted">Everything here is yours to override. The weekly check-in tunes sabaq size and repetitions for you.</p>

        <Section title="Your commitment">
          <Row label="Minutes a day" hint={`${s.dailyMinutes} min`}>
            <input type="range" min={20} max={240} step={5} value={s.dailyMinutes} onChange={(e) => set("dailyMinutes", Number(e.target.value))} className="w-56 accent-[rgb(var(--teal))]" />
          </Row>
          <Row label="Days">
            <div className="flex gap-1">
              {DAYS.map((d, i) => (
                <button
                  key={d}
                  onClick={() => set("activeDays", s.activeDays.includes(i) ? s.activeDays.filter((x) => x !== i) : [...s.activeDays, i].sort())}
                  className={`h-8 w-11 rounded-full text-xs ${s.activeDays.includes(i) ? "bg-teal text-bg" : "bg-surface-raised text-parchment-muted"}`}
                >
                  {d}
                </button>
              ))}
            </div>
          </Row>
          <Row label="Sabaq time">
            <input value={s.sabaqTime} onChange={(e) => set("sabaqTime", e.target.value)} className="h-9 w-56 rounded-xl border border-border bg-bg px-3 text-sm" />
          </Row>
        </Section>

        <Section title="Path">
          <Row label="Direction">
            <select value={s.direction} onChange={(e) => set("direction", e.target.value as Settings["direction"])} className="h-9 rounded-xl border border-border bg-bg px-3 text-sm">
              <option value="backward">Juz &apos;Amma backwards</option>
              <option value="forward">Al-Baqarah forwards</option>
            </select>
          </Row>
          <Row label="Next sabaq starts from" hint={s.start ? `page ${s.start.page}, line ${s.start.line}` : "the start of the path"}>
            <span />
          </Row>
        </Section>

        <Section title="Sabaq">
          <Row label="Lines per sabaq" hint={`${s.sabaqLines} lines`}>
            <Stepper value={s.sabaqLines} min={2} max={30} onChange={(v) => set("sabaqLines", v)} />
          </Row>
          <Row label="Clean covered repetitions" hint="before eyes closed">
            <Stepper value={s.coveredReps} min={1} max={60} onChange={(v) => set("coveredReps", v)} />
          </Row>
          <Row label="Clean eyes-closed rounds" hint="to settle the sabaq">
            <Stepper value={s.eyesClosedReps} min={1} max={60} onChange={(v) => set("eyesClosedReps", v)} />
          </Row>
          <Row label="Reciter">
            <select value={s.reciter} onChange={(e) => set("reciter", e.target.value)} className="h-9 w-56 rounded-xl border border-border bg-bg px-3 text-sm">
              {STATIC_RECITATIONS.map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
          </Row>
        </Section>

        <Section title="Dawr">
          <Row label="Pages per chunk" hint="to spread through the day">
            <Stepper value={s.dawrChunkPages} min={1} max={10} onChange={(v) => set("dawrChunkPages", v)} />
          </Row>
        </Section>

        {Object.keys(data.profile.claims).length > 0 && (
          <Section title="Known at the start">
            <p className="text-sm text-parchment-muted">
              {Object.entries(data.profile.claims).map(([id, c]) => `${SURAHS[Number(id) - 1]?.name} (${c})`).join(", ")}
            </p>
          </Section>
        )}

        <Section title="Your data">
          <p className="text-sm text-parchment-muted">Everything stays on this device. Back it up, or move it to another browser.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={download} className="flex h-10 items-center gap-2 rounded-full bg-teal px-4 text-sm font-semibold text-bg"><Download size={15} /> Export backup</button>
            <button onClick={() => file.current?.click()} className="flex h-10 items-center gap-2 rounded-full border border-border px-4 text-sm"><Upload size={15} /> Import</button>
            <button
              onClick={() => confirm("Erase all progress on this device? Export a backup first if you might want it.") && resetAll()}
              className="flex h-10 items-center gap-2 rounded-full px-4 text-sm text-stuck hover:bg-stuck/10"
            >
              <RotateCcw size={15} /> Start over
            </button>
            <input
              ref={file}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  importData(await f.text());
                  setMsg("Imported.");
                } catch (err) {
                  setMsg((err as Error).message);
                }
              }}
            />
          </div>
          {msg && <p className="mt-2 text-sm text-teal">{msg}</p>}
          <p className="mt-3 text-xs text-parchment-muted">
            {data.recitations.length} recitations · {data.wordEvents.length} word events · {data.sabaqs.length} sabaqs
            {data.flaggedLines.length ? ` · ${data.flaggedLines.length} lines flagged for cover fixes` : ""}
          </p>
        </Section>
      </div>
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 rounded-[24px] border border-border bg-surface p-5">
      <h2 className="mb-3 font-serif text-xl">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-sm">{label}</p>
        {hint && <p className="text-xs text-parchment-muted">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function Stepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-full bg-surface-raised p-1">
      <button onClick={() => onChange(Math.max(min, value - 1))} className="h-7 w-7 rounded-full hover:bg-surface">−</button>
      <span className="min-w-[36px] text-center tabular-nums">{value}</span>
      <button onClick={() => onChange(Math.min(max, value + 1))} className="h-7 w-7 rounded-full hover:bg-surface">+</button>
    </div>
  );
}
