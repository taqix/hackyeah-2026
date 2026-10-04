import { useCalendarExportSync } from './use-calendar-export-sync';

/**
 * Copies planned sessions into the "Movo" device calendar while the person has
 * turned that on in Data and privacy. Mount once where the plan is loaded (the
 * tabs); renders nothing.
 */
export function CalendarExportSync() {
  useCalendarExportSync();
  return null;
}
