import { useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import { isMockMode } from '@/api/config';
import { useAuthProviders } from '@/api/hooks';
import { getRemoteRuntime } from '@/api/remote/default';
import type { GoogleCalendarStatus, GoogleConnectOrigin, GoogleConnectResult } from '@/api/remote/google-calendar';
import { isApiError } from '@/api/types';
import { reloadGoogleCalendar, useGoogleCalendar } from '@/state/google-calendar';

export const CONNECT_FAILED = "Google Calendar didn't connect. Try again.";

/** The signed-in account's Google Calendar (remote mode only). */
export const googleCalendarAccount = () => getRemoteRuntime().googleCalendar;

/** An action's own message when it has one (ApiErrors carry copy ready to show), else the fallback. */
export const shownMessage = (error: unknown, fallback: string) => (isApiError(error) ? error.message : fallback);

/** What a tap on Connect came to: Google's answer, or `failed` with the note set. */
export type ConnectOutcome = GoogleConnectResult['status'] | 'failed';

export interface GoogleCalendarConnect {
  /**
   * Whether to offer Google Calendar at all: never in mock mode, not while
   * Google sign-in is switched off (GET /auth/v1/settings), and not while
   * signed out. Offered while the providers can't be read.
   */
  available: boolean;
  /** False until the account's state was read once. */
  loaded: boolean;
  /** The last read of the state failed (secure store or storage). With no status at all, offer Try again. */
  readFailed: boolean;
  status: GoogleCalendarStatus | null;
  connected: boolean;
  /** Connected, but Google stopped accepting the tokens: offer Reconnect. */
  needsReconnect: boolean;
  /** A connect is running (and, on the web, the page is on its way to Google). */
  connecting: boolean;
  /** A problem to show under the row: the last action's, or a connect that finished away from it. */
  note: string | null;
  setNote(message: string | null): void;
  clearNote(): void;
  /** Connect or Reconnect, from an explicit tap. Never rejects; a failure sets `note`. */
  connect(): Promise<ConnectOutcome>;
  /** Reads the state again (Try again after a failed read). */
  reload(): Promise<void>;
}

/**
 * Google Calendar's Connect, shared by Data and privacy and onboarding Review:
 * whether to offer it, the account's connection, and the connect itself. The
 * connect remembers `from`, so a connect that finishes on /auth/callback (the
 * web page after Google) goes back to the screen that started it.
 */
export function useGoogleCalendarConnect(from: GoogleConnectOrigin): GoogleCalendarConnect {
  const providers = useAuthProviders();
  const google = useGoogleCalendar();
  const [connecting, setConnecting] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const status = google.status;
  const connected = !!status?.connected;

  const clearNote = () => {
    setNote(null);
    if (google.notice) googleCalendarAccount().setNotice(null);
  };

  const connect = async (): Promise<ConnectOutcome> => {
    setConnecting(true);
    clearNote();
    try {
      const result = await googleCalendarAccount().connect({ from });
      // Web: the page is on its way to Google; keep the spinner.
      if (result.status === 'redirecting') return result.status;
      if (result.status === 'connected') AccessibilityInfo.announceForAccessibility('Google Calendar connected');
      await reloadGoogleCalendar();
      setConnecting(false);
      return result.status;
    } catch (error) {
      setNote(shownMessage(error, CONNECT_FAILED));
      setConnecting(false);
      return 'failed';
    }
  };

  return {
    available: !isMockMode && providers.data?.google !== false && !(google.loaded && !status && !google.error),
    loaded: google.loaded,
    readFailed: google.error,
    status,
    connected,
    needsReconnect: connected && !!status?.needsReconnect,
    connecting,
    note: note ?? google.notice,
    setNote,
    clearNote,
    connect,
    reload: reloadGoogleCalendar,
  };
}
