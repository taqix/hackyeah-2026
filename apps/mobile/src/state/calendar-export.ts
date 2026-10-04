/**
 * Data and privacy › Add sessions to my calendar: whether planned sessions are
 * copied into the "Movo" device calendar. Off by default, kept on this device
 * only (like calendar access itself, it belongs to the phone, not the account).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'movo.calendar-export.v1';

export interface CalendarExportSetting {
  /** False until the stored choice has been read. */
  loaded: boolean;
  enabled: boolean;
}

let setting: CalendarExportSetting = { loaded: false, enabled: false };
let hydration: Promise<void> | null = null;
const listeners = new Set<() => void>();

function update(next: CalendarExportSetting) {
  setting = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Reads the stored choice once; a choice made meanwhile wins. */
export function hydrateCalendarExport(): Promise<void> {
  hydration ??= AsyncStorage.getItem(STORAGE_KEY)
    .then((stored) => {
      if (!setting.loaded) update({ loaded: true, enabled: stored === 'on' });
    })
    .catch(() => {
      // Storage unavailable (web private mode): stay off.
      if (!setting.loaded) update({ loaded: true, enabled: false });
    });
  return hydration;
}

/** The current choice, outside React (the sync re-checks it before writing). */
export function isCalendarExportEnabled(): boolean {
  return setting.enabled;
}

export function setCalendarExportEnabled(enabled: boolean): void {
  update({ loaded: true, enabled });
  AsyncStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off').catch(() => undefined);
}

export function useCalendarExportSetting(): CalendarExportSetting {
  useEffect(() => {
    void hydrateCalendarExport();
  }, []);
  return useSyncExternalStore(subscribe, () => setting, () => setting);
}
