/**
 * The app's one source of "now". Demo controls can time-travel: an override is
 * kept as an offset from the device clock, so time keeps moving from the
 * chosen moment. UI code reads the time through `now()` or `useNow()` only.
 */
import { useEffect, useState } from 'react';

let offsetMs: number | null = null;
const listeners = new Set<() => void>();

/** The current moment: device time, or the demo override moving forward from when it was set. */
export function now(): Date {
  return new Date(Date.now() + (offsetMs ?? 0));
}

/** Whether a demo override is active. */
export function hasNowOverride(): boolean {
  return offsetMs !== null;
}

/** Time-travel to `date` (time keeps running from there), or back to device time with null. */
export function setNowOverride(date: Date | null): void {
  offsetMs = date ? date.getTime() - Date.now() : null;
  listeners.forEach((listener) => listener());
}

/** Called whenever the override changes. Returns the unsubscribe function. */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The current moment, re-rendering every `intervalMs` and when the demo override changes. */
export function useNow(intervalMs = 60_000): Date {
  const [date, setDate] = useState(now);
  useEffect(() => {
    const update = () => setDate(now());
    const id = setInterval(update, intervalMs);
    const unsubscribe = subscribe(update);
    update();
    return () => {
      clearInterval(id);
      unsubscribe();
    };
  }, [intervalMs]);
  return date;
}
