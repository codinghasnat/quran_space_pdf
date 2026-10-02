"use client";

import { useSyncExternalStore } from "react";
import { isoDay } from "../dates";
import { emptyData, DEFAULT_SETTINGS, type HifzData, type Profile, type Settings } from "./types";

// Everything stays on this device in IndexedDB: one store per event collection, appended to as you go, plus a
// meta store for profile and settings. The whole history is loaded into memory once at start-up.

const DB_NAME = "hifz";
const DB_VERSION = 1;
const COLLECTIONS = ["recitations", "wordEvents", "sabaqs", "sessions", "tuning", "flaggedLines"] as const;
type Collection = (typeof COLLECTIONS)[number];
type Item<C extends Collection> = HifzData[C][number];

let db: IDBDatabase | null = null;
let data: HifzData | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains("meta")) d.createObjectStore("meta");
      for (const c of COLLECTIONS) if (!d.objectStoreNames.contains(c)) d.createObjectStore(c, { autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function getAll<T>(store: IDBObjectStore): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

function get<T>(store: IDBObjectStore, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function load(): Promise<void> {
  const fresh = emptyData(isoDay());
  try {
    db = await openDb();
    const tx = db.transaction(["meta", ...COLLECTIONS], "readonly");
    const profile = await get<Profile>(tx.objectStore("meta"), "profile");
    const settings = await get<Settings>(tx.objectStore("meta"), "settings");
    const loaded: HifzData = {
      ...fresh,
      profile: profile ? { ...fresh.profile, ...profile } : fresh.profile,
      settings: { ...DEFAULT_SETTINGS, ...settings },
    };
    for (const c of COLLECTIONS) (loaded[c] as unknown[]) = await getAll(tx.objectStore(c));
    data = loaded;
  } catch {
    // IndexedDB unavailable (private mode): run in memory, export still works
    db = null;
    data = fresh;
  }
  emit();
}

function emit() {
  if (data) data = { ...data }; // new identity so React re-renders
  listeners.forEach((l) => l());
}

export function ensureLoaded(): Promise<void> {
  loading ??= load();
  return loading;
}

function write(stores: string[], fn: (tx: IDBTransaction) => void) {
  if (!db) return;
  try {
    const tx = db.transaction(stores, "readwrite");
    fn(tx);
    done(tx).catch((e) => console.error("hifz: save failed", e));
  } catch (e) {
    console.error("hifz: save failed", e);
  }
}

export function getData(): HifzData | null {
  return data;
}

export function updateProfile(fn: (p: Profile) => Profile) {
  if (!data) return;
  data.profile = fn(data.profile);
  const profile = data.profile;
  write(["meta"], (tx) => tx.objectStore("meta").put(profile, "profile"));
  emit();
}

export function updateSettings(fn: (s: Settings) => Settings) {
  if (!data) return;
  data.settings = fn(data.settings);
  const settings = data.settings;
  write(["meta"], (tx) => tx.objectStore("meta").put(settings, "settings"));
  emit();
}

export function append<C extends Collection>(collection: C, ...items: Item<C>[]) {
  if (!data || items.length === 0) return;
  (data[collection] as Item<C>[]) = [...data[collection], ...items];
  write([collection], (tx) => items.forEach((it) => tx.objectStore(collection).add(it)));
  emit();
}

/** Replace a whole collection (used when a tuning proposal is answered, and for imports). */
export function replace<C extends Collection>(collection: C, items: Item<C>[]) {
  if (!data) return;
  (data[collection] as Item<C>[]) = items;
  write([collection], (tx) => {
    const store = tx.objectStore(collection);
    store.clear();
    items.forEach((it) => store.add(it));
  });
  emit();
}

export function exportData(): string {
  return JSON.stringify({ app: "hifz", version: 2, exportedAt: new Date().toISOString(), data }, null, 1);
}

export function importData(json: string) {
  const parsed = JSON.parse(json);
  const incoming: HifzData = parsed?.data;
  if (!incoming?.profile || !incoming?.settings) throw new Error("That file isn't a Hifz backup.");
  data = { ...emptyData(isoDay()), ...incoming, settings: { ...DEFAULT_SETTINGS, ...incoming.settings } };
  const snapshot = data;
  write(["meta", ...COLLECTIONS], (tx) => {
    tx.objectStore("meta").put(snapshot.profile, "profile");
    tx.objectStore("meta").put(snapshot.settings, "settings");
    for (const c of COLLECTIONS) {
      const store = tx.objectStore(c);
      store.clear();
      (snapshot[c] as unknown[]).forEach((it) => store.add(it));
    }
  });
  emit();
}

export function resetAll() {
  importData(JSON.stringify({ data: emptyData(isoDay()) }));
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  void ensureLoaded();
  return () => listeners.delete(cb);
}

/** The whole journey, or null while it loads from IndexedDB. */
export function useHifz(): HifzData | null {
  return useSyncExternalStore(subscribe, () => data, () => null);
}

export const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
