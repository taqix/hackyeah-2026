/**
 * Google Calendar for the signed-in account (Data and privacy, the export
 * sync): whether it is connected, the Google email, and the two choices. Read
 * from the remote runtime and reloaded whenever the connection or a choice
 * changes, or another account signs in. Mock mode has no Google Calendar.
 */
import { useEffect, useSyncExternalStore } from 'react';

import { isMockMode } from '@/api/config';
import { useSession } from '@/api/hooks';
import { getRemoteRuntime } from '@/api/remote/default';
import type { GoogleCalendarStatus } from '@/api/remote/google-calendar';

export interface GoogleCalendarState {
  /** False until the first read finished. */
  loaded: boolean;
  /** Null when signed out (or in mock mode). */
  status: GoogleCalendarStatus | null;
  /** The last read failed (the secure store or storage could not be read). */
  error: boolean;
  /** About a connect that finished away from Data and privacy (the web page after Google, another account). */
  notice: string | null;
}

let state: GoogleCalendarState = isMockMode
  ? { loaded: true, status: null, error: false, notice: null }
  : { loaded: false, status: null, error: false, notice: null };
const listeners = new Set<() => void>();
let running: Promise<void> | null = null;
let again = false;
let watching = false;

function update(next: GoogleCalendarState) {
  state = next;
  for (const listener of listeners) listener();
}

/** Reads the account's Google Calendar state again; concurrent calls share one read and repeat once. */
export function reloadGoogleCalendar(): Promise<void> {
  if (isMockMode) return Promise.resolve();
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      const account = getRemoteRuntime().googleCalendar;
      try {
        update({ loaded: true, status: await account.status(), error: false, notice: account.notice() });
      } catch {
        update({ ...state, loaded: true, error: true, notice: account.notice() });
      }
    } while (again);
  })().finally(() => {
    running = null;
  });
  return running;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!watching && !isMockMode) {
    watching = true;
    getRemoteRuntime().googleCalendar.subscribe(() => void reloadGoogleCalendar());
  }
  return () => {
    listeners.delete(listener);
  };
}

/** The current state, outside React (the export queue re-checks before writing). */
export function googleCalendarState(): GoogleCalendarState {
  return state;
}

export function useGoogleCalendar(): GoogleCalendarState {
  const userId = useSession().data?.user.id ?? null;
  useEffect(() => {
    void reloadGoogleCalendar();
  }, [userId]);
  return useSyncExternalStore(subscribe, () => state, () => state);
}
