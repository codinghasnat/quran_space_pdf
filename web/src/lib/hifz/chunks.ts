// The micro loop of a sabaq: learn it in small chunks, each joined to everything before it, then the whole.
//
//   chunk 1: listen → read → blur → recite
//   chunk 2: listen → read → blur → recite → join (chunks 1–2)
//   chunk 3: …                             → join (chunks 1–3)
//   whole sabaq covered × x, then eyes closed × y

export type MicroPhase = "listen" | "read" | "blur" | "recite" | "join";
export type Stage = "chunks" | "whole" | "eyes" | "settled";

export function makeChunks<T>(lines: T[], size: number): T[][] {
  const n = Math.max(1, size);
  const out: T[][] = [];
  for (let i = 0; i < lines.length; i += n) out.push(lines.slice(i, i + n));
  // A lone trailing line joins the chunk before it rather than standing on its own
  if (out.length > 1 && out.at(-1)!.length === 1 && n > 1) out[out.length - 2].push(...out.pop()!);
  return out;
}

export function phasesFor(chunk: number): MicroPhase[] {
  return chunk === 0 ? ["listen", "read", "blur", "recite"] : ["listen", "read", "blur", "recite", "join"];
}

/** The phase after this one, or null when the chunk is finished. */
export function nextPhase(chunk: number, phase: MicroPhase): MicroPhase | null {
  const p = phasesFor(chunk);
  return p[p.indexOf(phase) + 1] ?? null;
}
