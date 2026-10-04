/* Which sport to suggest. Each answer adds or removes weight per sport; the highest wins,
   with the catalog order breaking ties. */

import { hasPreference, selectedPreferences, type Answers } from "./answers";
import { PREFERENCE_TAGS, SPORT_ORDER, type PreferenceKey, type PreferenceTag, type SportKey } from "./catalog";

/** Session lengths that favour some sports over others. */
const SHORT_SESSION_MINUTES = 5;
const LONG_SESSION_MINUTES = 20;

type WeightKey = "base" | PreferenceKey | "scratch" | "routine" | "shortSession" | "longSession";

const WEIGHTS: Record<WeightKey, Record<SportKey, number>> = {
  base:         { running: 2, fitness: 2, gym: 1, football: 1 },
  home:         { running: 0, fitness: 4, gym: -1, football: 0 },
  outdoors:     { running: 3, fitness: 0, gym: -1, football: 2 },
  gym:          { running: 0, fitness: 0, gym: 5, football: 0 },
  alone:        { running: 2, fitness: 1, gym: 1, football: -2 },
  others:       { running: 0, fitness: 0, gym: 0, football: 5 },
  scratch:      { running: 1, fitness: 1, gym: 0, football: -1 },
  routine:      { running: 0, fitness: 0, gym: 1, football: 1 },
  shortSession: { running: 0, fitness: 2, gym: -2, football: -1 },
  longSession:  { running: 0, fitness: 0, gym: 1, football: 1 },
};

/** How many of the matching answers a suggestion shows as badges. */
const MAX_BADGES = 2;

export interface MatchedTag extends PreferenceTag {
  /** How strongly this answer favours the sport. */
  weight: number;
}

export interface RankedSport {
  key: SportKey;
  /** Position in the catalog order, which breaks score ties. */
  order: number;
  score: number;
  /** The chosen answers that favour this sport, strongest first. */
  matches: MatchedTag[];
  reason: string;
}

/** The chosen answers that favour this sport, strongest first, capped for the card. */
export function matchingTags(sport: SportKey, answers: Answers): MatchedTag[] {
  const chosen = selectedPreferences(answers);
  return PREFERENCE_TAGS
    .map((tag, order) => ({ ...tag, order, weight: WEIGHTS[tag.key][sport] }))
    .filter(tag => chosen.includes(tag.key) && tag.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.order - b.order)
    .slice(0, MAX_BADGES)
    .map(({ order: _order, ...tag }) => tag);
}

/** One line saying why this sport suits the answers. */
export function sportReason(sport: SportKey, answers: Answers): string {
  const has = (key: PreferenceKey) => hasPreference(answers, key);
  if (sport === "running") {
    if (has("outdoors") && has("alone")) return "Outdoors, on your own. Starts as walking.";
    if (has("outdoors")) return "Outdoors, at your pace. Starts as walking.";
    return "Just shoes and a route. Starts as walking.";
  }
  if (sport === "fitness") {
    return has("home") ? "Short sessions at home, nothing to buy." : "Works in a living room, nothing to buy.";
  }
  if (sport === "gym") {
    return has("gym") ? "You can get to a gym. Machines first, one at a time." : "Machines first, if a gym is close by.";
  }
  return has("others") ? "With others, at walking pace to start." : "Ball skills on your own first, a kickabout later.";
}

function scoreSport(sport: SportKey, answers: Answers): number {
  let score = WEIGHTS.base[sport];
  for (const key of selectedPreferences(answers)) score += WEIGHTS[key][sport];
  if (answers.comfort === "scratch") score += WEIGHTS.scratch[sport];
  if (answers.comfort === "routine") score += WEIGHTS.routine[sport];
  if (answers.minutes <= SHORT_SESSION_MINUTES) score += WEIGHTS.shortSession[sport];
  if (answers.minutes >= LONG_SESSION_MINUTES) score += WEIGHTS.longSession[sport];
  return score;
}

/** Every sport, best fit first. */
export function rankSports(answers: Answers): RankedSport[] {
  return SPORT_ORDER
    .map((key, order) => ({
      key,
      order,
      score: scoreSport(key, answers),
      matches: matchingTags(key, answers),
      reason: sportReason(key, answers),
    }))
    .sort((a, b) => b.score - a.score || a.order - b.order);
}
