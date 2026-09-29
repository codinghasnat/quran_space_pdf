"use client";

import { useRef, useState } from "react";
import { Download, Upload, X } from "lucide-react";
import { isoDay } from "@/lib/dates";
import { emptyProgress, markMemorised, type Progress, type Settings } from "@/lib/progress";
import { saveProgress, useProgress } from "@/lib/store";

export default function SettingsPanel({ firstRun, onClose }: { firstRun: boolean; onClose: () => void }) {
  const [progress, update] = useProgress();
  const [draft, setDraft] = useState<Settings>(progress.settings);
  const [memFrom, setMemFrom] = useState("");
  const [memTo, setMemTo] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  function save() {
    update((p) => {
      let next: Progress = { ...p, settings: draft, setupDone: true };
      const a = Number(memFrom);
      const b = Number(memTo || memFrom);
      if (a >= 1 && b >= a && b <= 604) {
        next = markMemorised(next, Array.from({ length: b - a + 1 }, (_, i) => a + i), isoDay());
      }
      return next;
    });
    setMemFrom("");
    setMemTo("");
    onClose();
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(progress, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `hifz-progress-${isoDay()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importData(file: File) {
    try {
      const parsed = JSON.parse(await file.text()) as Progress;
      if (parsed.version !== 1 || !parsed.pages || !parsed.sessions) throw new Error("not a hifz export");
      saveProgress(parsed);
      setDraft(parsed.settings);
      setNote(`Imported ${parsed.sessions.length} sessions.`);
    } catch (e) {
      setNote(`Couldn't import: ${(e as Error).message}`);
    }
  }

  const field = "h-10 w-full rounded-xl border border-border bg-bg px-3 text-sm outline-none focus:border-teal";

  return (
    <section className="mt-4 rounded-3xl border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-serif text-xl">{firstRun ? "Assalamu alaikum" : "Settings"}</h2>
          {firstRun && (
            <p className="mt-1 text-sm text-parchment-muted">
              Tell me where you&apos;re starting. Everything stays in this browser.
            </p>
          )}
        </div>
        {!firstRun && (
          <button onClick={onClose} aria-label="Close settings" className="text-parchment-muted hover:text-teal">
            <X size={18} />
          </button>
        )}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs text-parchment-muted">Learning order</span>
          <select
            className={field}
            value={draft.order}
            onChange={(e) => setDraft({ ...draft, order: e.target.value as Settings["order"] })}
          >
            <option value="forward">From a page onwards (Al-Fatihah first)</option>
            <option value="backward">Juz 30 first, then 29, 28…</option>
          </select>
        </label>
        {draft.order === "forward" && (
          <label className="block">
            <span className="text-xs text-parchment-muted">Start from page</span>
            <input
              className={field}
              type="number"
              min={1}
              max={604}
              value={draft.startPage}
              onChange={(e) => setDraft({ ...draft, startPage: Math.min(604, Math.max(1, Number(e.target.value) || 1)) })}
            />
          </label>
        )}
        <label className="block">
          <span className="text-xs text-parchment-muted">Sabqi: recent pages revised daily</span>
          <input
            className={field}
            type="number"
            min={1}
            max={20}
            value={draft.sabqiSize}
            onChange={(e) => setDraft({ ...draft, sabqiSize: Math.max(1, Number(e.target.value) || 1) })}
          />
        </label>
        <label className="block">
          <span className="text-xs text-parchment-muted">Manzil: most old pages per day</span>
          <input
            className={field}
            type="number"
            min={1}
            max={40}
            value={draft.manzilPerDay}
            onChange={(e) => setDraft({ ...draft, manzilPerDay: Math.max(1, Number(e.target.value) || 1) })}
          />
        </label>
        <div className="sm:col-span-2">
          <span className="text-xs text-parchment-muted">Already memorised pages (optional, e.g. 582 to 604)</span>
          <div className="mt-0 flex items-center gap-2">
            <input className={field} type="number" min={1} max={604} placeholder="from" value={memFrom} onChange={(e) => setMemFrom(e.target.value)} />
            <span className="text-parchment-muted">to</span>
            <input className={field} type="number" min={1} max={604} placeholder="to" value={memTo} onChange={(e) => setMemTo(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button onClick={save} className="h-11 rounded-full bg-teal px-6 text-sm font-semibold text-bg">
          {firstRun ? "Start" : "Save"}
        </button>
        {!firstRun && (
          <>
            <button onClick={exportData} className="flex h-11 items-center gap-2 rounded-full border border-border px-4 text-sm text-parchment-muted hover:text-teal">
              <Download size={15} /> Export
            </button>
            <button onClick={() => fileInput.current?.click()} className="flex h-11 items-center gap-2 rounded-full border border-border px-4 text-sm text-parchment-muted hover:text-teal">
              <Upload size={15} /> Import
            </button>
            <input ref={fileInput} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])} />
            <button
              onClick={() => confirm("Delete all progress in this browser?") && saveProgress(emptyProgress())}
              className="ml-auto text-xs text-stuck/80 underline-offset-2 hover:underline"
            >
              Reset everything
            </button>
          </>
        )}
      </div>
      {note && <p className="mt-3 text-sm text-parchment-muted">{note}</p>}
    </section>
  );
}
