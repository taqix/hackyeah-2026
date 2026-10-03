import inputSchema from './schemas/input.schema.json' with { type: 'json' };
import outputSchema from './schemas/output.schema.json' with { type: 'json' };
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

export interface PlanInput {
  preferences: {
    timezone: string;
    starting_comfort: 'starting_out' | 'occasionally_active' | 'some_routine';
    sessions_per_week: 1 | 2 | 3;
    session_minutes: 5 | 10 | 20;
    activity_interests: string[];
    available_locations: string[];
    available_equipment: string[];
    discovery_preference: 'selected_only' | 'occasional' | 'explore';
    preferred_times?: string[];
    avoidances?: string[];
    starting_obstacle?: string | null;
    excluded_activity_types?: string[];
    comfortable_swimming?: boolean | null;
  };
  available_slots: { start: string; end: string }[];
}
export type PlanEvent = { time: string } & (
  | { description: string; series?: never }
  | { series: { description: string }[]; description?: never }
);
export interface PlanOutput {
  events: PlanEvent[];
}

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats.default(ajv);
const validateInput = ajv.compile<PlanInput>(inputSchema);
const validateOutput = ajv.compile<PlanOutput>(outputSchema);
// Gemini supports anyOf; these branches remain exclusive through required keys
// and additionalProperties:false. Local validation uses the original oneOf.
export const geminiOutputSchema = JSON.parse(
  JSON.stringify(outputSchema, (key, value) => {
    if (key === '$schema') return undefined;
    if (value && typeof value === 'object' && !Array.isArray(value) && value.oneOf) {
      const { oneOf, ...rest } = value;
      return { ...rest, anyOf: oneOf };
    }
    return value;
  }),
);

export class PlanValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlanValidationError';
  }
}
function reject(message: string): never {
  throw new PlanValidationError(message);
}

export function parsePlanInput(value: unknown): PlanInput {
  if (!validateInput(value))
    reject('Input does not match the preferences and available_slots schema.');
  try {
    new Intl.DateTimeFormat('en', { timeZone: value.preferences.timezone });
  } catch {
    reject('Preferences timezone must be a valid IANA timezone.');
  }
  for (const slot of value.available_slots) {
    if (
      !Number.isFinite(Date.parse(slot.start)) ||
      !Number.isFinite(Date.parse(slot.end)) ||
      Date.parse(slot.start) >= Date.parse(slot.end)
    )
      reject('Available slots must have valid increasing start and end times.');
  }
  return value;
}

function localDateParts(time: number, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(time);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

export function parsePlanOutput(value: unknown, input: PlanInput, now = Date.now()): PlanOutput {
  if (!validateOutput(value)) reject('Output does not match the events schema.');
  const dates = new Set<string>();
  const weeks = new Map<number, number>();
  let previousEnd = -Infinity;
  for (const event of value.events) {
    const start = Date.parse(event.time);
    if (!Number.isFinite(start)) reject('Event time must be a valid timestamp.');
    const end = start + input.preferences.session_minutes * 60_000;
    const local = localDateParts(start, input.preferences.timezone);
    if (
      start <= now ||
      Number(local.minute) % 5 !== 0 ||
      Number(local.second) !== 0 ||
      start % 1000 !== 0
    )
      reject('Events must start in the future on a local five-minute grid.');
    const buffer = 5 * 60_000;
    if (
      !input.available_slots.some(
        (slot) => start - buffer >= Date.parse(slot.start) && end + buffer <= Date.parse(slot.end),
      )
    )
      reject('An event does not fit an available slot including preparation and wrap-up.');
    if (start - buffer < previousEnd)
      reject('Events must be ordered and must not overlap, including buffers.');
    previousEnd = end + buffer;
    const date = `${local.year}-${local.month}-${local.day}`;
    if (dates.has(date)) reject('Only one session per local date is allowed.');
    dates.add(date);
    const day = Date.UTC(Number(local.year), Number(local.month) - 1, Number(local.day));
    const monday = day - ((new Date(day).getUTCDay() + 6) % 7) * 86_400_000;
    const count = (weeks.get(monday) ?? 0) + 1;
    if (count > input.preferences.sessions_per_week) reject('Weekly session frequency exceeded.');
    weeks.set(monday, count);
    if (event.series && !input.preferences.available_locations.includes('gym'))
      reject('Gym series require gym access.');
    const descriptions = event.series?.map((item) => item.description) ?? [event.description];
    if (descriptions.some((text) => !text?.trim())) reject('Event descriptions must not be blank.');
  }
  return value;
}
