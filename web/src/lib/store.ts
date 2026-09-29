"use client";

import { useCallback, useSyncExternalStore } from "react";
import { emptyProgress, type Progress } from "./progress";

// Everything lives in this browser for now; Export/Import in settings is the backup path.
const KEY = "hifz:v1";
const listeners = new Set<() => void>();
let cache: { raw: string | null; value: Progress } | null = null;
const EMPTY = emptyProgress();

function read(): Progress {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    // Storage blocked (private mode): run with in-memory progress
    return cache?.value ?? EMPTY;
  }
  if (cache && cache.raw === raw) return cache.value;
  let value = EMPTY;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Progress;
      value = { ...emptyProgress(), ...parsed, settings: { ...emptyProgress().settings, ...parsed.settings } };
    } catch {
      value = EMPTY;
    }
  }
  cache = { raw, value };
  return value;
}

export function saveProgress(next: Progress) {
  const raw = JSON.stringify(next);
  try {
    localStorage.setItem(KEY, raw);
  } catch {
    // Keep going in memory; the next export still captures it
  }
  cache = { raw, value: next };
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => e.key === KEY && cb();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function useProgress(): [Progress, (update: (p: Progress) => Progress) => void, boolean] {
  const progress = useSyncExternalStore(subscribe, read, () => EMPTY);
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  const update = useCallback((fn: (p: Progress) => Progress) => saveProgress(fn(read())), []);
  return [progress, update, hydrated];
}
