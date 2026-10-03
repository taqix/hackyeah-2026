import { CalendarError } from './types';
import type {
  CalendarEvent,
  CalendarPermission,
  CalendarService,
  DeviceCalendar,
  NewCalendarEvent,
} from './types';
import { validateRange } from './validate-range';

/** Internal boundary; keeps OS objects and Expo imports out of consumers/tests. */
export interface CalendarDriver {
  getPermission(): Promise<CalendarPermission>;
  requestPermission(): Promise<CalendarPermission>;
  listCalendars(): Promise<DeviceCalendar[]>;
  getEvents(ids: string[], startDate: Date, endDate: Date): Promise<CalendarEvent[]>;
  createEvent(event: NewCalendarEvent): Promise<CalendarEvent>;
}

function isMidnight(date: Date) {
  return (
    date.getHours() === 0 && date.getMinutes() === 0 &&
    date.getSeconds() === 0 && date.getMilliseconds() === 0
  );
}

export function createCalendarService(driver: CalendarDriver | null): CalendarService {
  async function run<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof CalendarError) throw error;
      throw new CalendarError('native-error', 'The device calendar operation failed.', { cause: error });
    }
  }

  async function getPermission(): Promise<CalendarPermission> {
    if (!driver) return { status: 'unavailable', canAskAgain: false };
    return run(() => driver.getPermission());
  }

  async function requireAccess(): Promise<CalendarDriver> {
    const permission = await getPermission();
    if (!driver || permission.status === 'unavailable') {
      throw new CalendarError('unavailable', 'Device calendars require an iOS or Android development build.');
    }
    if (permission.status !== 'granted') {
      throw new CalendarError('permission-denied', 'Full calendar access is required.', { permission });
    }
    return driver;
  }

  return {
    getPermission,
    async requestPermission() {
      const current = await getPermission();
      if (!driver || current.status === 'granted' || !current.canAskAgain) return current;
      return run(() => driver.requestPermission());
    },
    async listCalendars(options = {}) {
      const activeDriver = await requireAccess();
      const calendars = await run(() => activeDriver.listCalendars());
      return options.writableOnly
        ? calendars.filter((calendar) => calendar.allowsModifications)
        : calendars;
    },
    async getEvents(query) {
      validateRange(query.startDate, query.endDate);
      // Snapshot mutable inputs before the first await.
      const startDate = new Date(query.startDate);
      const endDate = new Date(query.endDate);
      const requestedIds = query.calendarIds === undefined
        ? undefined
        : [...new Set(query.calendarIds)];
      const activeDriver = await requireAccess();
      if (requestedIds?.length === 0) return [];
      const calendars = await run(() => activeDriver.listCalendars());
      const ids = requestedIds ?? calendars.map((calendar) => calendar.id);
      if (ids.some((id) => !calendars.some((calendar) => calendar.id === id))) {
        throw new CalendarError('calendar-not-found', 'A selected calendar is no longer available.');
      }
      if (ids.length === 0) return [];

      // EventKit silently truncates queries longer than four years. Bounded chunks
      // also keep individual native requests manageable on both platforms.
      const chunkDuration = 365 * 24 * 60 * 60 * 1000;
      const events = new Map<string, CalendarEvent>();
      for (let start = startDate.getTime(); start < endDate.getTime(); start += chunkDuration) {
        const chunkEnd = new Date(Math.min(start + chunkDuration, endDate.getTime()));
        const found = await run(() => activeDriver.getEvents(ids, new Date(start), chunkEnd));
        for (const event of found) {
          const overlaps = event.startDate < endDate && event.endDate > startDate;
          const isPointInRange = (
            event.startDate.getTime() === event.endDate.getTime() &&
            event.startDate >= startDate && event.startDate < endDate
          );
          if (ids.includes(event.calendarId) && (overlaps || isPointInRange)) {
            events.set(event.occurrenceKey, event);
          }
        }
      }
      return [...events.values()].sort((a, b) => (
        a.startDate.getTime() - b.startDate.getTime() ||
        a.occurrenceKey.localeCompare(b.occurrenceKey)
      ));
    },
    async createEvent(input) {
      validateRange(input.startDate, input.endDate);
      if (!input.title.trim() || !input.calendarId.trim()) {
        throw new CalendarError('invalid-input', 'An event title and calendarId are required.');
      }
      if (input.allDay && (!isMidnight(input.startDate) || !isMidnight(input.endDate))) {
        throw new CalendarError('invalid-input', 'All-day events require local midnight dates and an exclusive end date.');
      }
      if (input.timeZone !== undefined) {
        if (input.allDay) throw new CalendarError('invalid-input', 'All-day events use device-local dates.');
        try {
          new Intl.DateTimeFormat('en', { timeZone: input.timeZone });
        } catch {
          throw new CalendarError('invalid-input', 'Provide a valid IANA timeZone.');
        }
      }
      const event = {
        ...input,
        title: input.title.trim(),
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
      };
      const activeDriver = await requireAccess();
      const calendars = await run(() => activeDriver.listCalendars());
      const calendar = calendars.find((candidate) => candidate.id === event.calendarId);
      if (!calendar) {
        throw new CalendarError('calendar-not-found', 'The selected calendar is no longer available.');
      }
      if (!calendar.allowsModifications) {
        throw new CalendarError('calendar-read-only', 'Choose a writable calendar.');
      }
      // Never retry writes automatically: a native failure may follow a successful save.
      return run(() => activeDriver.createEvent(event));
    },
  };
}
