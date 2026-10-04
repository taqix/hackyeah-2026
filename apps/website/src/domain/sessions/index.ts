/* The session builders, keyed by sport. A new sport adds a module and one entry here. */

import type { SportKey } from "../catalog";
import { fitnessSessions } from "./fitness";
import { footballSessions } from "./football";
import { gymSessions } from "./gym";
import { isWalkOnly, runningSessions } from "./running";
import type { SessionBlueprint, SessionBuildInput, SportSessionBuilder } from "./types";

const BUILDERS: Record<SportKey, SportSessionBuilder> = {
  running: runningSessions,
  fitness: fitnessSessions,
  gym: gymSessions,
  football: footballSessions,
};

export function buildSession(sport: SportKey, input: SessionBuildInput): SessionBlueprint {
  return BUILDERS[sport].build(input);
}

/** How the level reads in the plan's "why this plan" list. */
export function describeLevel(sport: SportKey, level: number, minutes: number): string {
  return BUILDERS[sport].describeLevel(level, minutes);
}

/** The part that visibly changes when the level moves, for a change card. */
export function describeLevelValue(sport: SportKey, level: number): string {
  return BUILDERS[sport].describeLevelValue(level);
}

/** True when the plan is walking only, so there is nothing gentler to ask for. */
export function isWalkOnlyPlan(sport: SportKey, minutes: number): boolean {
  return sport === "running" && isWalkOnly(minutes);
}

export type { SessionBlueprint, SessionBuildInput, SessionExercise, SportSessionBuilder } from "./types";
