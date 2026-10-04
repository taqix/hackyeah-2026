import type { LocalDate } from '@/api/types';
import { diffDays, formatDayLong, fromLocalDate, MONTHS_LONG, startOfWeek } from '@/lib/dates';

import { dayOfMonth } from './month';

/** The plan week a day falls in (1 for the first week), or null before the plan starts. */
export function planWeek(date: LocalDate, firstWeekStart: LocalDate | null): number | null {
  if (!firstWeekStart || date < firstWeekStart) return null;
  return Math.floor(diffDays(firstWeekStart, startOfWeek(date)) / 7) + 1;
}

/** "Wednesday, 21 October · Week 3" */
export function headerKicker(today: LocalDate, firstWeekStart: LocalDate | null): string {
  const date = `${formatDayLong(today)}, ${dayOfMonth(today)} ${MONTHS_LONG[fromLocalDate(today).getMonth()]}`;
  const week = planWeek(today, firstWeekStart);
  return week ? `${date} · Week ${week}` : date;
}
