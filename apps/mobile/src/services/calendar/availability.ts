import { CalendarError } from './types';
import type { CalendarAvailabilityService, CalendarFreeSlot, CalendarService } from './types';
import { validateRange } from './validate-range';

/** Derives availability from the existing calendar API without accessing the OS directly. */
export function createCalendarAvailabilityService(
  calendar: Pick<CalendarService, 'getEvents'>,
): CalendarAvailabilityService {
  return {
    async getFreeSlots(query) {
      validateRange(query.startDate, query.endDate);
      // Keep the query stable while calendar permissions and events are read.
      const start = query.startDate.getTime();
      const end = query.endDate.getTime();
      const blockAllDayEvents = query.blockAllDayEvents === true;
      const events = await calendar.getEvents({
        startDate: new Date(start),
        endDate: new Date(end),
        calendarIds: query.calendarIds === undefined ? undefined : [...query.calendarIds],
      });
      const busy = events
        .filter(
          (event) =>
            event.status !== 'canceled' &&
            event.availability !== 'free' &&
            (!event.allDay || blockAllDayEvents),
        )
        .map((event) => {
          const eventStart = event.startDate.getTime();
          const eventEnd = event.endDate.getTime();
          if (!Number.isFinite(eventStart) || !Number.isFinite(eventEnd) || eventStart > eventEnd) {
            throw new CalendarError(
              'native-error',
              'The calendar returned an invalid event range.',
            );
          }
          return { start: Math.max(start, eventStart), end: Math.min(end, eventEnd) };
        })
        .filter((event) => event.start < event.end)
        .sort((a, b) => a.start - b.start);

      const slots: CalendarFreeSlot[] = [];
      let cursor = start;
      for (const event of busy) {
        if (cursor < event.start) {
          slots.push({ startDate: new Date(cursor), endDate: new Date(event.start) });
        }
        // This also merges overlapping, nested, duplicate, and adjacent events.
        cursor = Math.max(cursor, event.end);
      }
      if (cursor < end) {
        slots.push({ startDate: new Date(cursor), endDate: new Date(end) });
      }
      return slots;
    },
  };
}
