import { createCalendarAvailabilityService } from './availability';
import { deviceCalendar } from './device-calendar';

export const deviceCalendarAvailability = createCalendarAvailabilityService(deviceCalendar);
export { createCalendarAvailabilityService } from './availability';
export { deviceCalendar } from './device-calendar';
export { CalendarError } from './types';
export {
  captureAvailability,
  DEFAULT_WINDOW,
  manualAvailability,
  MAX_SLOTS,
  type Availability,
  type AvailabilitySlot,
  type CaptureAvailability,
  type CaptureAvailabilityOptions,
} from './plan-availability';
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
