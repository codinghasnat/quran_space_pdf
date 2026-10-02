// Domain types for the hifz journey. Raw events are stored; everything else (strength, heatmap, plans,
// projections) is derived from them so the model can be retuned and recomputed over the whole history.

export type Stage = "sabaq" | "sabqi" | "dawr" | "drill" | "placement";
export type Direction = "backward" | "forward";
export type Claim = "solid" | "rusty" | "forgotten";

/** One mushaf line that holds Qur'an text. Every such line belongs to exactly one surah. */
export type LineRef = { page: number; line: number };

/** How a portion was recited. */
export type RecitationMode = "covered" | "eyesClosed" | "flash";

export type Recitation = {
  id: string;
  at: string; // ISO timestamp
  day: string; // local YYYY-MM-DD
  stage: Stage;
  mode: RecitationMode;
  page: number;
  lines: number[]; // the page's lines that were recited
  clean: boolean; // no peeks, no mistakes (or rated Good/Easy with eyes closed)
  rating?: 1 | 2 | 3 | 4; // eyes-closed self rating: Again, Hard, Good, Easy
  peeks: number; // words uncovered before checking
  mistakes: number; // words marked as said wrong after checking
  seconds: number;
};

/** A word you uncovered before trying (a trigger word) or said wrong. Position is kept so it can be remapped
 *  if the page's word boxes are corrected later. */
export type WordEvent = {
  at: string;
  day: string;
  key: string; // surah:ayah:word
  page: number;
  line: number;
  x: number; // centre of the tapped box, as a fraction of page width
  kind: "peek" | "wrong";
  stage: Stage;
};

/** The outcome of a day's sabaq: the signals the tuning loop learns from. */
export type SabaqRecord = {
  id: string;
  day: string;
  lines: LineRef[];
  settled: boolean;
  repsToFirstClean: number; // covered repetitions until the first clean one
  coveredClean: number;
  eyesClosedClean: number;
  seconds: number;
};

export type StageSession = {
  id: string;
  day: string;
  stage: Stage;
  startedAt: string;
  seconds: number; // active time, pauses excluded
};

export type TuningChange = {
  day: string;
  variable: "sabaqLines" | "coveredReps";
  from: number;
  to: number;
  reason: string;
  accepted: boolean | null; // null while waiting for the learner
};

export type Settings = {
  direction: Direction;
  start: LineRef | null; // where the next new sabaq begins; null = start of the chosen direction
  dailyMinutes: number;
  activeDays: number[]; // 0 = Sunday
  sabaqTime: string; // free text, e.g. "After Fajr"
  sabaqLines: number; // tuned
  coveredReps: number; // clean covered repetitions required (x), tuned
  eyesClosedReps: number; // clean eyes-closed rounds required
  reciter: string; // RootedQuran recitation key, e.g. "alfurqan:yasser-ad-dussary"
  dawrChunkPages: number;
};

export type Profile = {
  createdOn: string;
  onboarded: boolean;
  why: number | null; // index into WHY_REASONS
  claims: Record<number, Claim>; // surahs already memorised before starting, with how well
  introSeen: boolean;
  hero?: { date: string; likely: string; setOn: string; reason: string | null };
};

export type HifzData = {
  profile: Profile;
  settings: Settings;
  recitations: Recitation[];
  wordEvents: WordEvent[];
  sabaqs: SabaqRecord[];
  sessions: StageSession[];
  tuning: TuningChange[];
  flaggedLines: { page: number; line: number; at: string }[];
};

export const DEFAULT_SETTINGS: Settings = {
  direction: "backward",
  start: null,
  dailyMinutes: 90,
  activeDays: [0, 1, 2, 3, 4, 5, 6],
  sabaqTime: "After Fajr",
  sabaqLines: 7,
  coveredReps: 30,
  eyesClosedReps: 30,
  reciter: "alfurqan:yasser-ad-dussary",
  dawrChunkPages: 3,
};

export function emptyData(day: string): HifzData {
  return {
    profile: { createdOn: day, onboarded: false, why: null, claims: {}, introSeen: false },
    settings: { ...DEFAULT_SETTINGS },
    recitations: [],
    wordEvents: [],
    sabaqs: [],
    sessions: [],
    tuning: [],
    flaggedLines: [],
  };
}
