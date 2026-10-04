/** Pure formatting for the chat cards: diffs, day labels and logged-workout fields. */
import type { ActivityLog, ChangeDiff, ChangeRow, IsoDateTime, LocalDate, MetricValue, SessionRef, SportDefinition } from '@/api/types';
import type { IconName } from '@/components/ui';
import {
  asDate,
  formatDateShort,
  formatDayDate,
  formatDayLong,
  formatDayShort,
  formatMinutes,
  formatTime,
  isSameLocalDate,
  relativeDayName,
} from '@/lib/dates';

/** 'Fri 9': the short day with the day of the month, as change diffs show a day. */
export function dayAndNumber(date: LocalDate): string {
  return `${formatDayShort(date)} ${asDate(date).getDate()}`;
}

/** A card's time: "Just now" for the first minute, then the clock time. */
export function stampLabel(createdAt: IsoDateTime, current: Date): string {
  const age = current.getTime() - asDate(createdAt).getTime();
  return age < 60_000 ? 'Just now' : formatTime(createdAt);
}

/** The session a message is about: "Today · Walk-run intervals", "Fri 9 · Walk-run intervals". */
export function aboutLabel(about: SessionRef, today: Date): string {
  const near = relativeDayName(about.date, today);
  const day = near === 'Today' || near === 'Tomorrow' || near === 'Yesterday' ? near : dayAndNumber(about.date);
  return `${day} · ${about.title}`;
}

/** The day column of a change row: "Fri" over "9 Oct" (or "Today"). */
export function rowDay(date: LocalDate, today: Date): { day: string; date: string } {
  return { day: formatDayShort(date), date: isSameLocalDate(date, today) ? 'Today' : formatDateShort(date) };
}

/** No icon in the Sport row: the sport's disc sits beside it. */
export type DiffView = { icon?: IconName; what: string; from: string | null; to: string };

/** One changed value as shown: duration values are seconds, time values 'H:MM'. */
export function diffView(diff: ChangeDiff): DiffView {
  switch (diff.field) {
    case 'date':
      return { icon: 'calendar-days', what: 'Day', from: diff.from ? dayAndNumber(diff.from) : null, to: dayAndNumber(diff.to) };
    case 'time':
      return { icon: 'clock', what: 'Time', from: diff.from, to: diff.to };
    case 'duration':
      return {
        icon: 'timer',
        what: 'Length',
        from: diff.from === null ? null : formatMinutes(diff.from / 60),
        to: formatMinutes(diff.to / 60),
      };
  }
}

/** What a screen reader hears: "Time changed from 18:00 to 7:00", or "Time 7:00" for a new value. */
export function diffSpeech({ what, from, to }: { what: string; from: string | null; to: string }): string {
  return from ? `${what} changed from ${from} to ${to}` : `${what} ${to}`;
}

/** The whole row in one sentence, so a screen reader reads each session once. */
export function rowSpeech(row: ChangeRow): string {
  const label = row.kind === 'added' ? 'New. ' : row.kind === 'removed' ? 'Removed. ' : '';
  const title = row.was_title ? `was ${row.was_title}, now ${row.title}` : row.title;
  const day = `${formatDayLong(row.date)} ${formatDateShort(row.date)}`;
  const parts = [`${label}${day}: ${title}`, ...row.diffs.map((d) => diffSpeech(diffView(d)))];
  if (row.note) parts.push(row.note);
  return parts.join('. ');
}

/** "Today · Thu 8 Oct", "Yesterday · Tue 6 Oct", or just "Mon 5 Oct" further back. */
export function logWhen(log: ActivityLog, today: Date): string {
  const near = relativeDayName(log.started_at, today);
  const date = formatDayDate(log.started_at);
  return near === 'Today' || near === 'Yesterday' ? `${near} · ${date}` : date;
}

function metricText(value: MetricValue, unit: string | undefined): string {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return unit ? `${value} ${unit}` : String(value);
}

export type LogFact = { label: string; value: string };

/** Every field as saved, in the sport's catalog metrics, so a misreading is easy to spot. */
export function logFacts(log: ActivityLog, sport: SportDefinition | undefined): LogFact[] {
  const facts: LogFact[] = [];
  let hasDuration = false;
  if (sport && sport.is_gym === 0) {
    for (const metric of sport.metrics) {
      const value = log.metrics[metric.key];
      if (value === undefined || value === null || value === '') continue;
      if (metric.represents_session_duration && typeof value === 'number') {
        hasDuration = true;
        facts.push({ label: metric.description, value: formatMinutes(value / 60) });
      } else {
        facts.push({ label: metric.description, value: metricText(value, metric.unit) });
      }
    }
  }
  if (!hasDuration) facts.unshift({ label: 'Time', value: formatMinutes(log.duration_seconds / 60) });
  if (log.sets.length) facts.push({ label: 'Sets', value: String(log.sets.length) });
  return facts;
}
