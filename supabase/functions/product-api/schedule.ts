// Timezone helpers for the AI context. Only Intl is used, so Deno and Node behave alike.
const minute = 60000;
const day = 86400000;
const grid = 5 * minute;
const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * day).toISOString().slice(0, 10);
}

export function weekdayOf(date: string): string {
  return weekdays[new Date(`${date}T12:00:00Z`).getUTCDay()]!;
}

const formatters = new Map<string, Intl.DateTimeFormat>();
function offsetMinutes(ms: number, timeZone: string): number {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(timeZone, formatter);
  }
  const parts = formatter.formatToParts(new Date(ms));
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const local = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return Math.round((local - Math.floor(ms / 1000) * 1000) / minute);
}

/** Formats an instant as local wall time with its UTC offset, e.g. 2026-10-06T18:00:00+02:00. */
export function localIso(ms: number, timeZone: string): string {
  const offset = offsetMinutes(ms, timeZone);
  const local = new Date(ms + offset * minute).toISOString().slice(0, 19);
  const size = Math.abs(offset);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${local}${offset < 0 ? '-' : '+'}${pad(Math.floor(size / 60))}:${pad(size % 60)}`;
}

/** The instant of a local date and minute of day; a second pass settles DST changes. */
export function zonedInstant(date: string, minutes: number, timeZone: string): number {
  const naive = Date.parse(`${date}T00:00:00Z`) + minutes * minute;
  const first = naive - offsetMinutes(naive, timeZone) * minute;
  return naive - offsetMinutes(first, timeZone) * minute;
}

export interface AllowedSlot {
  start_at: string;
  end_at: string;
  minutes: number;
}

/**
 * Free time a new session may use: the caller's slots cut to each day's preferred window,
 * the planned week and the future, starting on the 5-minute grid. Validation still checks
 * the raw slots, so anything inside these passes both the slot and the window rules.
 */
export function allowedSlots(input: {
  weekStart: string;
  timeZone: string;
  window: { start_hour: number; end_hour: number } | null;
  slots: { start_at: string; end_at: string }[];
  now: number;
}): AllowedSlot[] {
  const earliest = Math.ceil(input.now / grid) * grid;
  const result: AllowedSlot[] = [];
  for (let index = 0; index < 7; index++) {
    const date = addDays(input.weekStart, index);
    const from = zonedInstant(date, (input.window?.start_hour ?? 0) * 60, input.timeZone);
    const to = input.window
      ? zonedInstant(date, input.window.end_hour * 60, input.timeZone)
      : zonedInstant(addDays(date, 1), 0, input.timeZone);
    for (const slot of input.slots) {
      const start = Math.ceil(Math.max(Date.parse(slot.start_at), from, earliest) / grid) * grid;
      const end = Math.min(Date.parse(slot.end_at), to);
      if (end - start < grid) continue;
      result.push({
        start_at: localIso(start, input.timeZone),
        end_at: localIso(end, input.timeZone),
        minutes: Math.floor((end - start) / minute),
      });
    }
  }
  return result;
}
