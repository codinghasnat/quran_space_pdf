"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadPage } from "../data";
import type { PageData } from "../types";

/** Active seconds for a session: pauses on request and while the tab is hidden. */
export function useStageTimer() {
  const [seconds, setSeconds] = useState(0);
  const [paused, setPaused] = useState(false);
  const total = useRef(0);
  const lap = useRef(0);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      total.current += 1;
      setSeconds(total.current);
    }, 1000);
    return () => clearInterval(t);
  }, [paused]);

  /** Seconds since the last lap (one recitation), then start a new lap. */
  const takeLap = useCallback(() => {
    const s = total.current - lap.current;
    lap.current = total.current;
    return s;
  }, []);

  return { seconds, paused, toggle: () => setPaused((p) => !p), setPaused, takeLap };
}

export function formatClock(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
}

/** Load a set of page JSONs; null until all are in. */
export function usePages(pages: number[]): { pages: PageData[] | null; error: string | null } {
  const [state, setState] = useState<{ pages: PageData[] | null; error: string | null }>({ pages: null, error: null });
  const key = pages.join(",");
  useEffect(() => {
    let live = true;
    setState({ pages: null, error: null });
    Promise.all(pages.map(loadPage)).then(
      (p) => live && setState({ pages: p, error: null }),
      (e: Error) => live && setState({ pages: null, error: e.message }),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}

/** Keyboard shortcuts while a handler is mounted; ignores typing in inputs. */
export function useKeys(handler: (e: KeyboardEvent) => void) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select") || e.metaKey || e.ctrlKey || e.altKey) return;
      ref.current(e);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
}
