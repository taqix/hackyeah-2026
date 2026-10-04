/* Running sessions: walking at first, then walk-run intervals that grow with the level. */

import { formatSeconds } from "../text";
import { exercise } from "./shared";
import type { SessionBlueprint, SessionBuildInput, SportSessionBuilder } from "./types";

/** At this length every running session stays a walk, whatever the level. */
const WALK_ONLY_MINUTES = 5;
/** Above this, warm-ups and cool-downs get longer. */
const LONG_SESSION_MINUTES = 20;

const RUN_SECONDS = [30, 60, 90];
const WALK_SECONDS = [90, 90, 60];

const LEVEL_DESCRIPTIONS = [
  "the first session is an easy walk; run bits are 30 s",
  "run bits start at 1 min",
  "run bits start at 90 s",
];

/** True when running at this length is walking only, so easier is not available. */
export function isWalkOnly(minutes: number): boolean {
  return minutes === WALK_ONLY_MINUTES;
}

function shortWalk(): SessionBlueprint {
  return {
    title: "Short walk",
    exercises: [
      exercise("Easy walk", formatSeconds(120), "warm-up", 120),
      exercise("Brisk walk", formatSeconds(120), "a little quicker", 120),
      exercise("Slow walk", formatSeconds(60), "cool-down", 60),
    ],
  };
}

/** The gentlest first session: a walk that picks up in the middle. */
function easyWalk(minutes: number): SessionBlueprint {
  const coolDown = 120;
  const brisk = minutes >= LONG_SESSION_MINUTES ? 240 : 120;
  const easy = minutes * 60 - brisk - coolDown;
  return {
    title: "Easy walk",
    exercises: [
      exercise("Easy walk", formatSeconds(easy), "talk pace", easy),
      exercise("Brisk walk", formatSeconds(brisk), "a little quicker", brisk),
      exercise("Slow walk", formatSeconds(coolDown), "cool-down", coolDown),
    ],
  };
}

/** Warm-up, as many run/walk repeats as fit, and the rest of the session as a cool-down. */
function walkRunIntervals(minutes: number, level: number): SessionBlueprint {
  const long = minutes >= LONG_SESSION_MINUTES;
  const warmUp = long ? 300 : 120;
  const shortestCoolDown = long ? 180 : 120;
  const run = RUN_SECONDS[level];
  const walk = WALK_SECONDS[level];
  const repeats = Math.max(1, Math.floor((minutes * 60 - warmUp - shortestCoolDown) / (run + walk)));
  const block = repeats * (run + walk);
  const coolDown = minutes * 60 - warmUp - block;
  return {
    title: "Walk-run intervals",
    exercises: [
      exercise("Brisk walk", formatSeconds(warmUp), "warm-up", warmUp),
      exercise("Run, then walk", `${repeats} × ${formatSeconds(run)} run · ${formatSeconds(walk)} walk`, formatSeconds(block), block),
      exercise("Slow walk", formatSeconds(coolDown), "cool-down", coolDown),
    ],
  };
}

export const runningSessions: SportSessionBuilder = {
  build({ index, level, minutes }: SessionBuildInput): SessionBlueprint {
    if (isWalkOnly(minutes)) return shortWalk();
    if (level === 0 && index === 0) return easyWalk(minutes);
    return walkRunIntervals(minutes, level);
  },
  describeLevel(level, minutes) {
    return isWalkOnly(minutes) ? "every session is a short walk" : LEVEL_DESCRIPTIONS[level];
  },
  describeLevelValue(level) {
    return `${formatSeconds(RUN_SECONDS[level])} run bits`;
  },
};
