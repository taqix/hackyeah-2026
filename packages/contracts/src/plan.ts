import inputSchema from './schemas/input.schema.json' with { type: 'json' };
import outputSchema from './schemas/output.schema.json' with { type: 'json' };
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { buildPlanOutputSchema } from './plan-schema.js';
import type { ExistingWorkout, PlanInput, PlanOutput, TimeSlot, Workout } from './plan-types.js';

export type * from './plan-types.js';
export { buildPlanOutputSchema, buildGeminiOutputSchema } from './plan-schema.js';

const ajv = new Ajv2020({ allErrors: true, strict: false, ownProperties: true });
addFormats.default(ajv);
const validateInput = ajv.compile<PlanInput>(inputSchema);
const validateOutput = ajv.compile<PlanOutput>(outputSchema);

export class PlanValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlanValidationError';
  }
}

function reject(message: string): never {
  throw new PlanValidationError(message);
}

function interval(slot: TimeSlot): { start: number; end: number } {
  const start = Date.parse(slot.start);
  const end = start + slot.duration * 1000;
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    !Number.isFinite(slot.duration) ||
    slot.duration <= 0 ||
    end <= start ||
    Math.abs(end) > 8.64e15 ||
    !/(?:Z|[+-]\d{2}:\d{2})$/i.test(slot.start)
  )
    reject('Time slots must have an offset timestamp and a valid positive duration in seconds.');
  return { start, end };
}

function nonBlank(text: string, label: string) {
  if (!text.trim()) reject(`${label} must not be blank.`);
}

function unique(values: (string | number)[], label: string) {
  if (new Set(values).size !== values.length) reject(`${label} must be unique.`);
}

// Key order is irrelevant when the same workout appears in multiple context arrays.
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'undefined';
}

function history(input: PlanInput): ExistingWorkout[] {
  const events = new Map<number, ExistingWorkout>();
  for (const event of [
    ...input.previous_week_events,
    ...input.current_week_events,
    ...input.target_window_events,
  ]) {
    const previous = events.get(event.id);
    if (previous && canonical(previous) !== canonical(event))
      reject('Duplicate workout IDs must have consistent context.');
    events.set(event.id, event);
  }
  return [...events.values()];
}

function validateWorkoutText(event: Workout) {
  nonBlank(event.description, 'Workout description');
  if ('parts' in event) {
    for (const part of event.parts) nonBlank(part.description, 'Workout part');
  } else {
    for (const exercise of event.exercises) {
      nonBlank(exercise.name, 'Exercise name');
      nonBlank(exercise.description, 'Exercise description');
    }
  }
}

export function parsePlanInput(value: unknown): PlanInput {
  if (!validateInput(value)) reject('Input does not match the planning request schema.');
  try {
    new Intl.DateTimeFormat('en', { timeZone: value.preferences.timezone });
  } catch {
    reject('Preferences timezone must be a valid IANA timezone.');
  }
  if (value.mode === 'modify') {
    if (value.user_prompt === null) reject('Modification requires a user prompt.');
    nonBlank(value.user_prompt, 'User prompt');
  } else if (value.user_prompt !== null) reject('Creation must use a null user prompt.');
  interval(value.planning_window);
  for (const slot of value.available_slots) interval(slot);
  for (const message of value.conversation) nonBlank(message.content, 'Conversation message');
  unique(
    value.sports.map((sport) => sport.id),
    'Sport IDs',
  );
  for (const sport of value.sports) {
    nonBlank(sport.name, 'Sport name');
    nonBlank(sport.description, 'Sport description');
    if (sport.is_gym === 1) continue;
    unique(
      sport.metrics.map((metric) => metric.key),
      'Metric keys',
    );
    for (const metric of sport.metrics) {
      nonBlank(metric.description, 'Metric description');
      if (metric.unit !== undefined) nonBlank(metric.unit, 'Metric unit');
      const schema = metric.value_schema;
      if (schema.type === 'number' || schema.type === 'integer') {
        if (
          schema.minimum !== undefined &&
          schema.maximum !== undefined &&
          schema.minimum > schema.maximum
        )
          reject('Metric minimum must not exceed maximum.');
        if (
          schema.type === 'integer' &&
          schema.minimum !== undefined &&
          schema.maximum !== undefined &&
          Math.ceil(schema.minimum) > Math.floor(schema.maximum)
        )
          reject('Integer metric bounds must allow at least one integer.');
      } else if (schema.type === 'string') {
        if (
          schema.minLength !== undefined &&
          schema.maxLength !== undefined &&
          schema.minLength > schema.maxLength
        )
          reject('Metric minimum length must not exceed maximum length.');
      }
      try {
        const validateMetric = ajv.compile(schema);
        if ('enum' in schema && schema.enum?.some((entry) => !validateMetric(entry)))
          reject('Metric enum values must satisfy their value schema.');
      } finally {
        ajv.removeSchema(schema);
      }
      if (
        metric.represents_session_duration &&
        schema.type !== 'number' &&
        schema.type !== 'integer'
      )
        reject('A whole-session duration metric must be numeric and measured in seconds.');
      if (
        metric.represents_session_duration &&
        metric.unit !== undefined &&
        metric.unit !== 'seconds'
      )
        reject('A whole-session duration metric must use seconds.');
    }
  }
  const catalog = new Set(value.sports.map((sport) => sport.id));
  for (const id of [
    ...value.preferences.activity_interests,
    ...(value.preferences.excluded_activity_types ?? []),
  ]) {
    if (!catalog.has(id)) reject('Preference sport IDs must exist in the supplied catalog.');
  }
  for (const event of history(value)) {
    interval(event.time_slot);
    validateWorkoutText(event);
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

/** Parse untrusted model output against an already validated, backend-owned request. */
export function parsePlanOutput(value: unknown, input: PlanInput, now = Date.now()): PlanOutput {
  if (!Number.isFinite(now) || Math.abs(now) > 8.64e15) reject('Current time must be valid.');
  if (!validateOutput(value)) reject('Output does not match the workout operations schema.');
  if (input.mode === 'modify') {
    if (value.message === null) reject('Modification requires a user-facing message.');
    nonBlank(value.message, 'User-facing message');
  } else if (value.message !== null) reject('Creation must use a null message.');

  const existing = history(input);
  const window = interval(input.planning_window);
  const deleted = new Set<number>();
  for (const event of value.events) {
    if (event.action !== 'delete') continue;
    if (input.mode !== 'modify') reject('Creation cannot delete workouts.');
    if (deleted.has(event.id)) reject('Duplicate deletion IDs are not allowed.');
    const previous = existing.find((item) => item.id === event.id);
    if (!previous) reject('Deletion ID must identify a known workout.');
    const time = interval(previous.time_slot);
    if (!previous.editable || previous.status !== 'planned' || time.start <= now)
      reject('Deletion cannot change a completed, past or non-editable workout.');
    if (time.start < window.start || time.end > window.end)
      reject('Deletion must be inside the planning window.');
    deleted.add(event.id);
  }
  // Compile per request without retaining catalog-specific schemas in Ajv's cache.
  const schema = buildPlanOutputSchema(input);
  try {
    if (!ajv.compile<PlanOutput>(schema)(value))
      reject('Output does not match the supplied sport catalog, metric formats or workout shape.');
  } finally {
    ajv.removeSchema(schema);
  }

  const sports = new Map(input.sports.map((sport) => [sport.id, sport]));
  const additions: { event: Workout; start: number; end: number; buffer: number }[] = [];
  for (const event of value.events) {
    if (event.action !== 'add') continue;
    const sport = sports.get(event.sport_id);
    if (!sport) reject('Added sport must exist in the supplied catalog.');
    const time = interval(event.time_slot);
    const local = localDateParts(time.start, input.preferences.timezone);
    if (
      time.start <= now ||
      Number(local.minute) % 5 !== 0 ||
      Number(local.second) !== 0 ||
      time.start % 1000 !== 0
    )
      reject('Workouts must start in the future on a local five-minute grid.');
    if (time.start < window.start || time.end > window.end)
      reject('Added workout must fit the planning window.');
    const buffer = (sport.buffer_seconds ?? 300) * 1000;
    if (
      !input.available_slots.some((slot) => {
        const available = interval(slot);
        return time.start - buffer >= available.start && time.end + buffer <= available.end;
      })
    )
      reject('Workout must fit an available slot including preparation and wrap-up.');
    if (input.mode === 'create' && event.time_slot.duration > input.preferences.preferred_duration)
      reject('Creation must not exceed preferred workout duration.');
    if (input.preferences.excluded_activity_types?.includes(sport.id))
      reject('An excluded sport cannot be added.');
    if (
      input.preferences.discovery_preference === 'selected_only' &&
      !input.preferences.activity_interests.includes(sport.id)
    )
      reject('Selected-only discovery requires a selected sport.');
    if (sport.is_gym === 1 && !input.preferences.available_locations.includes('gym'))
      reject('Gym workouts require gym access.');
    if ('metrics' in event && sport.is_gym === 0) {
      for (const metric of sport.metrics) {
        if (
          metric.represents_session_duration &&
          Object.hasOwn(event.metrics, metric.key) &&
          event.metrics[metric.key] !== event.time_slot.duration
        )
          reject('Whole-session duration metric must equal the time slot duration in seconds.');
      }
    }
    validateWorkoutText(event);
    additions.push({ event, ...time, buffer });
  }

  const retained = existing.filter((event) => event.status !== 'skipped' && !deleted.has(event.id));
  const finalSchedule = [
    ...retained.map((event) => ({
      event,
      ...interval(event.time_slot),
      buffer: (sports.get(event.sport_id)?.buffer_seconds ?? 300) * 1000,
      added: false,
    })),
    ...additions.map((item) => ({ ...item, added: true })),
  ];
  // Only additions can introduce conflicts; unchanged history may already violate today's preferences.
  for (const addition of finalSchedule.filter((event) => event.added)) {
    for (const other of finalSchedule) {
      if (addition === other) continue;
      if (
        addition.start - addition.buffer < other.end + other.buffer &&
        other.start - other.buffer < addition.end + addition.buffer
      )
        reject('Final schedule must not overlap, including preparation and wrap-up.');
      const local = localDateParts(addition.start, input.preferences.timezone);
      const otherLocal = localDateParts(other.start, input.preferences.timezone);
      if (
        local.year === otherLocal.year &&
        local.month === otherLocal.month &&
        local.day === otherLocal.day
      )
        reject('Only one session per local date is allowed in the final schedule.');
    }
  }
  if (input.mode === 'create') {
    const counts = new Map<number, number>();
    const addedWeeks = new Set<number>();
    for (const item of finalSchedule) {
      const local = localDateParts(item.start, input.preferences.timezone);
      const date = Date.UTC(Number(local.year), Number(local.month) - 1, Number(local.day));
      const monday = date - ((new Date(date).getUTCDay() + 6) % 7) * 86_400_000;
      counts.set(monday, (counts.get(monday) ?? 0) + 1);
      if (item.added) addedWeeks.add(monday);
    }
    if (
      [...addedWeeks].some((week) => (counts.get(week) ?? 0) > input.preferences.sessions_per_week)
    )
      reject('Final schedule exceeds weekly session frequency.');
  }
  return value;
}
