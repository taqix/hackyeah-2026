/* The fixed option tables the questionnaire, the plan and the chat all read from:
   starting points, places, company, times of day, sports and how a session felt.
   Adding an option means editing one table here, not touching the views. */

export type ComfortValue = "scratch" | "occasional" | "routine";
export type PlaceKey = "home" | "outdoors" | "gym";
export type CompanyKey = "alone" | "others";
export type PreferenceKey = PlaceKey | CompanyKey;
export type SlotKey = "morning" | "lunchtime" | "evening";
export type SportKey = "running" | "fitness" | "gym" | "football";
export type FeelingKey = "easy" | "right" | "hard" | "much";

/** How gentle the plan starts. `level` is the 0–2 difficulty the session builders read. */
export interface ComfortOption {
  value: ComfortValue;
  level: number;
  label: string;
  description: string;
  icon: string;
  /** How the answer is echoed back mid-sentence: "you said you're starting from scratch". */
  echo: string;
  /** The same answer as a standalone line in the summary panel. */
  panel: string;
}

/** A place or company answer. `badge` names it on a sport suggestion, `echo` inside a sentence.
    The key is narrowed per table, so `PLACES` can only hold places. */
export interface PreferenceTag<Key extends PreferenceKey = PreferenceKey> {
  key: Key;
  label: string;
  icon: string;
  echo: string;
  badge: string;
}

/** A time of day. Capitalised forms come from `capitalize`, so each phrase is written once. */
export interface Slot {
  key: SlotKey;
  label: string;
  icon: string;
  word: string;
  plural: string;
  inPhrase: string;
  /** Coaching note specific to training at this time of day. */
  tip: string;
}

export interface Sport {
  key: SportKey;
  name: string;
  icon: string;
  tone: "sage" | "dawn" | "dusk";
  tagline: string;
  heading: string;
  tip: string;
}

export interface Feeling {
  key: FeelingKey;
  label: string;
  description: string;
  /** Running makes every session a walk-run, so "hard" needs its own wording there. */
  runningDescription?: string;
  /** How the answer reads in a sentence: "Monday felt hard". */
  phrase: string;
}

/** Inclusive bounds and step of a questionnaire slider. */
export interface Range {
  min: number;
  max: number;
  step: number;
}

export const COMFORT_OPTIONS: ComfortOption[] = [
  { value: "scratch", level: 0, label: "Starting from scratch", description: "Little or no exercise lately", icon: "armchair", echo: "starting from scratch", panel: "Starting from scratch — we'll start gently" },
  { value: "occasional", level: 1, label: "Occasionally active", description: "Some movement now and then", icon: "footprints", echo: "occasionally active", panel: "Occasionally active — a short first session" },
  { value: "routine", level: 2, label: "Already have some routine", description: "Moving most weeks", icon: "calendar-check", echo: "some routine already", panel: "Some routine — a bit more from day one" },
];

export const PLACES: PreferenceTag<PlaceKey>[] = [
  { key: "home", label: "Home", icon: "house", echo: "at home", badge: "At home" },
  { key: "outdoors", label: "Outdoors", icon: "tree-pine", echo: "outdoors", badge: "Outdoors" },
  { key: "gym", label: "Gym", icon: "building-2", echo: "a gym nearby", badge: "Gym nearby" },
];

export const COMPANY: PreferenceTag<CompanyKey>[] = [
  { key: "alone", label: "On my own", icon: "user-round", echo: "on your own", badge: "On your own" },
  { key: "others", label: "With others", icon: "users-round", echo: "with others", badge: "With others" },
];

/** Places then company, in the order suggestions list their badges. */
export const PREFERENCE_TAGS: PreferenceTag[] = [...PLACES, ...COMPANY];

/** The 0-2 difficulty range shared by the comfort answers and the session builders. */
export const MIN_LEVEL = 0;
export const MAX_LEVEL = 2;

/** The sport the seeded guest plan is built from. */
export const SAMPLE_PLAN_SPORT: SportKey = "running";

export const SESSIONS_PER_WEEK_RANGE: Range = { min: 1, max: 7, step: 1 };
export const MINUTES_RANGE: Range = { min: 5, max: 60, step: 5 };

export const SLOTS: Record<SlotKey, Slot> = {
  morning: { key: "morning", label: "Morning", icon: "sunrise", word: "morning", plural: "mornings", inPhrase: "in the morning", tip: "Mornings start stiff, so the warm-up does the work." },
  lunchtime: { key: "lunchtime", label: "Lunchtime", icon: "sun", word: "lunchtime", plural: "lunchtimes", inPhrase: "at lunchtime", tip: "Fits a lunch break. Bring a top to change into." },
  evening: { key: "evening", label: "Evening", icon: "moon", word: "evening", plural: "evenings", inPhrase: "in the evening", tip: "After work counts. Keep the last few minutes slow." },
};

export const SLOT_ORDER: SlotKey[] = ["morning", "lunchtime", "evening"];

/** Tie-break order when two sports score the same. */
export const SPORT_ORDER: SportKey[] = ["running", "fitness", "gym", "football"];

export const SPORTS: Record<SportKey, Sport> = {
  running: { key: "running", name: "Running", icon: "footprints", tone: "sage", tagline: "Starts as walking.", heading: "Running, gently.", tip: "Talk-pace is the pace. Slow enough to say a sentence." },
  fitness: { key: "fitness", name: "Fitness", icon: "heart-pulse", tone: "dawn", tagline: "Nothing to buy.", heading: "Fitness, at home.", tip: "Move slowly and breathe out on the effort." },
  gym: { key: "gym", name: "Gym", icon: "dumbbell", tone: "dusk", tagline: "Machines first.", heading: "Gym, machines first.", tip: "Start on the lightest setting. Asking staff to show you a machine is normal." },
  football: { key: "football", name: "Football", icon: "goal", tone: "sage", tagline: "Start with the ball.", heading: "Football, first touches.", tip: "Any ball works. A wall makes a patient partner." },
};

export const FEELINGS: Feeling[] = [
  { key: "easy", label: "Easy", description: "Could have kept going", phrase: "felt easy" },
  { key: "right", label: "Just right", description: "Tired, but good", phrase: "felt just right" },
  { key: "hard", label: "Hard", description: "Needed a few extra breaks", runningDescription: "Needed every walk break", phrase: "felt hard" },
  { key: "much", label: "Too much", description: "Had to stop early", phrase: "felt like too much" },
];

export function comfortOption(value: ComfortValue | null): ComfortOption | undefined {
  return COMFORT_OPTIONS.find(option => option.value === value);
}

/** The 0–2 difficulty for an answer, defaulting to the gentlest start. */
export function comfortLevel(value: ComfortValue | null): number {
  return comfortOption(value)?.level ?? 0;
}

export function preferenceTag(key: PreferenceKey): PreferenceTag | undefined {
  return PREFERENCE_TAGS.find(tag => tag.key === key);
}

export function feelingOption(key: FeelingKey): Feeling {
  const feeling = FEELINGS.find(option => option.key === key);
  if (!feeling) throw new Error(`Unknown feeling: ${key}`);
  return feeling;
}

/** The description to show for a feeling, which running words differently. */
export function feelingDescription(feeling: Feeling, sport: SportKey): string {
  return sport === "running" && feeling.runningDescription ? feeling.runningDescription : feeling.description;
}
