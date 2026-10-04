import { useEffect, useState } from 'react';

import { isMockMode } from '@/api/config';
import { getRemoteRuntime } from '@/api/remote/default';

/**
 * Whether this /auth/callback belongs to a Google Calendar connect started on
 * Data and privacy (the web page that loads after Google, or the Android deep
 * link), so the screen sends the person back there instead of to Home.
 * 'checking' until the pending connect has been read.
 */
export function useCalendarReturn(): 'checking' | 'calendar' | 'none' {
  const [state, setState] = useState<'checking' | 'calendar' | 'none'>(isMockMode ? 'none' : 'checking');

  useEffect(() => {
    if (isMockMode) return;
    let live = true;
    getRemoteRuntime()
      .googleCalendar.returnsToCalendar()
      .then(
        (calendar) => calendar,
        () => false,
      )
      .then((calendar) => {
        if (live) setState(calendar ? 'calendar' : 'none');
      });
    return () => {
      live = false;
    };
  }, []);

  return state;
}
