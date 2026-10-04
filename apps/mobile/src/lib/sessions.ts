/**
 * Reading planned sessions: times, days, outcomes and week progress. Pure:
 * shared by screens and the mock backend.
 */
import type { LocalDate, PlannedSession, Preferences } from '../api/types';
import { asDate, formatMinutes, formatTime, minutesOfDay, toLocalDate, type DateLike } from './dates';

export function sessionStart(session: PlannedSession): Date {
  return new Date(session.time_slot.start);
}

export function sessionEnd(session: PlannedSession): Date {
  return new Date(sessionStart(session).getTime() + session.time_slot.duration * 1000);
}

/** Planned length in whole minutes. */
export function sessionMinutes(session: PlannedSession): number {
  return Math.round(session.time_slot.duration / 60);
}

/** The device-local day the session starts on. */
export function sessionLocalDate(session: PlannedSession): LocalDate {
  return toLocalDate(sessionStart(session));
}

/** '7:00 · 20 min' */
export function sessionTimeLabel(session: PlannedSession): string {
  return `${formatTime(sessionStart(session))} · ${formatMinutes(sessionMinutes(session))}`;
}

/** Home adds "Outside your preferred times." when the session starts or ends outside the window. */
export function isOutsidePreferredWindow(
  session: PlannedSession,
  prefs: Pick<Preferences, 'preferred_window'> | null | undefined,
): boolean {
  const window = prefs?.preferred_window;
  if (!window) return false;
  const start = minutesOfDay(sessionStart(session));
  return start < window[0] * 60 || start + sessionMinutes(session) > window[1] * 60;
}

export type SessionDayState = 'done' | 'planned' | 'today' | 'unlogged' | 'skipped';

/** done · skipped · today (planned for today) · unlogged (past, planned, no outcome) · planned. */
export function sessionDayState(session: PlannedSession, today: DateLike): SessionDayState {
  if (session.status === 'completed') return 'done';
  if (session.status === 'skipped') return 'skipped';
  const day = sessionLocalDate(session);
  const todayDate = toLocalDate(today);
  if (day === todayDate) return 'today';
  return day < todayDate ? 'unlogged' : 'planned';
}

/**
 * "2 of 3 done": plan sessions only. Optional sessions and extras never count,
 * and a skipped session reads like a rest day, so it leaves the total.
 */
export function weekProgress(week: { sessions: PlannedSession[] }): { done: number; total: number } {
  const counted = week.sessions.filter((s) => !s.optional && s.status !== 'skipped');
  return { done: counted.filter((s) => s.status === 'completed').length, total: counted.length };
}

/** Sessions by start time. */
export function sortSessions<T extends PlannedSession>(sessions: T[]): T[] {
  return [...sessions].sort((a, b) => sessionStart(a).getTime() - sessionStart(b).getTime());
}

/** The first planned session starting at or after `from`. */
export function nextPlannedSession<T extends PlannedSession>(sessions: T[], from: DateLike): T | null {
  const t = asDate(from).getTime();
  return sortSessions(sessions).find((s) => s.status === 'planned' && sessionStart(s).getTime() >= t) ?? null;
}

/** The sessions on one local day, by start time. */
export function sessionsOn<T extends PlannedSession>(sessions: T[], date: LocalDate): T[] {
  return sortSessions(sessions.filter((s) => sessionLocalDate(s) === date));
}
