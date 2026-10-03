/* What the demo chat recognises. These stand in for the real app's AI step,
   so they are deliberately simple and all in one place. */

import type { SlotKey, SportKey } from "../catalog";

/** Checked in the order the pipeline lists them, so narrower patterns come first. */
export const PATTERNS = {
  health: /\b(pain|painful|hurts?|hurting|injur(y|ies|ed)|ill|illness|sick|doctor|physio|medic(al|ation|ine)|pregnan(t|cy)|asthma|diabet(es|ic)|blood pressure|heart condition)\b/,
  scope: /\b(half marathon|marathon|ultra|triathlon|twice a day|lose weight|weight loss|lose \d+)\b/,
  busy: /\bbusy\b/,
  day: /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today)\b/,
  harder: /\b(harder|more challenging|challenge|push me|too easy)\b/,
  easier: /\b(easier|easy|gentler|gentle|too hard|too much|hard|tired)\b/,
  longer: /\b(longer|more time|too short)\b/,
  shorter: /\b(shorter|short|less time|quick|quicker|no time|too long)\b/,
  rest: /\b(rest|fewer|less often|day off|recover)\b/,
  switchVerb: /\b(switch|change|try|instead|rather|swap)\b/,
};

/** "Mornings are busy" — the time of day the message says is taken. */
export const BUSY_SLOT_PATTERNS: [SlotKey, RegExp][] = [
  ["morning", /\bmornings?\b/],
  ["lunchtime", /\b(lunch|lunchtimes?|midday|noon)\b/],
  ["evening", /\b(evenings?|after work|nights?)\b/],
];

/** "Can we do evenings?" — the time of day the message asks for. Evening first, as it is
    the most common ask and "after work" also matches the morning pattern's "work". */
export const ASK_SLOT_PATTERNS: [SlotKey, RegExp][] = [
  ["evening", /\b(evenings?|after work|nights?)\b/],
  ["morning", /\b(mornings?|before work|early)\b/],
  ["lunchtime", /\b(lunch|lunchtimes?|midday|noon)\b/],
];

/** Sports the demo recognises but does not plan, so it can name them when declining. */
export const UNSUPPORTED_SPORTS: [RegExp, string][] = [
  [/climb|bouldering/, "Climbing"],
  [/basketball/, "Basketball"],
  [/volleyball/, "Volleyball"],
  [/swim/, "Swimming"],
  [/tennis/, "Tennis"],
  [/yoga/, "Yoga"],
  [/cycl|bike/, "Cycling"],
  [/padel/, "Padel"],
];

export const SWITCH_SPORT_PATTERNS: [SportKey, RegExp][] = [
  ["football", /\b(football|soccer)\b/],
  ["gym", /\bgym\b|\bmachines?\b/],
  ["fitness", /\bfitness\b|at home|home workout/],
  ["running", /\brun\b|running|\bjog/],
];

/** The time of day to move to when the current one is busy. */
export const SLOT_FALLBACK: Record<SlotKey, SlotKey> = {
  morning: "evening",
  lunchtime: "evening",
  evening: "morning",
};

/** The first key whose pattern matches the message, or null. */
export function firstMatch<T>(table: [T, RegExp][], text: string): T | null {
  for (const [key, pattern] of table) if (pattern.test(text)) return key;
  return null;
}
