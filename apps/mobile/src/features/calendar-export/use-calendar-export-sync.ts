import { useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import { usePlanState, useSessionsInRange } from '@/api/hooks';
import { useNow } from '@/lib/clock';
import { toLocalDate } from '@/lib/dates';
import { deviceCalendar } from '@/services/calendar';
import { useCalendarExportSetting } from '@/state/calendar-export';
import { useGoogleCalendar } from '@/state/google-calendar';

import { syncCalendarExport, syncGoogleCalendarExport } from './export-queue';
import { exportRange, exportSessionsFrom } from './export-sessions';

/** Plan reads settle (and chat changes land) before the calendar is touched. */
const DEBOUNCE_MS = 1_500;

function deviceTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Calendar access while the export is on, checked without prompting and again
 * whenever the app returns to the foreground. `checks` counts the checks, so a
 * return to the app also retries a sync that failed.
 */
function useExportAccess(enabled: boolean) {
  const [access, setAccess] = useState({ granted: false, checks: 0 });

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const check = () => {
      deviceCalendar
        .getPermission()
        .then((permission) => permission.status === 'granted', () => false)
        .then((granted) => {
          if (alive) setAccess((current) => ({ granted, checks: current.checks + 1 }));
        });
    };
    check();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => {
      alive = false;
      subscription.remove();
    };
  }, [enabled]);

  return access;
}

/** Counts returns to the foreground while `enabled`, so a failed sync is tried again. */
function useForegrounds(enabled: boolean) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setCount((current) => current + 1);
    });
    return () => subscription.remove();
  }, [enabled]);
  return count;
}

/**
 * Keeps the "Movo" calendar in step with the plan from today through the last
 * planned day: on the device while Add sessions to my calendar is on and
 * access is granted, in Google while Add sessions to Google Calendar is on and
 * Google Calendar is connected. Writes are debounced and run one at a time;
 * failures stay quiet.
 */
export function useCalendarExportSync(): void {
  const setting = useCalendarExportSetting();
  const access = useExportAccess(setting.enabled);
  const google = useGoogleCalendar().status;
  const toGoogle = !!google?.connected && !google.needsReconnect && google.exportEnabled;
  const foregrounds = useForegrounds(toGoogle);
  const toDevice = setting.enabled && access.granted;
  const plan = usePlanState();
  const today = toLocalDate(useNow());
  const plannedThrough = plan.data?.planned_through ?? null;
  const active = (toDevice || toGoogle) && !!plannedThrough && plannedThrough >= today;
  const range = useSessionsInRange(active ? today : null, active ? plannedThrough : null);
  // A previous range's placeholder would delete this range's events.
  const sessions = active && range.data && !range.isPlaceholderData ? range.data.sessions : null;

  const job = useMemo(
    () =>
      sessions && plannedThrough
        ? { sessions: exportSessionsFrom(sessions, deviceTimeZone()), range: exportRange(today, plannedThrough) }
        : null,
    [sessions, today, plannedThrough],
  );

  useEffect(() => {
    if (!job) return;
    const timer = setTimeout(() => {
      if (toDevice) void syncCalendarExport(job.sessions, job.range);
      if (toGoogle) void syncGoogleCalendarExport(job.sessions, job.range);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [job, access.checks, foregrounds, toDevice, toGoogle]);
}
