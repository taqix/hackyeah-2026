/**
 * The free time sent with plan generation and chat (the product API's
 * `availability`). Relative imports only: Node tests compile this file.
 *
 * For now every capture is manual: the preferred window (7–21 without one) on
 * each day of the week. The device calendar read replaces `captureAvailability`
 * later; callers keep the same signature. A denied or unavailable calendar must
 * fall back to manual slots, never to an empty list: `slots: []` means "no free
 * time at all".
 */
import type { LocalDate } from '../../api/types';
import { addDays, atLocalTime, toIsoWithOffset } from '../../lib/dates';

/** One free interval; ISO 8601 with the device's offset. */
export interface AvailabilitySlot {
  start_at: string;
  end_at: string;
}

/** The contract's `availability`: at most 100 sorted, non-overlapping slots. */
export interface Availability {
  source: 'device_calendar' | 'manual';
  captured_at: string;
  slots: AvailabilitySlot[];
}

export interface CaptureAvailabilityOptions {
  /** The Monday of the planned week; slots cover [weekStart, weekStart + 7 days) local time. */
  weekStart: LocalDate;
  /** Nothing before this moment (rounded up to 5 minutes): now for a new plan, the week's start for chat. */
  from: Date;
  /** The preferred window in whole local hours, or null for any time (7–21). */
  window: [number, number] | null;
  /** Shorter slots are dropped. Defaults to 5. */
  minMinutes?: number;
  /** Defaults to the device clock (never the demo time override). */
  capturedAt?: Date;
  /** Calendars not to read as busy, such as the app's own export calendar. */
  excludeCalendarIds?: string[];
}

export type CaptureAvailability = (options: CaptureAvailabilityOptions) => Promise<Availability>;

export const DEFAULT_WINDOW: [number, number] = [7, 21];
export const MAX_SLOTS = 100;
const FIVE_MINUTES_MS = 5 * 60_000;

/** One slot per local day: the window, clipped to start no earlier than `from`. */
export function manualAvailability(options: CaptureAvailabilityOptions): Availability {
  const [startHour, endHour] = options.window ?? DEFAULT_WINDOW;
  const floor = Math.ceil(options.from.getTime() / FIVE_MINUTES_MS) * FIVE_MINUTES_MS;
  const minMs = (options.minMinutes ?? 5) * 60_000;
  const slots: AvailabilitySlot[] = [];
  for (let day = 0; day < 7; day += 1) {
    const date = addDays(options.weekStart, day);
    const start = Math.max(atLocalTime(date, startHour).getTime(), floor);
    const end = atLocalTime(date, endHour).getTime();
    if (end - start >= minMs) {
      slots.push({ start_at: toIsoWithOffset(new Date(start)), end_at: toIsoWithOffset(new Date(end)) });
    }
  }
  return {
    source: 'manual',
    captured_at: toIsoWithOffset(options.capturedAt ?? new Date()),
    slots: slots.slice(0, MAX_SLOTS),
  };
}

/** The availability to send. Manual for now; the device calendar read replaces this body. */
export async function captureAvailability(options: CaptureAvailabilityOptions): Promise<Availability> {
  return manualAvailability(options);
}
