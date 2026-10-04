/**
 * Calendar writes for the export, one at a time: to the device's Movo calendar
 * or to the Movo calendar in Google Calendar, whichever the person chose. A
 * sync never overlaps another sync or the removal of a Movo calendar.
 * Failures become a quiet status per target that Data and privacy shows; the
 * next change or return to the app tries again.
 */
import { useSyncExternalStore } from 'react';

import { getRemoteRuntime } from '@/api/remote/default';
import { debugLog, debugWarn, describeError, errorLabel, startTimer } from '@/lib/debug-log';
import {
  CalendarError,
  type ExportRange,
  type ExportSession,
  removeAppCalendar,
  syncPlanToCalendar,
} from '@/services/calendar';
import { isGoogleCalendarError } from '@/services/google-calendar';
import { isCalendarExportEnabled } from '@/state/calendar-export';

export type CalendarExportStatus = 'idle' | 'syncing' | 'failed';
export type CalendarExportTarget = 'device' | 'google';

const statuses: Record<CalendarExportTarget, CalendarExportStatus> = { device: 'idle', google: 'idle' };
const listeners = new Set<() => void>();
let tail: Promise<unknown> = Promise.resolve();

function setStatus(next: CalendarExportStatus, target: CalendarExportTarget = 'device') {
  if (next === statuses[target]) return;
  statuses[target] = next;
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
    const took = startTimer();
    try {
      const result = await syncPlanToCalendar(sessions, range);
      const { created, updated, deleted } = result;
      debugLog('calendar', `export sync ${took()}: created ${created}, updated ${updated}, deleted ${deleted}`, {
        sessions: sessions.length,
      });
      setStatus('idle');
    } catch (error) {
      debugWarn('calendar', `✕ export sync ${took()} ${errorLabel(error)}`, () => describeError(error));
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
      const removed = await removeAppCalendar();
      debugLog('calendar', `export calendar ${removed ? 'removed' : 'was already gone'}`);
    } catch (error) {
      debugWarn('calendar', `✕ export calendar removal ${errorLabel(error)}`, () => describeError(error));
      if (!isAccessError(error)) throw error;
    } finally {
      setStatus('idle');
    }
  });
}

/**
 * Brings the Movo calendar in Google in line with these sessions, when the
 * person turned that on and Google Calendar is connected. Never rejects. A
 * refused Google token is not a failure here: the row asks to reconnect.
 */
export function syncGoogleCalendarExport(sessions: ExportSession[], range: ExportRange): Promise<void> {
  return serialize(async () => {
    setStatus('syncing', 'google');
    const took = startTimer();
    try {
      const result = await getRemoteRuntime().googleCalendar.syncExport(sessions, range);
      if (result) {
        const { created, updated, deleted } = result;
        debugLog('calendar', `google export sync ${took()}: created ${created}, updated ${updated}, deleted ${deleted}`, {
          sessions: sessions.length,
        });
      }
      setStatus('idle', 'google');
    } catch (error) {
      debugWarn('calendar', `✕ google export sync ${took()} ${errorLabel(error)}`, () => describeError(error));
      setStatus(isGoogleCalendarError(error, 'reconnect_required') ? 'idle' : 'failed', 'google');
    }
  });
}

/** Deletes the Movo calendar from Google with its events, after any running sync. Errors reject. */
export function removeGoogleCalendarExport(): Promise<boolean> {
  return serialize(async () => {
    try {
      const removed = await getRemoteRuntime().googleCalendar.removeExportCalendar();
      debugLog('calendar', `google export calendar ${removed ? 'removed' : 'was already gone'}`);
      return removed;
    } finally {
      setStatus('idle', 'google');
    }
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The export's state for one target: the device's Movo calendar by default, or Google's. */
export function useCalendarExportStatus(target: CalendarExportTarget = 'device'): CalendarExportStatus {
  return useSyncExternalStore(subscribe, () => statuses[target], () => statuses[target]);
}
