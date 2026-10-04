import { useCalendarExportSync } from './use-calendar-export-sync';

/**
 * Copies planned sessions into the "Movo" calendar (on the device, or in
 * Google Calendar) while the person has turned that on in Data and privacy.
 * Mount once where the plan is loaded (the tabs); renders nothing.
 */
export function CalendarExportSync() {
  useCalendarExportSync();
  return null;
}
