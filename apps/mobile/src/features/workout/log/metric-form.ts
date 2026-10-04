/**
 * The log-it form's rules, kept pure: which fields a sport gets, what they start
 * with, how typed text is checked against the catalog's value_schema, and how a
 * .fit/.gpx import fills them. The session-duration metric is typed in minutes
 * and stored in seconds.
 */
import type { ActivityLog, MetricValue, SportDefinition, SportMetric } from '@/api/types';
import type { ActivityImport, ActivityImportErrorCode, ImportedActivity } from '@/services/activity-import';

/** Numbers and free text are edited as text; booleans and enum picks as values; null is empty. */
export type FieldValue = string | boolean | null;
export type FormValues = Record<string, FieldValue>;
export type FormErrors = Record<string, string>;

/** Every sport is logged with its length, even one whose catalog row has no duration metric. */
const FALLBACK_DURATION: SportMetric = {
  key: 'duration',
  description: 'Time',
  required: true,
  unit: 'min',
  represents_session_duration: true,
  value_schema: { type: 'integer', minimum: 1 },
};

export function formMetrics(sport: SportDefinition): SportMetric[] {
  const metrics = sport.is_gym === 0 ? sport.metrics : [];
  return metrics.some((m) => m.represents_session_duration) ? metrics : [FALLBACK_DURATION, ...metrics];
}

export function durationMetric(metrics: SportMetric[]): SportMetric {
  return metrics.find((m) => m.represents_session_duration) ?? FALLBACK_DURATION;
}

/** "Distance (optional)": the prototype's field label. */
export function fieldLabel(metric: SportMetric): string {
  return metric.required ? metric.description : `${metric.description} (optional)`;
}

/** Number and free-text fields sit two to a row; yes/no and chips take the full width. */
export function isCompact(metric: SportMetric): boolean {
  const s = metric.value_schema;
  return s.type !== 'boolean' && !(s.type === 'string' && s.enum);
}

/** The duration pre-filled from the plan (or the saved log); nothing else is made up. */
export function initialValues(
  metrics: SportMetric[],
  { plannedSeconds, log }: { plannedSeconds: number | null; log: ActivityLog | null },
): FormValues {
  const values: FormValues = {};
  for (const m of metrics) {
    if (m.represents_session_duration) {
      const seconds = log ? (numberOrNull(log.metrics[m.key]) ?? log.duration_seconds) : plannedSeconds;
      values[m.key] = seconds ? String(Math.max(1, Math.round(seconds / 60))) : '';
      continue;
    }
    const saved = log?.metrics[m.key];
    if (saved === undefined) values[m.key] = m.value_schema.type === 'boolean' ? null : '';
    else if (m.value_schema.type === 'boolean') values[m.key] = typeof saved === 'boolean' ? saved : null;
    else values[m.key] = String(saved);
  }
  return values;
}

function numberOrNull(value: MetricValue | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function withUnit(n: number, unit: string | undefined): string {
  return unit ? `${n} ${unit}` : String(n);
}

/** Parse one field; an error is short copy for under the field. Empty optional fields give no value. */
export function parseField(metric: SportMetric, raw: FieldValue): { value?: MetricValue; error?: string } {
  const s = metric.value_schema;
  const missing = metric.represents_session_duration
    ? 'Add how long it took.'
    : `Add the ${metric.description.toLowerCase()}.`;

  if (s.type === 'boolean') {
    if (typeof raw === 'boolean') return { value: raw };
    return metric.required ? { error: 'Choose yes or no.' } : {};
  }

  const text = typeof raw === 'string' ? raw.trim() : '';
  if (!text) return metric.required ? { error: missing } : {};

  if (s.type === 'string') {
    if (s.enum && !s.enum.includes(text)) return { error: 'Choose one of the options.' };
    if (s.minLength !== undefined && text.length < s.minLength) return { error: `At least ${s.minLength} characters.` };
    if (s.maxLength !== undefined && text.length > s.maxLength) return { error: `At most ${s.maxLength} characters.` };
    return { value: text };
  }

  const n = Number(text.replace(',', '.'));
  if (!Number.isFinite(n)) return { error: 'Enter a number.' };
  if (s.type === 'integer' && !Number.isInteger(n)) return { error: 'Enter a whole number.' };
  if (s.minimum !== undefined && n < s.minimum) {
    return { error: s.minimum === 0 ? 'Enter 0 or more.' : `At least ${withUnit(s.minimum, metric.unit)}.` };
  }
  if (s.maximum !== undefined && n > s.maximum) return { error: `At most ${withUnit(s.maximum, metric.unit)}.` };
  if (s.enum && !s.enum.includes(n)) return { error: `Choose ${s.enum.join(', ')}.` };
  // Stored in seconds, typed in minutes.
  return { value: metric.represents_session_duration ? Math.round(n * 60) : n };
}

export type ParsedForm =
  | { ok: true; metrics: Record<string, MetricValue>; durationSeconds: number }
  | { ok: false; errors: FormErrors };

export function parseForm(metrics: SportMetric[], values: FormValues): ParsedForm {
  const out: Record<string, MetricValue> = {};
  const errors: FormErrors = {};
  for (const m of metrics) {
    const { value, error } = parseField(m, values[m.key] ?? null);
    if (error) errors[m.key] = error;
    else if (value !== undefined) out[m.key] = value;
  }
  if (Object.keys(errors).length) return { ok: false, errors };
  const duration = out[durationMetric(metrics).key];
  return { ok: true, metrics: out, durationSeconds: typeof duration === 'number' ? duration : 0 };
}

/** Under the fields: what is needed, or a nudge to check numbers read from a file. */
export function formCaption(metrics: SportMetric[], sportId: string, fromFile: boolean): string {
  if (fromFile) return 'Filled from your file. Change anything that looks off.';
  if (sportId === 'swimming') return 'Only the time is needed. Rests at the wall count too.';
  const needed = metrics.filter((m) => m.required).map((m) => m.description.toLowerCase());
  if (!needed.length) return 'Add what you know. A rough number is fine.';
  const list = needed.length === 1 ? needed[0] : `${needed.slice(0, -1).join(', ')} and ${needed[needed.length - 1]}`;
  return `Only the ${list} ${needed.length === 1 ? 'is' : 'are'} needed. A rough number is fine.`;
}

/* ---------------------------------------------------------- File import */

/** The file's first recorded activity (a GPX route only if there is nothing else). */
export function pickActivity(data: ActivityImport): ImportedActivity | null {
  return data.activities.find((a) => a.kind === 'activity') ?? data.activities[0] ?? null;
}

const METRES_PER_UNIT: Record<string, number> = { m: 1, km: 1000, mi: 1609.344 };

/** Length and distance from the file, in the form's units; other fields keep what was typed. */
export function valuesFromImport(metrics: SportMetric[], current: FormValues, activity: ImportedActivity): FormValues {
  const next = { ...current };
  const seconds = activity.timerTimeSeconds ?? activity.elapsedTimeSeconds;
  const duration = durationMetric(metrics);
  if (seconds && seconds > 0) next[duration.key] = String(Math.max(1, Math.round(seconds / 60)));

  const distance = metrics.find((m) => m.key === 'distance' && m.unit && METRES_PER_UNIT[m.unit]);
  if (distance && activity.distanceMeters !== null) {
    const amount = activity.distanceMeters / METRES_PER_UNIT[distance.unit as string];
    next[distance.key] =
      distance.value_schema.type === 'integer' ? String(Math.round(amount)) : String(Number(amount.toFixed(2)));
  }
  return next;
}

/** Short copy for a failed import; retrying means choosing the file again. */
export function importErrorMessage(code: ActivityImportErrorCode | null): string {
  switch (code) {
    case 'busy':
      return 'Still reading the last file. Try again in a moment.';
    case 'picker-failed':
    case 'read-failed':
      return "We couldn't open that file. Try choosing it again.";
    case 'unsupported-format':
      return 'Choose a .fit or .gpx file from your watch app.';
    case 'file-too-large':
      return 'That file is too big to read. Files up to 10 MB work.';
    case 'invalid-file':
      return "We couldn't read that file. Try a fresh export from your watch app.";
    case 'no-activities':
      return 'That file has no workout in it.';
    default:
      return "We couldn't read that file. Try again.";
  }
}
