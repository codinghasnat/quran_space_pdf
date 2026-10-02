// Copied from RootedQuran (src/lib/audio/reciters.ts) so both apps offer the same reciters.
export interface ReciterOption {
  id: string;
  source: "quran" | "alfurqan";
  recitationId?: number;
  alfurqanId?: string;
  name: string;
  style: string | null;
  label: string;
  order: number;
}

interface RawRecitation {
  id: number;
  reciter_name?: string;
  style?: string | null;
  translated_name?: { name?: string };
}

const SUPPORTED_RECITERS = [
  {
    displayName: "Husary",
    aliases: ["husary", "hosary", "hussary", "mahmoud khalil al husary", "mahmood khalil al husary"],
  },
  {
    displayName: "Minshawi",
    aliases: ["minshawi", "minshawy", "menshawi", "muhammad siddiq al minshawi", "mohamed siddiq al minshawi"],
  },
  {
    displayName: "Yasser Al Dossari",
    aliases: ["yasser al dossari", "yasser al dossary", "yasser al dosari", "yasser al dosary", "yasser ad dussary"],
  },
  {
    displayName: "Mishary Alafasy",
    aliases: ["mishary alafasy", "mishari alafasy", "mishary rashid alafasy", "mishari rashid al afasy", "alafasy", "al afasy", "afasy"],
  },
  {
    displayName: "Nasser Al Qatami",
    aliases: ["nasser al qatami", "nasser al qattami", "naasser al qatami"],
  },
  {
    displayName: "Badr Al Turki",
    aliases: ["badr al turki", "bader al turki"],
  },
  {
    displayName: "Idris Abkar",
    aliases: ["idris abkar", "idrees abkar", "idris akbar", "idrees akbar"],
  },
  {
    displayName: "Ibrahim Al Akhdar",
    aliases: ["ibrahim al akhdar"],
  },
  {
    displayName: "Maher Al Muaqily",
    aliases: ["maher al muaqily", "maher al muaiqly", "maher al mueaqly", "maher al meaqly"],
  },
  {
    displayName: "Saad Al-Ghamdi",
    aliases: ["saad al ghamdi", "saad al ghamidi", "saad el ghamidi"],
  },
  {
    displayName: "Muhammad Al Luhaidan",
    aliases: ["muhammad al luhaidan", "mohammed al luhaidan", "muhammad al lohaidan", "mohammed al lohaidan"],
  },
  {
    displayName: "Abdul Basit",
    aliases: ["abdul basit", "abdulbaset", "abdul baset", "abdulsamad", "abdul samad"],
  },
  {
    displayName: "Abdur-Rahman As-Sudais",
    aliases: ["abdurrahmaan as sudais", "abdur rahman as sudais", "abdul rahman al sudais", "sudais"],
  },
] as const;

// Exported for the Learn player's Settings→word-timed reciter mapping
// (playerPrefs.ts): alfurqan preference keys resolve to canonical names here
// without a network call. The names match SUPPORTED_RECITERS displayNames,
// which the mp3player's timed-reciter list also canonicalises to.
export const ALFURQAN_RECITATIONS = [
  { alfurqanId: "husary-mujawwad", name: "Husary", style: "Mujawwad" },
  { alfurqanId: "husary", name: "Husary", style: "Murattal" },
  { alfurqanId: "minshawy-mujawwad", name: "Minshawi", style: "Mujawwad" },
  { alfurqanId: "minshawy-murattal", name: "Minshawi", style: "Murattal" },
  { alfurqanId: "yasser-ad-dussary", name: "Yasser Al Dossari", style: null },
  { alfurqanId: "nasser-alqatami", name: "Nasser Al Qatami", style: null },
  { alfurqanId: "ibrahim-akhdar", name: "Ibrahim Al Akhdar", style: null },
  { alfurqanId: "maher-almuaiqly", name: "Maher Al Muaqily", style: null },
  { alfurqanId: "ghamadi", name: "Saad Al-Ghamdi", style: null },
  { alfurqanId: "abdul-basit-mujawwad", name: "Abdul Basit", style: "Mujawwad" },
  { alfurqanId: "abdul-basit-murattal", name: "Abdul Basit", style: "Murattal" },
] as const;

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[`'’‘]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function styleOrder(style: string | null) {
  const normalized = normalizeText(style ?? "");
  if (normalized.includes("mujawwad")) return 0;
  if (normalized.includes("murattal")) return 1;
  return 2;
}

function supportedMatch(name: string) {
  const normalizedName = normalizeText(name);
  return SUPPORTED_RECITERS.findIndex((reciter) =>
    reciter.aliases.some((alias) => normalizedName.includes(normalizeText(alias))),
  );
}

export function filterSupportedRecitations(raw: RawRecitation[]): ReciterOption[] {
  const alfurqan = ALFURQAN_RECITATIONS.map<ReciterOption>((recitation) => {
    const order = supportedMatch(recitation.name);
    return {
      id: `alfurqan:${recitation.alfurqanId}`,
      source: "alfurqan",
      alfurqanId: recitation.alfurqanId,
      name: recitation.name,
      style: recitation.style,
      label: recitation.name,
      order,
    };
  });

  const quran = raw
    .map<ReciterOption | null>((recitation) => {
      const sourceName = recitation.reciter_name ?? recitation.translated_name?.name ?? "";
      const order = supportedMatch(sourceName);
      if (order === -1) return null;

      const canonicalName = SUPPORTED_RECITERS[order].displayName;
      if (alfurqan.some((option) => option.name === canonicalName)) return null;

      return {
        id: `quran:${recitation.id}`,
        source: "quran",
        recitationId: recitation.id,
        name: canonicalName,
        style: recitation.style ?? null,
        label: canonicalName,
        order,
      };
    })
    .filter((option): option is ReciterOption => Boolean(option));

  const matched = [...alfurqan, ...quran].filter((option) => option.order !== -1);

  const counts = new Map<string, number>();
  for (const option of matched) {
    counts.set(option.name, (counts.get(option.name) ?? 0) + 1);
  }

  return matched
    .map((option) => ({
      ...option,
      label:
        (counts.get(option.name) ?? 0) > 1 && option.style
          ? `${option.name} · ${option.style}`
          : option.name,
    }))
    .sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      const styleDiff = styleOrder(a.style) - styleOrder(b.style);
      if (styleDiff !== 0) return styleDiff;
      return a.label.localeCompare(b.label);
    });
}

export function defaultRecitationKey(options: ReciterOption[]) {
  const yasser = options.filter((option) => option.name === "Yasser Al Dossari");
  if (yasser.length) {
    return (
      yasser.find((option) => normalizeText(option.style ?? "").includes("mujawwad")) ??
      yasser.find((option) => normalizeText(option.style ?? "").includes("murattal")) ??
      yasser[0]
    ).id;
  }

  return (
    options.find((option) => normalizeText(option.style ?? "").includes("mujawwad")) ??
    options.find((option) => normalizeText(option.style ?? "").includes("murattal")) ??
    options[0] ??
    null
  )?.id ?? null;
}

/** Always-available native fallback while bundled/live metadata is resolving. */
export const STATIC_RECITATIONS = filterSupportedRecitations([]);
export const STATIC_DEFAULT_RECITATION_KEY = defaultRecitationKey(STATIC_RECITATIONS);
