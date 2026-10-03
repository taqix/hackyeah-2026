/**
 * What a calendar day holds: plan sessions and extras (workouts added in chat),
 * by start time, and how a day reads to a screen reader.
 */
import type { ActivityLog, Felt, LocalDate, PlannedSession } from '@/api/types';
import { formatLongDate, formatTime, toLocalDate } from '@/lib/dates';
import { sessionLocalDate, sessionStart } from '@/lib/sessions';

export type DayItem =
  | { kind: 'session'; key: string; start: Date; session: PlannedSession }
  | { kind: 'extra'; key: string; start: Date; log: ActivityLog };

/** done is filled, planned is the accent, skipped is a hollow ring. Extras count as done. */
export type MarkState = 'done' | 'planned' | 'skipped';

export function markState(item: DayItem): MarkState {
  if (item.kind === 'extra') return 'done';
  if (item.session.status === 'completed') return 'done';
  if (item.session.status === 'skipped') return 'skipped';
  return 'planned';
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

function itemPhrase(item: DayItem): string {
  const title = itemTitle(item);
  if (item.kind === 'extra') return `${title}, extra, done`;
  const state = markState(item);
  if (state === 'planned') return `${title} at ${formatTime(item.start)}`;
  return `${title}, ${state}`;
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
    if (items.length) parts.push(items.map(itemPhrase).join('; '));
    else parts.push(date > plannedThrough ? 'not planned yet' : 'no sessions');
  }
  return parts.join(', ');
}
