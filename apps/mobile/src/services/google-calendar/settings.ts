/**
 * What the person chose for Google Calendar on this account, per Supabase
 * user in AsyncStorage (no secrets): whether planning reads it, whether
 * sessions are added to it, and the Movo calendar's Google ID.
 */
import type { StringStorage } from './types';

export interface GoogleCalendarSettings {
  /** On by default once connected. */
  useForPlanning: boolean;
  /** Off by default. */
  exportEnabled: boolean;
  /** The Movo calendar the export created in Google, once it exists. */
  movoCalendarId: string | null;
}

export const DEFAULT_GOOGLE_SETTINGS: GoogleCalendarSettings = {
  useForPlanning: true,
  exportEnabled: false,
  movoCalendarId: null,
};

export const googleSettingsKey = (userId: string) => `movo.google-calendar.settings.v1:${userId}`;

export interface GoogleSettingsStore {
  read(userId: string): Promise<GoogleCalendarSettings>;
  update(userId: string, patch: Partial<GoogleCalendarSettings>): Promise<GoogleCalendarSettings>;
}

export function createGoogleSettingsStore(storage: StringStorage): GoogleSettingsStore {
  async function read(userId: string): Promise<GoogleCalendarSettings> {
    let raw: string | null = null;
    try {
      raw = await storage.getItem(googleSettingsKey(userId));
    } catch {
      raw = null;
    }
    if (!raw) return { ...DEFAULT_GOOGLE_SETTINGS };
    try {
      const value = JSON.parse(raw) as Partial<GoogleCalendarSettings>;
      return {
        useForPlanning: typeof value.useForPlanning === 'boolean' ? value.useForPlanning : true,
        exportEnabled: value.exportEnabled === true,
        movoCalendarId: typeof value.movoCalendarId === 'string' && value.movoCalendarId ? value.movoCalendarId : null,
      };
    } catch {
      return { ...DEFAULT_GOOGLE_SETTINGS };
    }
  }

  // One write at a time, so a toggle and the export's calendar ID never overwrite each other.
  let tail: Promise<unknown> = Promise.resolve();
  function update(userId: string, patch: Partial<GoogleCalendarSettings>) {
    const run = tail.then(async () => {
      const next = { ...(await read(userId)), ...patch };
      await storage.setItem(googleSettingsKey(userId), JSON.stringify(next));
      return next;
    });
    tail = run.catch(() => undefined);
    return run;
  }

  return { read, update };
}
