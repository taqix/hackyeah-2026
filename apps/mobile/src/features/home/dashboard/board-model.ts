/**
 * Pure reading of a week for the desktop dashboard: the board's days with
 * their sessions, and the short lines around it. Builds on home-model, which
 * the phone screen reads the same week with.
 */
import type { LocalDate, PlanWeek } from '@/api/types';
import { capitalize, formatMinutes, numberWord } from '@/lib/dates';

import { type StripDay, stripDays, type WeekRow, weekRows } from '../home-model';

/** A day on the board: its strip state (done, planned, rest…) and everything on it, by start time. */
export type BoardDay = StripDay & { rows: WeekRow[] };

export function boardDays(week: PlanWeek, today: LocalDate): BoardDay[] {
  const rows = weekRows(week);
  return stripDays(week, today).map((day) => ({ ...day, rows: rows.filter((row) => row.date === day.date) }));
}

/**
 * The page's subtitle: the week's summary from the plan, or, for a week without
 * one (past weeks), what got done, counted like the finished week's hero. No
 * guilt: what was done, never what wasn't.
 */
export function weekSubtitle(week: PlanWeek): string | undefined {
  if (week.summary) return week.summary;
  if (!week.sessions.length) return undefined;
  const done = week.sessions.filter((s) => s.status === 'completed').length;
  if (!done) return 'No sessions logged.';
  return `${capitalize(numberWord(done))} ${done === 1 ? 'session' : 'sessions'} done.`;
}

/** Optional sessions done: they never count towards the week, so the progress card names them apart. */
export function optionalDone(week: PlanWeek): number {
  return week.sessions.filter((s) => s.optional && s.status === 'completed').length;
}

/** "40 of 60 min", or "1 h of 1 h 20 min" once either side reaches an hour. */
export function minutesOf(done: number, planned: number): string {
  if (planned < 60) return `${Math.round(done)} of ${formatMinutes(planned)}`;
  return `${formatMinutes(done)} of ${formatMinutes(planned)}`;
}
