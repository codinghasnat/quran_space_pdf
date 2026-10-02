"use client";

import { useState } from "react";
import { Flag } from "lucide-react";
import { append } from "@/lib/hifz/store";

/** Report a line whose word covers sit in the wrong place, so its boxes can be fixed later. */
export default function FlagCovers({ page, line }: { page: number; line: number | null }) {
  const [done, setDone] = useState<string | null>(null);
  const key = `${page}:${line}`;
  if (line === null) return null;
  return (
    <button
      onClick={() => {
        append("flaggedLines", { page, line, at: new Date().toISOString() });
        setDone(key);
      }}
      disabled={done === key}
      className="flex items-center gap-1.5 px-2 text-xs text-parchment-muted hover:text-parchment disabled:text-teal"
    >
      <Flag size={13} /> {done === key ? `Page ${page}, line ${line} flagged for a cover fix` : "Covers in the wrong place on this line?"}
    </button>
  );
}
