"use client";

import { useState } from "react";

// Small hand-rolled SVG charts: thin marks, recessive axes, hover tooltips, one axis each.

export const STAGE_COLOURS = { sabaq: "#0d9488", sabqi: "#d97706", dawr: "#6366f1" } as const; // validated light + dark

const W = 640;
const H = 200;
const PAD = { l: 40, r: 12, t: 12, b: 26 };

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return Math.ceil(v / p / (v / p > 5 ? 2 : 1)) * p * (v / p > 5 ? 2 : 1);
}

export function LineChart({
  points, format = smart, yMax, colour = "rgb(var(--teal))", empty,
}: {
  points: { x: string; y: number }[];
  format?: (v: number) => string;
  yMax?: number;
  colour?: string;
  empty: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return <Empty text={empty} />;
  const max = yMax ?? niceMax(Math.max(...points.map((p) => p.y)));
  const X = (i: number) => PAD.l + (i / (points.length - 1)) * (W - PAD.l - PAD.r);
  const Y = (v: number) => PAD.t + (1 - v / max) * (H - PAD.t - PAD.b);
  const d = points.map((p, i) => `${i ? "L" : "M"}${X(i).toFixed(1)} ${Y(p.y).toFixed(1)}`).join("");
  const ticks = [0, max / 2, max];
  const h = hover !== null ? points[hover] : null;
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible" onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={Y(t)} y2={Y(t)} className="stroke-border" strokeWidth="1" />
            <text x={PAD.l - 8} y={Y(t) + 4} textAnchor="end" fontSize="10" className="fill-parchment-muted">{format(t)}</text>
          </g>
        ))}
        <text x={PAD.l} y={H - 6} fontSize="10" className="fill-parchment-muted">{points[0].x}</text>
        <text x={W - PAD.r} y={H - 6} fontSize="10" textAnchor="end" className="fill-parchment-muted">{points.at(-1)!.x}</text>
        <path d={`${d}L${X(points.length - 1)} ${Y(0)}L${X(0)} ${Y(0)}Z`} fill={colour} opacity="0.08" />
        <path d={d} fill="none" stroke={colour} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {h && (
          <g>
            <line x1={X(hover!)} x2={X(hover!)} y1={PAD.t} y2={H - PAD.b} className="stroke-parchment-muted" strokeDasharray="3 3" />
            <circle cx={X(hover!)} cy={Y(h.y)} r="4.5" fill={colour} className="stroke-surface" strokeWidth="2" />
          </g>
        )}
        {points.map((_, i) => (
          <rect
            key={i}
            x={X(i) - (W - PAD.l - PAD.r) / (points.length - 1) / 2}
            width={(W - PAD.l - PAD.r) / (points.length - 1)}
            y={0}
            height={H}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}
      </svg>
      {h && <Tip x={X(hover!) / W}>{h.x}: <b>{format(h.y)}</b></Tip>}
    </div>
  );
}

const smart = (v: number) => (v > 0 && v < 10 ? v.toFixed(1).replace(/\.0$/, "") : String(Math.round(v)));

export function StackedBars({
  bars, series, format = smart, empty,
}: {
  bars: { x: string; values: Record<string, number> }[];
  series: { key: string; label: string; colour: string }[];
  format?: (v: number) => string;
  empty: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (!bars.some((b) => Object.values(b.values).some((v) => v > 0))) return <Empty text={empty} />;
  const totals = bars.map((b) => series.reduce((a, s) => a + (b.values[s.key] ?? 0), 0));
  const max = niceMax(Math.max(...totals));
  const slot = (W - PAD.l - PAD.r) / bars.length;
  const bw = Math.max(3, Math.min(22, slot - 3));
  const Y = (v: number) => PAD.t + (1 - v / max) * (H - PAD.t - PAD.b);
  const h = hover !== null ? bars[hover] : null;
  return (
    <div className="relative">
      <div className="mb-2 flex flex-wrap gap-4 text-xs text-parchment-muted">
        {series.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: s.colour }} /> {s.label}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" onMouseLeave={() => setHover(null)}>
        {[0, max / 2, max].map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={Y(t)} y2={Y(t)} className="stroke-border" strokeWidth="1" />
            <text x={PAD.l - 8} y={Y(t) + 4} textAnchor="end" fontSize="10" className="fill-parchment-muted">{format(t)}</text>
          </g>
        ))}
        <text x={PAD.l} y={H - 6} fontSize="10" className="fill-parchment-muted">{bars[0].x}</text>
        <text x={W - PAD.r} y={H - 6} fontSize="10" textAnchor="end" className="fill-parchment-muted">{bars.at(-1)!.x}</text>
        {bars.map((b, i) => {
          let acc = 0;
          const x = PAD.l + i * slot + (slot - bw) / 2;
          return (
            <g key={i} opacity={hover === null || hover === i ? 1 : 0.55}>
              {series.map((s) => {
                const v = b.values[s.key] ?? 0;
                if (v <= 0) return null;
                const y0 = Y(acc);
                acc += v;
                const y1 = Y(acc);
                return <rect key={s.key} x={x} y={y1} width={bw} height={Math.max(0, y0 - y1 - 2)} rx="3" fill={s.colour} />;
              })}
              <rect x={PAD.l + i * slot} width={slot} y={0} height={H} fill="transparent" onMouseEnter={() => setHover(i)} />
            </g>
          );
        })}
      </svg>
      {h && (
        <Tip x={(PAD.l + (hover! + 0.5) * slot) / W}>
          <span className="block font-medium">{h.x}</span>
          {series.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm" style={{ background: s.colour }} /> {s.label} {format(h.values[s.key] ?? 0)}
            </span>
          ))}
        </Tip>
      )}
    </div>
  );
}

function Tip({ x, children }: { x: number; children: React.ReactNode }) {
  return (
    <div
      className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-xl border border-border bg-surface px-3 py-2 text-xs shadow-lg"
      style={{ left: `${Math.min(88, Math.max(12, x * 100))}%` }}
    >
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="flex h-40 items-center justify-center rounded-2xl bg-surface-raised/60 text-sm text-parchment-muted">{text}</div>;
}
