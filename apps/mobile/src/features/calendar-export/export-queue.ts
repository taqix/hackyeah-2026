/**
 * Device calendar writes for the export, one at a time: a sync never overlaps
 * another sync or the removal of the Movo calendar. Failures become a quiet
 * status that Data and privacy shows; the next change or return to the app
 * tries again.
 */
import { useSyncExternalStore } from 'react';

import {
  CalendarError,
  type ExportRange,
  type ExportSession,
  removeAppCalendar,
  syncPlanToCalendar,
} from '@/services/calendar';
import { isCalendarExportEnabled } from '@/state/calendar-export';

export type CalendarExportStatus = 'idle' | 'syncing' | 'failed';

let status: CalendarExportStatus = 'idle';
const listeners = new Set<() => void>();
let tail: Promise<unknown> = Promise.resolve();

function setStatus(next: CalendarExportStatus) {
  if (next === status) return;
  status = next;
  for (const listener of listeners) listener();
}

function serialize<T>(task: () => Promise<T>): Promise<T> {
  const run = tail.then(task, task);
  tail = run.catch(() => undefined);
  return run;
}

function isAccessError(error: unknown): boolean {
  return error instanceof CalendarError && (error.code === 'permission-denied' || error.code === 'unavailable');
}

/** Brings the Movo calendar in line with these sessions. Never rejects. */
export function syncCalendarExport(sessions: ExportSession[], range: ExportRange): Promise<void> {
  return serialize(async () => {
    // Turned off while this waited: the removal queued behind it owns the calendar now.
    if (!isCalendarExportEnabled()) return;
    setStatus('syncing');
    try {
      await syncPlanToCalendar(sessions, range);
      setStatus('idle');
    } catch (error) {
      // Access taken away in Settings is not a failure to report here; the row shows it.
      setStatus(isAccessError(error) ? 'idle' : 'failed');
    }
  });
}

/**
 * Deletes the Movo calendar and its events. Without calendar access there is
 * nothing the app can read or remove, so that resolves too; other errors reject.
 */
export function removeCalendarExport(): Promise<void> {
  return serialize(async () => {
    try {
      await removeAppCalendar();
    } catch (error) {
      if (!isAccessError(error)) throw error;
    } finally {
      setStatus('idle');
    }
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useCalendarExportStatus(): CalendarExportStatus {
  return useSyncExternalStore(subscribe, () => status, () => status);
}
