import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { type CalendarPermission, deviceCalendar } from '@/services/calendar';

export type CalendarAccess = { status: 'checking' } | { status: 'error' } | CalendarPermission;

async function readPermission(): Promise<CalendarAccess> {
  try {
    return await deviceCalendar.getPermission();
  } catch {
    return { status: 'error' };
  }
}

/**
 * Device calendar access for Data and privacy. Checks without prompting, again
 * whenever the app returns to the foreground (the person may have changed it in
 * Settings); `connect` asks only from an explicit tap.
 */
export function useCalendarAccess() {
  const [access, setAccess] = useState<CalendarAccess>({ status: 'checking' });
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    let alive = true;
    const check = () => {
      void readPermission().then((next) => {
        if (alive) setAccess(next);
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
  }, []);

  /** Asks the OS (from an explicit tap only) and resolves with the outcome. */
  const connect = async (): Promise<CalendarAccess> => {
    setConnecting(true);
    const next = await deviceCalendar.requestPermission().catch((): CalendarAccess => ({ status: 'error' }));
    setConnecting(false);
    setAccess(next);
    return next;
  };

  const retry = async () => {
    setAccess({ status: 'checking' });
    setAccess(await readPermission());
  };

  return { access, connecting, connect, retry };
}

export type CalendarAccessControls = ReturnType<typeof useCalendarAccess>;
