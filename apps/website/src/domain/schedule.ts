/* Which days of the week a plan's sessions land on. Offsets count from the plan's start day. */

import { DAYS_IN_WEEK } from "./dates";

/** Spread so rest days fall between sessions for as long as the count allows. */
const SESSION_DAY_OFFSETS: Record<number, number[]> = {
  1: [0],
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 2, 4, 6],
  5: [0, 1, 3, 4, 6],
  6: [0, 1, 2, 4, 5, 6],
  7: [0, 1, 2, 3, 4, 5, 6],
};

/** The session days for a week, or none when the count is outside the questionnaire's range. */
export function sessionDayOffsets(sessionsPerWeek: number): number[] {
  return SESSION_DAY_OFFSETS[sessionsPerWeek] ?? [];
}

/** True when the day before this session has no session on it. */
export function hasRestDayBefore(offsets: number[], index: number): boolean {
  return index > 0 && offsets[index] - offsets[index - 1] > 1;
}

/** Every offset in a week, for the day strips. */
export function weekOffsets(): number[] {
  return Array.from({ length: DAYS_IN_WEEK }, (_, offset) => offset);
}
