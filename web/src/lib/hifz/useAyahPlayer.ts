"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// A looping ayah player: play a range of ayahs, repeat each ayah n times, repeat the whole range n times, with a
// pause between repeats (fixed seconds, or as long as the ayah itself so you can recite it back).

export type PlayerOptions = {
  ayahRepeat: number; // Infinity loops one ayah
  rangeRepeat: number; // Infinity loops the range
  gap: number | "echo"; // seconds between repeats, or "echo" = the length of the ayah
  speed: number;
};

export const DEFAULT_PLAYER: PlayerOptions = { ayahRepeat: 3, rangeRepeat: 1, gap: 1, speed: 1 };

const urlCache = new Map<string, Promise<Record<string, string>>>();

function surahUrls(surah: number, reciter: string): Promise<Record<string, string>> {
  const key = `${reciter}:${surah}`;
  let p = urlCache.get(key);
  if (!p) {
    p = fetch(`/api/audio/verses/${surah}?recitation_key=${encodeURIComponent(reciter)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("audio lookup failed"))))
      .then((d: { audioByVerseKey: Record<string, string> }) => d.audioByVerseKey);
    p.catch(() => urlCache.delete(key));
    urlCache.set(key, p);
  }
  return p;
}

export type PlayerState = {
  playing: boolean;
  index: number; // ayah within the range
  ayahPass: number; // 1-based
  rangePass: number;
  error: string | null;
  waiting: boolean; // in the pause between repeats
};

export function useAyahPlayer(ayahs: string[], reciter: string, options: PlayerOptions) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const urls = useRef<Promise<Record<string, string>>>(Promise.resolve({}));
  const opts = useRef(options);
  opts.current = options;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [state, setState] = useState<PlayerState>({ playing: false, index: 0, ayahPass: 1, rangePass: 1, error: null, waiting: false });
  const st = useRef(state);
  st.current = state;
  const ayahKey = ayahs.join(",");

  // Resolve the URLs for every surah in the range
  useEffect(() => {
    let live = true;
    const surahs = [...new Set(ayahs.map((k) => Number(k.split(":")[0])))];
    urls.current = Promise.all(surahs.map((s) => surahUrls(s, reciter))).then((maps) => Object.assign({}, ...maps));
    urls.current.catch(() => live && setState((s) => ({ ...s, error: "Couldn't load the recitation. Check your connection." })));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ayahKey, reciter]);

  const playAt = useCallback(
    async (index: number) => {
      const key = ayahs[index];
      const url = (await urls.current.catch(() => ({}) as Record<string, string>))[key];
      if (!url) {
        setState((s) => ({ ...s, playing: false }));
        return;
      }
      audio.current ??= new Audio();
      const a = audio.current;
      if (a.src !== url) a.src = url;
      a.currentTime = 0;
      a.playbackRate = opts.current.speed;
      a.play().catch(() => setState((s) => ({ ...s, playing: false })));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ayahKey],
  );

  // Step through repeats when an ayah ends
  useEffect(() => {
    audio.current ??= new Audio();
    const a = audio.current;
    const onEnded = () => {
      const s = st.current;
      const o = opts.current;
      let { index, ayahPass, rangePass } = s;
      if (ayahPass < o.ayahRepeat) ayahPass++;
      else {
        ayahPass = 1;
        if (index + 1 < ayahs.length) index++;
        else if (rangePass < o.rangeRepeat) {
          index = 0;
          rangePass++;
        } else {
          setState({ ...s, playing: false, index: 0, ayahPass: 1, rangePass: 1, waiting: false });
          return;
        }
      }
      const pause = o.gap === "echo" ? a.duration / o.speed : o.gap;
      setState({ ...s, index, ayahPass, rangePass, waiting: pause > 0 });
      timer.current = setTimeout(() => {
        setState((x) => ({ ...x, waiting: false }));
        playAt(index);
      }, Math.max(0, pause) * 1000);
    };
    a.addEventListener("ended", onEnded);
    return () => a.removeEventListener("ended", onEnded);
  }, [ayahs, playAt]);

  useEffect(
    () => () => {
      audio.current?.pause();
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  // A new range (another sabaq) starts from the top
  useEffect(() => {
    audio.current?.pause();
    if (timer.current) clearTimeout(timer.current);
    setState({ playing: false, index: 0, ayahPass: 1, rangePass: 1, error: null, waiting: false });
  }, [ayahKey]);

  useEffect(() => {
    if (audio.current) audio.current.playbackRate = options.speed;
  }, [options.speed]);

  const play = useCallback(
    (index = st.current.index) => {
      if (timer.current) clearTimeout(timer.current);
      setState((s) => ({ ...s, playing: true, index, error: null, waiting: false, ...(index !== s.index ? { ayahPass: 1 } : {}) }));
      playAt(index);
    },
    [playAt],
  );

  const pause = useCallback(() => {
    audio.current?.pause();
    if (timer.current) clearTimeout(timer.current);
    setState((s) => ({ ...s, playing: false, waiting: false }));
  }, []);

  const go = useCallback(
    (delta: number) => {
      const index = Math.max(0, Math.min(ayahs.length - 1, st.current.index + delta));
      if (st.current.playing) play(index);
      else setState((s) => ({ ...s, index, ayahPass: 1 }));
    },
    [ayahs.length, play],
  );

  return { state, play, pause, go, current: ayahs[state.index] ?? null };
}

/** The ayahs touched by a set of lines, in order: "surah:ayah". */
export function ayahsOfLines(lines: { surah: number; a1: number; a2: number }[]): string[] {
  const out: string[] = [];
  for (const l of lines) for (let a = l.a1; a <= l.a2; a++) if (!out.includes(`${l.surah}:${a}`)) out.push(`${l.surah}:${a}`);
  return out;
}
