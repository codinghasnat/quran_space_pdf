"use client";

import Link from "next/link";
import { JUZ_STARTS, TOTAL_PAGES, type PageProgress } from "@/lib/progress";
import type { PageIndexEntry } from "@/lib/types";

/** All 604 pages, one row per juz, coloured by how well each page is held. */
export default function PageMap({
  progress, built, today,
}: {
  progress: Record<number, PageProgress>;
  built: Map<number, PageIndexEntry>;
  today: string;
}) {
  return (
    <div className="mt-3 rounded-2xl border border-border bg-surface p-3">
      <div className="space-y-1">
        {JUZ_STARTS.map((start, j) => {
          const end = j + 1 < JUZ_STARTS.length ? JUZ_STARTS[j + 1] - 1 : TOTAL_PAGES;
          const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);
          return (
            <div key={j} className="flex items-center gap-2">
              <span className="w-6 shrink-0 text-right text-[10px] tabular-nums text-parchment-muted/70">{j + 1}</span>
              <div className="flex flex-1 flex-wrap gap-[3px]">
                {pages.map((p) => (
                  <Cell key={p} page={p} state={progress[p]} built={built.has(p)} today={today} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-3 text-[11px] text-parchment-muted">
        <Legend className="bg-teal" label="Memorised" />
        <Legend className="bg-teal/40" label="Learning" />
        <Legend className="bg-stuck/60" label="Shaky" />
        <Legend className="bg-surface-raised ring-1 ring-hint" label="Due" />
        <Legend className="bg-surface-raised" label="Not started" />
      </div>
    </div>
  );
}

function Cell({ page, state, built, today }: { page: number; state?: PageProgress; built: boolean; today: string }) {
  const colour = !state
    ? built
      ? "bg-surface-raised hover:bg-teal/20"
      : "bg-surface-raised/40"
    : state.lastGrade < 3
      ? "bg-stuck/60"
      : state.status === "memorised"
        ? "bg-teal"
        : "bg-teal/40";
  const due = state && state.due <= today ? "ring-1 ring-hint" : "";
  const title = `Page ${page}${state ? ` · ${state.status} · last ${state.lastGrade}/5` : built ? "" : " · not built yet"}`;
  const cls = `block h-3 w-3 rounded-[3px] sm:h-3.5 sm:w-3.5 ${colour} ${due}`;
  return built ? <Link href={`/practice/${page}?kind=free`} title={title} className={cls} /> : <span title={title} className={cls} />;
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-[3px] ${className}`} />
      {label}
    </span>
  );
}
