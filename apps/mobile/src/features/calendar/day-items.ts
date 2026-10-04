/**
 * What a calendar day holds: plan sessions and extras (workouts added in chat),
 * by start time, and how a day reads to a screen reader.
 */
import type { ActivityLog, Felt, LocalDate, PlannedSession } from '@/api/types';
import { formatLongDate, formatTime, toLocalDate } from '@/lib/dates';
import { sessionDayState, sessionLocalDate, sessionStart } from '@/lib/sessions';

export type DayItem =
  | { kind: 'session'; key: string; start: Date; session: PlannedSession }
  | { kind: 'extra'; key: string; start: Date; log: ActivityLog };

/**
 * done is filled, planned is the accent, and skipped and unlogged (a past
 * session nobody logged) share a dashed ring. Extras count as done; today's
 * session stays planned until the day is over.
 */
export type MarkState = 'done' | 'planned' | 'unlogged' | 'skipped';

export function markState(item: DayItem, today: LocalDate): MarkState {
  if (item.kind === 'extra') return 'done';
  return sessionMarkState(item.session, today);
}

/** A plan session's mark: today's stays planned until the day is over. */
export function sessionMarkState(session: PlannedSession, today: LocalDate): MarkState {
  const state = sessionDayState(session, today);
  return state === 'today' ? 'planned' : state;
}

/** How a state reads in words: "Done", "Not logged", "Skipped"; null for planned. */
export function stateWord(state: MarkState): string | null {
  return { done: 'Done', unlogged: 'Not logged', skipped: 'Skipped', planned: null }[state];
}

export function itemTitle(item: DayItem): string {
  return item.kind === 'extra' ? item.log.title : item.session.title;
}

/** Sessions and extras by local day, each day sorted by start time. */
export function groupByDay(sessions: PlannedSession[], extras: ActivityLog[]): Map<LocalDate, DayItem[]> {
  const days = new Map<LocalDate, DayItem[]>();
  const add = (date: LocalDate, item: DayItem) => days.set(date, [...(days.get(date) ?? []), item]);
  sessions.forEach((session) =>
    add(sessionLocalDate(session), { kind: 'session', key: session.id, start: sessionStart(session), session }),
  );
  extras.forEach((log) => {
    const start = new Date(log.started_at);
    add(toLocalDate(start), { kind: 'extra', key: `extra-${log.id}`, start, log });
  });
  days.forEach((items, date) => days.set(date, [...items].sort((a, b) => a.start.getTime() - b.start.getTime())));
  return days;
}

const FELT: Record<Felt, string> = {
  easy: 'easy',
  just_right: 'just right',
  hard: 'hard',
  too_much: 'too much',
};

export function feltLabel(felt: Felt): string {
  return FELT[felt];
}

function itemPhrase(item: DayItem, today: LocalDate): string {
  const title = itemTitle(item);
  if (item.kind === 'extra') return `${title}, extra, done`;
  const word = stateWord(markState(item, today));
  return word ? `${title}, ${word.toLowerCase()}` : `${title} at ${formatTime(item.start)}`;
}

/**
 * "Wednesday 21 October, today, Walk-run intervals at 7:00". Without items
 * (still loading) the label stops after the date.
 */
export function dayAccessibilityLabel(
  date: LocalDate,
  items: DayItem[] | undefined,
  { today, plannedThrough }: { today: LocalDate; plannedThrough: LocalDate },
): string {
  const parts = [formatLongDate(date)];
  if (date === today) parts.push('today');
  if (items) {
    if (items.length) parts.push(items.map((item) => itemPhrase(item, today)).join('; '));
    else parts.push(date > plannedThrough ? 'not planned yet' : 'no sessions');
  }
  return parts.join(', ');
}
