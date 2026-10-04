import { APP_CALENDAR_TITLE, CalendarError, isAppCalendar } from './types';
import type {
  CalendarEvent,
  CalendarEventPatch,
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
  updateEvent(eventId: string, patch: CalendarEventPatch): Promise<void>;
  deleteEvent(eventId: string): Promise<void>;
  /** Creates a local event calendar with this title (iOS: the default calendar's source, else the local one; Android: a local account). */
  createCalendar(title: string): Promise<DeviceCalendar>;
  deleteCalendar(calendarId: string): Promise<void>;
}

function assertTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat('en', { timeZone });
  } catch {
    throw new CalendarError('invalid-input', 'Provide a valid IANA timeZone.');
  }
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
        assertTimeZone(input.timeZone);
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
    async updateEvent(eventId, patch) {
      if (!eventId.trim()) throw new CalendarError('invalid-input', 'An event id is required.');
      if (patch.title !== undefined && !patch.title.trim()) {
        throw new CalendarError('invalid-input', 'An event title cannot be empty.');
      }
      if ((patch.startDate === undefined) !== (patch.endDate === undefined)) {
        throw new CalendarError('invalid-input', 'Change startDate and endDate together.');
      }
      if (patch.startDate && patch.endDate) validateRange(patch.startDate, patch.endDate);
      if (patch.timeZone !== undefined) assertTimeZone(patch.timeZone);
      const next: CalendarEventPatch = {
        ...patch,
        title: patch.title?.trim(),
        startDate: patch.startDate && new Date(patch.startDate),
        endDate: patch.endDate && new Date(patch.endDate),
      };
      const activeDriver = await requireAccess();
      return run(() => activeDriver.updateEvent(eventId, next));
    },
    async deleteEvent(eventId) {
      if (!eventId.trim()) throw new CalendarError('invalid-input', 'An event id is required.');
      const activeDriver = await requireAccess();
      return run(() => activeDriver.deleteEvent(eventId));
    },
    async ensureAppCalendar() {
      const activeDriver = await requireAccess();
      const calendars = await run(() => activeDriver.listCalendars());
      const existing = calendars.find(isAppCalendar);
      if (existing) return existing;
      const created = await run(() => activeDriver.createCalendar(APP_CALENDAR_TITLE));
      if (!isAppCalendar(created)) {
        throw new CalendarError('calendar-read-only', 'The new calendar does not accept events.');
      }
      return created;
    },
    async deleteAppCalendar() {
      const activeDriver = await requireAccess();
      const calendars = await run(() => activeDriver.listCalendars());
      // Duplicates can only come from an interrupted first export; remove them all.
      const own = calendars.filter(isAppCalendar);
      for (const calendar of own) {
        await run(() => activeDriver.deleteCalendar(calendar.id));
      }
      return own.length > 0;
    },
  };
}
