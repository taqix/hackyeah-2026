/**
 * Demo switches for the mocked backend (Settings › Demo controls only):
 * latency, offline, one-off failures of the next build or chat message, a
 * stale chat result, time travel and a full reset.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useSyncExternalStore } from 'react';

import { queryClient } from '@/api/query-client';
import { queryKeys } from '@/api/query-keys';
import { setNowOverride } from '@/lib/clock';
import { resetDraft } from '@/state/onboarding-draft';

import { resetAll } from './db';

export interface DemoSettings {
  /** Added to every request. */
  latencyMs: number;
  /** Every request rejects with `offline`. */
  offline: boolean;
  /** The next plan build fails (Home 5.8). Resets after one use. */
  failNextBuild: boolean;
  /** The next chat message fails with generation_failed (8.12). Resets after one use. */
  failNextChat: boolean;
  /** The next chat message is rejected as stale_version (8.13). Resets after one use. */
  staleNextChat: boolean;
  /** The demo's "now" (ISO), or null for the device clock. */
  nowOverride: string | null;
}

type OneOff = 'failNextBuild' | 'failNextChat' | 'staleNextChat';

const KEY = 'movo.demo-settings.v1';
const DEFAULTS: DemoSettings = {
  latencyMs: 450,
  offline: false,
  failNextBuild: false,
  failNextChat: false,
  staleNextChat: false,
  nowOverride: null,
};

let settings: DemoSettings = DEFAULTS;
let hydration: Promise<void> | null = null;
const listeners = new Set<() => void>();

function update(patch: Partial<DemoSettings>) {
  settings = { ...settings, ...patch };
  listeners.forEach((listener) => listener());
  AsyncStorage.setItem(KEY, JSON.stringify(settings)).catch(() => undefined);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const get = () => settings;

export const demo = {
  get,
  subscribe,
  /** Loads saved settings once, applying a saved time override before anything reads the clock. */
  hydrate(): Promise<void> {
    hydration ??= (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) settings = { ...DEFAULTS, ...(JSON.parse(raw) as Partial<DemoSettings>) };
      } catch {
        settings = DEFAULTS;
      }
      if (settings.nowOverride) setNowOverride(new Date(settings.nowOverride));
      listeners.forEach((listener) => listener());
    })();
    return hydration;
  },
  setLatencyMs(latencyMs: number) {
    update({ latencyMs: Math.max(0, Math.round(latencyMs)) });
  },
  setOffline(offline: boolean) {
    update({ offline });
    if (!offline) queryClient.invalidateQueries();
  },
  setFailNextBuild(failNextBuild: boolean) {
    update({ failNextBuild });
  },
  setFailNextChat(failNextChat: boolean) {
    update({ failNextChat });
  },
  setStaleNextChat(staleNextChat: boolean) {
    update({ staleNextChat });
  },
  /** True once if the switch is on, and turns it off. */
  consume(flag: OneOff): boolean {
    if (!settings[flag]) return false;
    update({ [flag]: false });
    return true;
  },
  /** Time-travel the whole app (or back to the device clock with null); data refetches. */
  setNow(date: Date | null) {
    setNowOverride(date);
    update({ nowOverride: date ? date.toISOString() : null });
    queryClient.invalidateQueries();
  },
  /** Wipes the mock database and the onboarding draft and signs out. */
  async resetEverything() {
    await resetAll();
    resetDraft();
    update({ failNextBuild: false, failNextChat: false, staleNextChat: false });
    queryClient.clear();
    queryClient.setQueryData(queryKeys.session, null);
  },
};

/**
 * The demo settings with their setters, re-rendering on change. Loads the saved
 * settings itself: Demo controls can be the first screen (a deep link or a web
 * reload), before any request has loaded them.
 */
export function useDemoSettings() {
  useEffect(() => {
    void demo.hydrate();
  }, []);
  const current = useSyncExternalStore(subscribe, get, get);
  return {
    ...current,
    setLatencyMs: demo.setLatencyMs,
    setOffline: demo.setOffline,
    setFailNextBuild: demo.setFailNextBuild,
    setFailNextChat: demo.setFailNextChat,
    setStaleNextChat: demo.setStaleNextChat,
    setNow: demo.setNow,
    resetEverything: demo.resetEverything,
  };
}
