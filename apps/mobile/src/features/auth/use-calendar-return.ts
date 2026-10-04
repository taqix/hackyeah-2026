import { useEffect, useState } from 'react';

import { isMockMode } from '@/api/config';
import { getRemoteRuntime } from '@/api/remote/default';
import type { GoogleConnectOrigin } from '@/api/remote/google-calendar';

export type CalendarReturn = 'checking' | 'none' | GoogleConnectOrigin;

/**
 * Whether this /auth/callback belongs to a Google Calendar connect (the web
 * page that loads after Google, or the Android deep link), and which screen
 * started it: Data and privacy (`privacy`) or onboarding Review (`review`).
 * The callback screen sends the person back there instead of to Home.
 * 'checking' until the pending connect has been read.
 */
export function useCalendarReturn(): CalendarReturn {
  const [state, setState] = useState<CalendarReturn>(isMockMode ? 'none' : 'checking');

  useEffect(() => {
    if (isMockMode) return;
    let live = true;
    getRemoteRuntime()
      .googleCalendar.returnTo()
      .then(
        (origin) => origin,
        () => null,
      )
      .then((origin) => {
        if (live) setState(origin ?? 'none');
      });
    return () => {
      live = false;
    };
  }, []);

  return state;
}
