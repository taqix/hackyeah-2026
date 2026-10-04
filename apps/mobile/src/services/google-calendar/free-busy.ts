/**
 * Google free/busy as free time: the busy intervals of the primary calendar
 * turned into the gaps between them, the same shape the device calendar's
 * availability service returns, so planning cuts both into daily slots the
 * same way.
 */
import { debugLog } from '../../lib/debug-log';
import type { FreeTimeSource } from '../calendar/plan-availability';
import type { CalendarFreeSlot } from '../calendar/types';
import type { GoogleCalendarApi } from './api';
import type { BusyInterval } from './types';

/**
 * The free intervals of [startDate, endDate) around `busy`: busy times are
 * clipped to the range, sorted and merged (overlapping, nested and adjacent
 * ones alike). An empty list frees the whole range; a fully busy range gives [].
 * Instants only, so 23- and 25-hour days need nothing special.
 */
export function freeFromBusy(
  busy: readonly BusyInterval[],
  range: { startDate: Date; endDate: Date },
): CalendarFreeSlot[] {
  const start = range.startDate.getTime();
  const end = range.endDate.getTime();
  if (!(start < end)) return [];
  const clipped = busy
    .map((interval) => ({
      start: Math.max(start, interval.startDate.getTime()),
      end: Math.min(end, interval.endDate.getTime()),
    }))
    .filter((interval) => interval.start < interval.end)
    .sort((a, b) => a.start - b.start);
  const free: CalendarFreeSlot[] = [];
  let cursor = start;
  for (const interval of clipped) {
    if (cursor < interval.start) free.push({ startDate: new Date(cursor), endDate: new Date(interval.start) });
    cursor = Math.max(cursor, interval.end);
  }
  if (cursor < end) free.push({ startDate: new Date(cursor), endDate: new Date(end) });
  return free;
}

/** Google Calendar's primary calendar as a free time source (free/busy only, never event details). */
export function googleFreeTimeSource(api: Pick<GoogleCalendarApi, 'freeBusy'>): FreeTimeSource {
  return {
    async freeSlots({ startDate, endDate, timeZone }) {
      const busy = await api.freeBusy({ timeMin: startDate, timeMax: endDate, timeZone });
      const free = freeFromBusy(busy, { startDate, endDate });
      // Counts only: never a busy time or anything about the events behind it.
      debugLog('calendar', `google free/busy: ${busy.length} busy, ${free.length} free intervals`);
      return free;
    },
  };
}
