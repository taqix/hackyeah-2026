import { createCalendarAvailabilityService } from './availability';
import { deviceCalendar } from './device-calendar';

export const deviceCalendarAvailability = createCalendarAvailabilityService(deviceCalendar);
export { createCalendarAvailabilityService } from './availability';
export { deviceCalendar } from './device-calendar';
export { CalendarError } from './types';
export type {
  CalendarAvailabilityQuery,
  CalendarAvailabilityService,
  CalendarErrorCode,
  CalendarEvent,
  CalendarEventQuery,
  CalendarFreeSlot,
  CalendarPermission,
  CalendarService,
  DeviceCalendar,
  NewCalendarEvent,
} from './types';
