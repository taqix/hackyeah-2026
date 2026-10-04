export type CalendarPermission = {
  status: 'undetermined' | 'denied' | 'granted' | 'unavailable';
  canAskAgain: boolean;
};

export type DeviceCalendar = {
  id: string;
  title: string;
  color?: string;
  source: string;
  allowsModifications: boolean;
  /** Android: hidden calendars are not included in OS event queries. */
  isVisible?: boolean;
};

export type CalendarEvent = {
  id: string;
  /** Use this as a list key: recurring occurrences can share an event ID. */
  occurrenceKey: string;
  calendarId: string;
  title: string;
  startDate: Date;
  endDate: Date;
  allDay: boolean;
  location: string | null;
  notes: string | null;
  availability: 'busy' | 'free' | 'tentative' | 'unavailable' | 'notSupported';
  status: 'none' | 'confirmed' | 'tentative' | 'canceled';
};

export type CalendarEventQuery = {
  /** Half-open interval [startDate, endDate); overlapping events are included. */
  startDate: Date;
  endDate: Date;
  /** Omit to read all event calendars. An empty array reads none. */
  calendarIds?: readonly string[];
};

/** A maximal free interval [startDate, endDate), clipped to the query. */
export type CalendarFreeSlot = {
  startDate: Date;
  endDate: Date;
};

export type CalendarAvailabilityQuery = CalendarEventQuery & {
  /** Defaults to false: all-day entries such as holidays do not block time. */
  blockAllDayEvents?: boolean;
};

export interface CalendarAvailabilityService {
  /**
   * Returns free intervals in chronological order. Canceled, free, and zero-length
   * events do not block time. All-day events block only when blockAllDayEvents is true.
   * Requires existing calendar access; never prompts or suppresses read errors.
   */
  getFreeSlots(query: CalendarAvailabilityQuery): Promise<CalendarFreeSlot[]>;
}

export type NewCalendarEvent = {
  calendarId: string;
  title: string;
  startDate: Date;
  endDate: Date;
  location?: string;
  notes?: string;
} & (
  | { allDay: true; timeZone?: never }
  | { allDay?: false; timeZone?: string }
);

/** Timed-event fields to change; omitted fields keep their value. */
export type CalendarEventPatch = {
  title?: string;
  startDate?: Date;
  endDate?: Date;
  notes?: string;
  timeZone?: string;
};

/** The title of the calendar the app creates for exported sessions. */
export const APP_CALENDAR_TITLE = 'Movo';

/** The app's own export calendar: writable and titled "Movo". */
export function isAppCalendar(calendar: DeviceCalendar): boolean {
  return calendar.title === APP_CALENDAR_TITLE && calendar.allowsModifications;
}

export interface CalendarService {
  /** Checks current OS access without prompting; also safe on web and Expo Go. */
  getPermission(): Promise<CalendarPermission>;
  /** Call from an explicit user action. Requests full read/write event access. */
  requestPermission(): Promise<CalendarPermission>;
  listCalendars(options?: { writableOnly?: boolean }): Promise<DeviceCalendar[]>;
  getEvents(query: CalendarEventQuery): Promise<CalendarEvent[]>;
  /** All-day dates must be device-local midnight, with an exclusive end date. */
  createEvent(event: NewCalendarEvent): Promise<CalendarEvent>;
  /** Changes a timed event; never retried automatically. */
  updateEvent(eventId: string, patch: CalendarEventPatch): Promise<void>;
  deleteEvent(eventId: string): Promise<void>;
  /** The app's "Movo" calendar, created on this device the first time it is needed. */
  ensureAppCalendar(): Promise<DeviceCalendar>;
  /** Deletes the app's calendar and every event in it. False when there was none. */
  deleteAppCalendar(): Promise<boolean>;
}

export type CalendarErrorCode =
  | 'unavailable'
  | 'permission-denied'
  | 'invalid-input'
  | 'calendar-not-found'
  | 'calendar-read-only'
  | 'native-error';

export class CalendarError extends Error {
  readonly code: CalendarErrorCode;
  readonly permission?: CalendarPermission;

  constructor(
    code: CalendarErrorCode,
    message: string,
    options?: { cause?: unknown; permission?: CalendarPermission },
  ) {
    super(message, { cause: options?.cause });
    this.name = 'CalendarError';
    this.code = code;
    this.permission = options?.permission;
  }
}
