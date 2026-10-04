import { createCalendarService } from './service';

// Metro uses device-calendar.native.ts on iOS/Android. Web never loads Expo Calendar.
export const deviceCalendar = createCalendarService(null);

/**
 * Whether this platform has a device calendar at all. The web has none: every
 * call reports `unavailable`, plans use Google Calendar or the preferred times,
 * and nothing is exported to a device calendar.
 */
export const deviceCalendarSupported: boolean = false;
