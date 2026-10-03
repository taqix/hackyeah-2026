/**
 * Device-local calendar helpers with hand-rolled English names (no Intl), so
 * every platform formats the same way. A `LocalDate` is `YYYY-MM-DD` in the
 * device's time zone. Pure: imported by the mock backend and its Node tests.
 */
import type { IsoDateTime, LocalDate } from '../api/types';

export const WEEKDAYS_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
export const WEEKDAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;
export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** A day or an instant: a `LocalDate`, an ISO instant, or a Date. */
export type DateLike = Date | LocalDate | IsoDateTime;

const pad = (n: number) => String(n).padStart(2, '0');
const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Local midnight of a `YYYY-MM-DD` day. */
export function fromLocalDate(date: LocalDate): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Any DateLike as a Date (a LocalDate becomes its local midnight). */
export function asDate(value: DateLike): Date {
  if (value instanceof Date) return value;
  return LOCAL_DATE.test(value) ? fromLocalDate(value) : new Date(value);
}

/** The device-local calendar day of a moment. */
export function toLocalDate(value: DateLike): LocalDate {
  if (typeof value === 'string' && LOCAL_DATE.test(value)) return value;
  const d = asDate(value);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const d = fromLocalDate(date);
  return toLocalDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + days));
}

/** Whole days from `a` to `b` (positive when b is later). */
export function diffDays(a: LocalDate, b: LocalDate): number {
  const da = fromLocalDate(a);
  const db = fromLocalDate(b);
  return Math.round((Date.UTC(db.getFullYear(), db.getMonth(), db.getDate()) -
    Date.UTC(da.getFullYear(), da.getMonth(), da.getDate())) / 86_400_000);
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(value: DateLike): number {
  return (asDate(value).getDay() + 6) % 7;
}

/** The Monday of the week holding this day. */
export function startOfWeek(value: DateLike): LocalDate {
  const day = toLocalDate(value);
  return addDays(day, -weekdayIndex(day));
}

/** Monday to Sunday. */
export function weekDates(weekStart: LocalDate): LocalDate[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function isSameLocalDate(a: DateLike, b: DateLike): boolean {
  return toLocalDate(a) === toLocalDate(b);
}

/** A local day at a wall-clock time. */
export function atLocalTime(date: LocalDate, hour: number, minute = 0): Date {
  const d = fromLocalDate(date);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, minute);
}

/** ISO 8601 with the device's offset for that moment: 2026-10-07T07:00:00+02:00. */
export function toIsoWithOffset(date: Date): IsoDateTime {
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const abs = Math.abs(offset);
  return (
    `${toLocalDate(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

/** Minutes since local midnight. */
export function minutesOfDay(value: DateLike): number {
  const d = asDate(value);
  return d.getHours() * 60 + d.getMinutes();
}

/** '7:00', '18:30': 24 h, no leading zero. */
export function formatTime(value: DateLike): string {
  const d = asDate(value);
  return `${d.getHours()}:${pad(d.getMinutes())}`;
}

/** '7:00' from minutes since midnight. */
export function formatClock(minutes: number): string {
  return `${Math.floor(minutes / 60)}:${pad(minutes % 60)}`;
}

/** 'Wed' */
export function formatDayShort(value: DateLike): string {
  return WEEKDAYS_SHORT[weekdayIndex(value)];
}

/** 'Wednesday' */
export function formatDayLong(value: DateLike): string {
  return WEEKDAYS_LONG[weekdayIndex(value)];
}

/** '7 Oct' */
export function formatDateShort(value: DateLike): string {
  const d = asDate(value);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

/** 'Wed 7 Oct' */
export function formatDayDate(value: DateLike): string {
  return `${formatDayShort(value)} ${formatDateShort(value)}`;
}

/** 'Wednesday 7 October' */
export function formatLongDate(value: DateLike): string {
  const d = asDate(value);
  return `${formatDayLong(d)} ${d.getDate()} ${MONTHS_LONG[d.getMonth()]}`;
}

/** 'October 2026' */
export function formatMonthYear(value: DateLike): string {
  const d = asDate(value);
  return `${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

/** '5–11 Oct', or '28 Sep – 4 Oct' across months. */
export function formatWeekRange(weekStart: LocalDate): string {
  const start = fromLocalDate(weekStart);
  const end = fromLocalDate(addDays(weekStart, 6));
  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()}–${end.getDate()} ${MONTHS_SHORT[end.getMonth()]}`;
  }
  return `${formatDateShort(start)} – ${formatDateShort(end)}`;
}

/** 'this week' | 'last week' | 'next week', or null further away. */
export function relativeWeekLabel(weekStart: LocalDate, today: DateLike): 'this week' | 'last week' | 'next week' | null {
  const weeks = diffDays(startOfWeek(today), weekStart) / 7;
  if (weeks === 0) return 'this week';
  if (weeks === -1) return 'last week';
  if (weeks === 1) return 'next week';
  return null;
}

/** 'Good morning' until 12:00, 'Good afternoon' until 18:00, then 'Good evening'. */
export function greeting(date: Date): 'Good morning' | 'Good afternoon' | 'Good evening' {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

/** '20 min', '1 h', '1 h 30 min'. */
export function formatMinutes(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} h ${rest} min` : `${h} h`;
}

/** 'Today', 'Tomorrow', 'Yesterday', or the weekday name. */
export function relativeDayName(date: DateLike, today: DateLike): string {
  const days = diffDays(toLocalDate(today), toLocalDate(date));
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  return formatDayLong(date);
}

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

/** 'three'; digits above ten. */
export function numberWord(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}

/** 'Three' */
export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** 'a, b and c' */
export function joinAnd(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}
