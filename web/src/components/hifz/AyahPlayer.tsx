"use client";

import { useEffect, useState } from "react";
import { Pause, Play, Repeat, Repeat1, SkipBack, SkipForward, SlidersHorizontal } from "lucide-react";
import { STATIC_RECITATIONS, type ReciterOption } from "@/lib/hifz/reciters";
import { useAyahPlayer, DEFAULT_PLAYER, type PlayerOptions } from "@/lib/hifz/useAyahPlayer";

const OPTIONS_KEY = "hifz:player";

function loadOptions(): PlayerOptions {
  try {
    const raw = localStorage.getItem(OPTIONS_KEY);
    if (raw) {
      const o = JSON.parse(raw);
      return {
        ...DEFAULT_PLAYER,
        ...o,
        ayahRepeat: o.ayahRepeat === null ? Infinity : o.ayahRepeat ?? DEFAULT_PLAYER.ayahRepeat,
        rangeRepeat: o.rangeRepeat === null ? Infinity : o.rangeRepeat ?? DEFAULT_PLAYER.rangeRepeat,
      };
    }
  } catch {}
  return DEFAULT_PLAYER;
}

const fmtRepeat = (n: number) => (n === Infinity ? "∞" : `${n}×`);

/** A compact player for the ayahs being learned, with loops, pauses and reciter choice. */
export default function AyahPlayer({
  ayahs, reciter, onReciter, autoPlay = false,
}: {
  ayahs: string[];
  reciter: string;
  onReciter: (key: string) => void;
  autoPlay?: boolean;
}) {
  const [options, setOptions] = useState<PlayerOptions>(DEFAULT_PLAYER);
  const [open, setOpen] = useState(false);
  const [reciters, setReciters] = useState<ReciterOption[]>(STATIC_RECITATIONS);
  const { state, play, pause, go, current } = useAyahPlayer(ayahs, reciter, options);

  useEffect(() => setOptions(loadOptions()), []);
  useEffect(() => {
    try {
      localStorage.setItem(OPTIONS_KEY, JSON.stringify(options)); // Infinity serialises as null
    } catch {}
  }, [options]);
  useEffect(() => {
    fetch("/api/audio/recitations")
      .then((r) => r.json())
      .then((d: { recitations: ReciterOption[] }) => d.recitations?.length && setReciters(d.recitations))
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!autoPlay) return;
    const t = setTimeout(() => play(0), 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay, ayahs.join(",")]);

  const set = <K extends keyof PlayerOptions>(k: K, v: PlayerOptions[K]) => setOptions((o) => ({ ...o, [k]: v }));
  const label = reciters.find((r) => r.id === reciter)?.label ?? "Reciter";

  return (
    <div className="rounded-3xl border border-border bg-surface/90 p-3 shadow-[0_10px_40px_-18px_rgb(var(--teal)/0.45)] backdrop-blur">
      <div className="flex items-center gap-2">
        <button onClick={() => go(-1)} aria-label="Previous ayah" className="flex h-9 w-9 items-center justify-center rounded-full text-parchment-muted hover:text-teal">
          <SkipBack size={16} />
        </button>
        <button
          onClick={() => (state.playing ? pause() : play())}
          aria-label={state.playing ? "Pause" : "Play"}
          className={`flex h-12 w-12 items-center justify-center rounded-full bg-teal text-bg transition-transform active:scale-95 ${state.playing ? "glow-breathe" : "glow-soft"}`}
        >
          {state.playing ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
        </button>
        <button onClick={() => go(1)} aria-label="Next ayah" className="flex h-9 w-9 items-center justify-center rounded-full text-parchment-muted hover:text-teal">
          <SkipForward size={16} />
        </button>
        <div className="min-w-0 flex-1 px-2">
          <p className="truncate text-sm font-medium">
            Ayah {current ?? "–"}
            <span className="ml-2 text-xs font-normal text-parchment-muted">
              {state.index + 1} of {ayahs.length}
            </span>
          </p>
          <p className="truncate text-xs text-parchment-muted">
            {state.error ??
              (state.waiting
                ? options.gap === "echo" ? "Your turn: recite it back" : "Pause…"
                : `${label} · ayah ${fmtRepeat(options.ayahRepeat)} · range ${fmtRepeat(options.rangeRepeat)}`)}
          </p>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label="Player options"
          className={`flex h-9 w-9 items-center justify-center rounded-full border border-border transition-colors ${open ? "bg-teal text-bg" : "text-parchment-muted hover:text-teal"}`}
        >
          <SlidersHorizontal size={15} />
        </button>
      </div>

      {open && (
        <div className="mt-3 grid gap-3 border-t border-border pt-3 text-xs sm:grid-cols-2">
          <Choice icon={<Repeat1 size={13} />} label="Repeat each ayah" value={options.ayahRepeat} values={[1, 2, 3, 5, 10, Infinity]} format={fmtRepeat} onPick={(v) => set("ayahRepeat", v)} />
          <Choice icon={<Repeat size={13} />} label="Repeat the range" value={options.rangeRepeat} values={[1, 2, 3, 5, 10, Infinity]} format={fmtRepeat} onPick={(v) => set("rangeRepeat", v)} />
          <Choice
            label="Pause between"
            value={options.gap}
            values={[0, 1, 2, 4, "echo"] as (number | "echo")[]}
            format={(v) => (v === "echo" ? "Recite back" : `${v}s`)}
            onPick={(v) => set("gap", v)}
          />
          <Choice label="Speed" value={options.speed} values={[0.75, 0.9, 1, 1.15, 1.3]} format={(v) => `${v}×`} onPick={(v) => set("speed", v)} />
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-parchment-muted">Reciter</span>
            <select
              value={reciter}
              onChange={(e) => onReciter(e.target.value)}
              className="h-9 rounded-xl border border-border bg-bg px-3 text-sm text-parchment outline-none focus:border-teal"
            >
              {reciters.map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
          </label>
        </div>
      )}
    </div>
  );
}

function Choice<T extends number | string>({
  label, value, values, format, onPick, icon,
}: {
  label: string;
  value: T;
  values: T[];
  format: (v: T) => string;
  onPick: (v: T) => void;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-center gap-1.5 text-parchment-muted">{icon}{label}</span>
      <div className="flex flex-wrap gap-1">
        {values.map((v) => (
          <button
            key={String(v)}
            onClick={() => onPick(v)}
            className={`h-7 rounded-full px-2.5 transition-colors ${v === value ? "bg-teal text-bg" : "bg-parchment-muted/10 text-parchment-muted hover:text-parchment"}`}
          >
            {format(v)}
          </button>
        ))}
      </div>
    </div>
  );
}
