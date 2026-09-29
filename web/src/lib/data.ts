import type { PageData, PageIndexEntry } from "./types";

const pageCache = new Map<number, Promise<PageData>>();

export function loadPage(page: number): Promise<PageData> {
  let p = pageCache.get(page);
  if (!p) {
    p = fetch(`/pages/${page}.json`).then((r) => {
      if (!r.ok) throw new Error(`Page ${page} hasn't been built yet`);
      return r.json() as Promise<PageData>;
    });
    p.catch(() => pageCache.delete(page));
    pageCache.set(page, p);
  }
  return p;
}

let indexPromise: Promise<PageIndexEntry[]> | null = null;

export function loadIndex(): Promise<PageIndexEntry[]> {
  indexPromise ??= fetch("/pages/index.json").then((r) => (r.ok ? r.json() : []));
  return indexPromise;
}

/** "2:5" + "2:16" -> "2:5–16"; spans across surahs keep both keys */
export function verseRange(first: string, last: string): string {
  const [s1, a1] = first.split(":");
  const [s2, a2] = last.split(":");
  return s1 === s2 ? `${s1}:${a1}–${a2}` : `${first} – ${last}`;
}
