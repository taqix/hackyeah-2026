import type { LocalDate } from '@/api/types';
import { addDays, startOfWeek } from '@/lib/dates';

import { addMonths, monthOf, sameDayIn } from './month';

/** The DOM id of a day's tile on the desktop board, so a key move can focus it. */
export function dayCellId(date: LocalDate): string {
  return `calendar-day-${date}`;
}

/**
 * Where a key moves the selected day, as in a date picker: ← → a day, ↑ ↓ a
 * week, Home and End the week's ends, Page Up and Page Down a month. Null for
 * any other key.
 */
export function dayKeyTarget(key: string, from: LocalDate): LocalDate | null {
  switch (key) {
    case 'ArrowLeft':
      return addDays(from, -1);
    case 'ArrowRight':
      return addDays(from, 1);
    case 'ArrowUp':
      return addDays(from, -7);
    case 'ArrowDown':
      return addDays(from, 7);
    case 'Home':
      return startOfWeek(from);
    case 'End':
      return addDays(startOfWeek(from), 6);
    case 'PageUp':
      return sameDayIn(addMonths(monthOf(from), -1), from);
    case 'PageDown':
      return sameDayIn(addMonths(monthOf(from), 1), from);
    default:
      return null;
  }
}
