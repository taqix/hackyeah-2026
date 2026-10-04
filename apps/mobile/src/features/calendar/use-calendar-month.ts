import { useState } from 'react';

import { useSessionsInRange } from '@/api/hooks';
import type { LocalDate } from '@/api/types';

import { groupByDay } from './day-items';
import { addMonths, clampMonth, isInMonth, monthEnd, monthOf } from './month';

export type CalendarBounds = { today: LocalDate; firstWeekStart: LocalDate; plannedThrough: LocalDate };

/**
 * The month on show, the selected day and that month's sessions. The month
 * pages back to the first week and stops at the last planned day; a month
 * without a picked day opens on today, else its first day of the plan, else
 * the 1st.
 */
export function useCalendarMonth({ today, firstWeekStart, plannedThrough }: CalendarBounds) {
  const minMonth = monthOf(firstWeekStart);
  const maxMonth = monthOf(plannedThrough) < minMonth ? minMonth : monthOf(plannedThrough);
  const [pickedMonth, setPickedMonth] = useState<LocalDate | null>(null);
  const [pickedDay, setPickedDay] = useState<LocalDate | null>(null);
  const month = clampMonth(pickedMonth ?? monthOf(today), minMonth, maxMonth);
  const selected = pickedDay && isInMonth(pickedDay, month) ? pickedDay : defaultDay(month, today, firstWeekStart);

  const range = useSessionsInRange(month, monthEnd(month));
  const days = range.data ? groupByDay(range.data.sessions, range.data.extras) : undefined;

  return {
    month,
    selected,
    range,
    /** Sessions and extras by day; undefined while the first month loads. */
    days,
    previous: addMonths(month, -1),
    next: addMonths(month, 1),
    canGoBack: month > minMonth,
    canGoForward: month < maxMonth,
    /** Pages to a month; its day falls back to the default unless one was picked there. */
    showMonth: setPickedMonth,
    /** Picks a day of the month on show. */
    select: setPickedDay,
    /** Opens a day's month and picks the day; false when that month is out of range. */
    showDay: (date: LocalDate): boolean => {
      const target = monthOf(date);
      if (target < minMonth || target > maxMonth) return false;
      setPickedMonth(target);
      setPickedDay(date);
      return true;
    },
  };
}

export type CalendarMonth = ReturnType<typeof useCalendarMonth>;

function defaultDay(month: LocalDate, today: LocalDate, firstWeekStart: LocalDate): LocalDate {
  if (isInMonth(today, month)) return today;
  if (isInMonth(firstWeekStart, month)) return firstWeekStart;
  return month;
}
