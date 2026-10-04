/* Building blocks every sport's session builder uses. */

import type { SessionBlueprint, SessionExercise } from "./types";

export function exercise(name: string, detail: string, meta: string, seconds: number): SessionExercise {
  return { name, detail, meta, seconds };
}

/** Split a duration into equal parts, the last one absorbing the remainder. */
export function splitEvenly(totalSeconds: number, parts: number): number[] {
  const each = Math.floor(totalSeconds / parts);
  return Array.from({ length: parts }, (_, index) => (index === parts - 1 ? totalSeconds - each * (parts - 1) : each));
}

/** Session length bands: short (under 10 min), standard (10–19 min), long (20 min and up).
    Builders index their warm-up, cool-down and drill tables with this. */
export type LengthBand = 0 | 1 | 2;

export function lengthBand(minutes: number): LengthBand {
  if (minutes < 10) return 0;
  if (minutes < 20) return 1;
  return 2;
}

/** How many rounds of a drill fit: one when short, then more as the session grows. */
export function roundsFor(minutes: number): number {
  if (minutes < 10) return 1;
  if (minutes < 20) return 2;
  return 3 + Math.floor((minutes - 20) / 10);
}

/** Session variety: the first session is its own, later ones alternate the other two. */
export function drillVariant(index: number): 0 | 1 | 2 {
  return (index < 3 ? index : 1 + ((index - 1) % 2)) as 0 | 1 | 2;
}

/** A named set of exercises a builder can pick by variant. */
export interface DrillSet {
  title: string;
  exercises: { name: string; detail: string; meta: string }[];
}

/** Lay a drill set out as a session: warm-up, the drills sharing the time left, then a cool-down. */
export function drillSession(
  drills: DrillSet,
  minutes: number,
  warmUp: SessionExercise,
  coolDown: SessionExercise,
): SessionBlueprint {
  const middleSeconds = minutes * 60 - warmUp.seconds - coolDown.seconds;
  const shares = splitEvenly(middleSeconds, drills.exercises.length);
  return {
    title: drills.title,
    exercises: [
      warmUp,
      ...drills.exercises.map((drill, index) => exercise(drill.name, drill.detail, drill.meta, shares[index])),
      coolDown,
    ],
  };
}
