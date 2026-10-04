import { createCalendarAvailabilityService } from './availability';
import { deviceCalendar } from './device-calendar';

export const deviceCalendarAvailability = createCalendarAvailabilityService(deviceCalendar);
export { createCalendarAvailabilityService } from './availability';
export { deviceCalendar } from './device-calendar';
export { APP_CALENDAR_TITLE, CalendarError, isAppCalendar } from './types';
export {
  captureAvailability,
  DEFAULT_WINDOW,
  deviceTimeZone,
  manualAvailability,
  MAX_SLOTS,
  toDailySlots,
  type Availability,
  type AvailabilitySlot,
  type AvailabilitySources,
  type CaptureAvailability,
  type CaptureAvailabilityOptions,
  type FreeTimeSource,
} from './plan-availability';
export {
  removeAppCalendar,
  syncPlanToCalendar,
  type ExportRange,
  type ExportResult,
  type ExportSession,
} from './plan-export';
export type {
  CalendarAvailabilityQuery,
  CalendarAvailabilityService,
  CalendarErrorCode,
  CalendarEvent,
  CalendarEventPatch,
  CalendarEventQuery,
  CalendarFreeSlot,
  CalendarPermission,
  CalendarService,
  DeviceCalendar,
  NewCalendarEvent,
} from './types';
