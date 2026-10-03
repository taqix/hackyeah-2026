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

export interface CalendarService {
  /** Checks current OS access without prompting; also safe on web and Expo Go. */
  getPermission(): Promise<CalendarPermission>;
  /** Call from an explicit user action. Requests full read/write event access. */
  requestPermission(): Promise<CalendarPermission>;
  listCalendars(options?: { writableOnly?: boolean }): Promise<DeviceCalendar[]>;
  getEvents(query: CalendarEventQuery): Promise<CalendarEvent[]>;
  /** All-day dates must be device-local midnight, with an exclusive end date. */
  createEvent(event: NewCalendarEvent): Promise<CalendarEvent>;
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
