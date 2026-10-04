/* The questionnaire's result, and the questions the rest of the app asks of it. */

import type { ComfortValue, CompanyKey, PlaceKey, PreferenceKey, SlotKey } from "./catalog";

export interface Answers {
  comfort: ComfortValue | null;
  places: PlaceKey[];
  company: CompanyKey[];
  sessionsPerWeek: number;
  minutes: number;
  slot: SlotKey;
}

/** What the questionnaire starts from: nothing answered, sensible slider defaults. */
export const EMPTY_ANSWERS: Answers = {
  comfort: null,
  places: [],
  company: [],
  sessionsPerWeek: 3,
  minutes: 10,
  slot: "morning",
};

/** The seeded guest demo (`#/try/sample`): a gentle outdoor week. */
export const SAMPLE_ANSWERS: Answers = {
  comfort: "scratch",
  places: ["outdoors"],
  company: ["alone"],
  sessionsPerWeek: 3,
  minutes: 10,
  slot: "morning",
};

/** Places then company, in catalog order — how scoring and badges read them. */
export function selectedPreferences(answers: Answers): PreferenceKey[] {
  return [...answers.places, ...answers.company];
}

export function hasPreference(answers: Answers, key: PreferenceKey): boolean {
  return selectedPreferences(answers).includes(key);
}

export function prefersCompany(answers: Answers): boolean {
  return answers.company.includes("others");
}

/** A plan keeps the answers it was built from, so later edits cannot rewrite its history. */
export function cloneAnswers(answers: Answers): Answers {
  return { ...answers, places: [...answers.places], company: [...answers.company] };
}
