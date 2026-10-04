/**
 * The free time sent with plan generation and chat (the product API's
 * `availability`). Relative imports only: Node tests compile this file.
 *
 * Sources, in order: Google Calendar's free/busy when the person connected it
 * for planning, else the device calendar when the app has access, else the
 * daily window itself (denied, web, Expo Go). Each is cut to the daily window
 * (`preferred_window`, 7–21 without one) on every day of the week. A failed
 * read falls back to the next source, never to an empty list: `slots: []`
 * means "no free time at all".
 */
import type { LocalDate } from '../../api/types';
import { addDays, atLocalTime, fromLocalDate, toIsoWithOffset } from '../../lib/dates';
import { debugLog, debugWarn, describeError, errorLabel, startTimer } from '../../lib/debug-log';
import { createCalendarAvailabilityService } from './availability';
import { deviceCalendar } from './device-calendar';
import { CalendarError, isAppCalendar } from './types';
import type { CalendarFreeSlot, CalendarService } from './types';

/** One free interval; ISO 8601 with the device's offset. */
export interface AvailabilitySlot {
  start_at: string;
  end_at: string;
}

/** The contract's `availability`: at most 100 sorted, non-overlapping slots. */
export interface Availability {
  source: 'google_calendar' | 'device_calendar' | 'manual';
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
  /** Calendars not to read as busy, besides the app's own export calendar (always skipped). */
  excludeCalendarIds?: string[];
  /** The plan's IANA time zone, for the Google free/busy request. Defaults to the device's. */
  timeZone?: string;
}

export type CaptureAvailability = (options: CaptureAvailabilityOptions) => Promise<Availability>;

/** Free time from a calendar outside the device (Google Calendar); preferred over the device when present. */
export interface FreeTimeSource {
  /** Free intervals in [startDate, endDate). Rejects on any failure; never resolves with a guess. */
  freeSlots(query: { startDate: Date; endDate: Date; timeZone: string }): Promise<CalendarFreeSlot[]>;
}

export interface AvailabilitySources {
  /** Google Calendar, when connected and used for planning; null or omitted otherwise. */
  google?: FreeTimeSource | null;
}

/** What the device read needs from the calendar service; tests pass a fake. */
export type AvailabilityCalendar = Pick<CalendarService, 'getPermission' | 'listCalendars' | 'getEvents'>;

export const DEFAULT_WINDOW: [number, number] = [7, 21];
export const MAX_SLOTS = 100;
const FIVE_MINUTES_MS = 5 * 60_000;

/** The earliest allowed start: `from` rounded up to 5 minutes. */
function floorOf(options: CaptureAvailabilityOptions): number {
  return Math.ceil(options.from.getTime() / FIVE_MINUTES_MS) * FIVE_MINUTES_MS;
}

/** The week's daily windows as [start, end) instants, clipped to start no earlier than `from`. */
function dailyWindows(options: CaptureAvailabilityOptions): { start: number; end: number }[] {
  const [startHour, endHour] = options.window ?? DEFAULT_WINDOW;
  const floor = floorOf(options);
  const windows: { start: number; end: number }[] = [];
  for (let day = 0; day < 7; day += 1) {
    // Local wall-clock hours per day, so 23- and 25-hour days keep 7:00–21:00.
    const date = addDays(options.weekStart, day);
    const start = Math.max(atLocalTime(date, startHour).getTime(), floor);
    const end = atLocalTime(date, endHour).getTime();
    if (start < end) windows.push({ start, end });
  }
  return windows;
}

function toSlots(intervals: { start: number; end: number }[], minMinutes = 5): AvailabilitySlot[] {
  const minMs = minMinutes * 60_000;
  return intervals
    .filter((interval) => interval.end - interval.start >= minMs)
    .sort((a, b) => a.start - b.start)
    .slice(0, MAX_SLOTS)
    .map((interval) => ({
      start_at: toIsoWithOffset(new Date(interval.start)),
      end_at: toIsoWithOffset(new Date(interval.end)),
    }));
}

/** One slot per local day: the window, clipped to start no earlier than `from`. */
export function manualAvailability(options: CaptureAvailabilityOptions): Availability {
  return {
    source: 'manual',
    captured_at: toIsoWithOffset(options.capturedAt ?? new Date()),
    slots: toSlots(dailyWindows(options), options.minMinutes),
  };
}

/**
 * Free calendar time as plan slots: each free interval intersected with every
 * local day's window, from `from` on. Slots shorter than the minimum are
 * dropped; at most 100 are kept, earliest first.
 */
export function toDailySlots(
  free: readonly CalendarFreeSlot[],
  options: CaptureAvailabilityOptions,
): AvailabilitySlot[] {
  const intervals: { start: number; end: number }[] = [];
  for (const window of dailyWindows(options)) {
    for (const slot of free) {
      const start = Math.max(window.start, slot.startDate.getTime());
      const end = Math.min(window.end, slot.endDate.getTime());
      if (start < end) intervals.push({ start, end });
    }
  }
  return toSlots(intervals, options.minMinutes);
}

/** The device's IANA zone, or UTC when the runtime cannot tell. */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** The instants the calendar read covers: [max(from, week start), week end). */
export function availabilityRange(options: CaptureAvailabilityOptions): { startDate: Date; endDate: Date } {
  const weekStart = fromLocalDate(options.weekStart).getTime();
  return {
    startDate: new Date(Math.max(floorOf(options), weekStart)),
    endDate: fromLocalDate(addDays(options.weekStart, 7)),
  };
}

/**
 * Captures availability: Google Calendar's free/busy when `sources.google` is
 * given and the read works, else the device read when access is granted, else
 * manual slots. A failed Google read (expired access, offline) falls back to
 * the device, so it never goes out as an empty Google result. On the device,
 * any read error other than missing access (`native-error`) propagates, so a
 * failed read never goes out as an empty device calendar either.
 */
export async function captureAvailabilityFrom(
  calendar: AvailabilityCalendar,
  options: CaptureAvailabilityOptions,
  sources: AvailabilitySources = {},
): Promise<Availability> {
  const took = startTimer();
  // Debug builds: the source, why, how many slots and how long the read took; never event titles or times.
  const logged = (availability: Availability, why: string) => {
    const { source, slots } = availability;
    debugLog('calendar', `availability week=${options.weekStart} ${source} ${slots.length} slots ${took()} (${why})`);
    return availability;
  };
  const { startDate, endDate } = availabilityRange(options);
  if (startDate >= endDate) return logged(manualAvailability(options), 'the week is over');
  let fallback = '';
  if (sources.google) {
    try {
      const free = await sources.google.freeSlots({ startDate, endDate, timeZone: options.timeZone ?? deviceTimeZone() });
      return logged(
        {
          source: 'google_calendar',
          captured_at: toIsoWithOffset(options.capturedAt ?? new Date()),
          slots: toDailySlots(free, options),
        },
        'google free/busy',
      );
    } catch (error) {
      debugWarn('calendar', `✕ google free/busy week=${options.weekStart} ${took()} ${errorLabel(error)}`, () =>
        describeError(error),
      );
      fallback = `google failed (${errorLabel(error)}), `;
    }
  }
  const permission = await calendar.getPermission();
  if (permission.status !== 'granted') {
    return logged(manualAvailability(options), `${fallback}calendar ${permission.status}`);
  }
  const capturedAt = options.capturedAt ?? new Date();
  try {
    const calendars = await calendar.listCalendars();
    // The app's own calendar holds exported sessions: they are not commitments.
    const excluded = new Set(options.excludeCalendarIds ?? []);
    for (const item of calendars) if (isAppCalendar(item)) excluded.add(item.id);
    const calendarIds = excluded.size > 0
      ? calendars.filter((item) => !excluded.has(item.id)).map((item) => item.id)
      : undefined;
    const free = await createCalendarAvailabilityService(calendar).getFreeSlots({ startDate, endDate, calendarIds });
    return logged(
      {
        source: 'device_calendar',
        captured_at: toIsoWithOffset(capturedAt),
        slots: toDailySlots(free, options),
      },
      `${fallback}${calendarIds ? calendarIds.length : calendars.length} of ${calendars.length} calendars read`,
    );
  } catch (error) {
    // Access revoked since the check: plan from the window, never as if the calendar were empty.
    if (error instanceof CalendarError && (error.code === 'permission-denied' || error.code === 'unavailable')) {
      return logged(manualAvailability({ ...options, capturedAt }), `${fallback}read failed: ${error.code}`);
    }
    debugWarn('calendar', `✕ availability week=${options.weekStart} ${took()} ${errorLabel(error)}`, () =>
      describeError(error),
    );
    throw error;
  }
}

/** The availability to send: Google Calendar or the device calendar when connected, the window otherwise. */
export function captureAvailability(
  options: CaptureAvailabilityOptions,
  sources: AvailabilitySources = {},
): Promise<Availability> {
  return captureAvailabilityFrom(deviceCalendar, options, sources);
}
