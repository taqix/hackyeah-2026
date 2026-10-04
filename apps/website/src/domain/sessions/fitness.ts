/* Fitness sessions: bodyweight drills that need no equipment beyond a chair and a wall. */

import { formatSeconds } from "../text";
import { drillSession, drillVariant, exercise, lengthBand, roundsFor } from "./shared";
import type { DrillSet } from "./shared";
import type { SessionBlueprint, SessionBuildInput, SportSessionBuilder } from "./types";

const REPS = [6, 8, 10];
const HOLD_SECONDS = [15, 20, 30];
const WARM_UP_SECONDS = [60, 120, 180];
const COOL_DOWN_SECONDS = [60, 120, 120];

/** Drop the third drill when the session is too short to hold three. */
const SHORT_SESSION_DRILLS = 2;

function drillSets(level: number, minutes: number): DrillSet[] {
  const reps = REPS[level];
  const sets = (count: number) => `${roundsFor(minutes)} × ${count}`;
  return [
    { title: "Home basics", exercises: [
      { name: "Sit to stand", detail: sets(reps), meta: "from a sturdy chair" },
      { name: "Wall push-up", detail: sets(reps), meta: "hands on a wall" },
    ] },
    { title: "Legs and core", exercises: [
      { name: "Sit to stand", detail: sets(reps), meta: "from a sturdy chair" },
      { name: "Glute bridge", detail: sets(reps), meta: "lying on your back" },
      { name: "Knee plank", detail: `${roundsFor(minutes)} × ${formatSeconds(HOLD_SECONDS[level])}`, meta: "knees down" },
    ] },
    { title: "Arms and balance", exercises: [
      { name: "Wall push-up", detail: sets(reps), meta: "hands on a wall" },
      { name: "Bird dog", detail: `${sets(reps - 2)} each side`, meta: "slow, on hands and knees" },
      { name: "Standing knee lift", detail: `${sets(reps - 2)} each side`, meta: "hold a wall if needed" },
    ] },
  ];
}

export const fitnessSessions: SportSessionBuilder = {
  build({ index, level, minutes }: SessionBuildInput): SessionBlueprint {
    const band = lengthBand(minutes);
    const chosen = drillSets(level, minutes)[drillVariant(index)];
    const drills = band === 0 ? { ...chosen, exercises: chosen.exercises.slice(0, SHORT_SESSION_DRILLS) } : chosen;
    return drillSession(
      drills,
      minutes,
      exercise("March on the spot", formatSeconds(WARM_UP_SECONDS[band]), "warm-up", WARM_UP_SECONDS[band]),
      exercise("Easy stretch", formatSeconds(COOL_DOWN_SECONDS[band]), "cool-down", COOL_DOWN_SECONDS[band]),
    );
  },
  describeLevel(level) {
    return `${REPS[level]} reps a set`;
  },
  describeLevelValue(level) {
    return `${REPS[level]} reps`;
  },
};
