/**
 * Month arithmetic for the Calendar grid. A month is the LocalDate of its 1st;
 * LocalDates compare correctly as strings.
 */
import type { LocalDate } from '@/api/types';
import { addDays, fromLocalDate, startOfWeek, toLocalDate, weekDates } from '@/lib/dates';

/** The 1st of the month holding this day. */
export function monthOf(date: LocalDate): LocalDate {
  return `${date.slice(0, 7)}-01`;
}

export function addMonths(month: LocalDate, months: number): LocalDate {
  const d = fromLocalDate(month);
  return toLocalDate(new Date(d.getFullYear(), d.getMonth() + months, 1));
}

/** The last day of the month. */
export function monthEnd(month: LocalDate): LocalDate {
  return addDays(addMonths(month, 1), -1);
}

export function isInMonth(date: LocalDate, month: LocalDate): boolean {
  return monthOf(date) === month;
}

/** Monday-first weeks covering the month, with the other months' days at the edges. */
export function monthWeeks(month: LocalDate): LocalDate[][] {
  const last = monthEnd(month);
  const weeks: LocalDate[][] = [];
  for (let monday = startOfWeek(month); monday <= last; monday = addDays(monday, 7)) {
    weeks.push(weekDates(monday));
  }
  return weeks;
}

export function clampMonth(month: LocalDate, min: LocalDate, max: LocalDate): LocalDate {
  if (month < min) return min;
  if (month > max) return max;
  return month;
}

/** The day of the month (1–31). */
export function dayOfMonth(date: LocalDate): number {
  return Number(date.slice(8, 10));
}

/** The same day of the month in another month, or that month's last day when it is shorter. */
export function sameDayIn(month: LocalDate, date: LocalDate): LocalDate {
  const day = Math.min(dayOfMonth(date), dayOfMonth(monthEnd(month)));
  return `${month.slice(0, 8)}${String(day).padStart(2, '0')}`;
}
