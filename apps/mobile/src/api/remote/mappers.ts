/**
 * Pure translation between the product API's wire shapes and the app's
 * types. Sport IDs are translated by functions the caller passes (from
 * `data.sportIds()`), so these stay synchronous and easy to test.
 */
import { toIsoWithOffset } from '../../lib/dates';
import { EXERCISES, libraryExercise, librarySport, slugForSportName } from '../../lib/sport-library';
import type {
  ActivityLog,
  GymExercise,
  LoggedSet,
  MetricValue,
  PlannedSession,
  Preferences,
  SaveFeedbackInput,
  SessionFeedback,
  SessionStatus,
  SportDefinition,
  SportMetric,
} from '../types';
import type { Draft } from './drafts';
import type {
  ActivityCompletionEntity,
  FeedbackDto,
  GymLogEntry,
  MetricDefinition,
  MetricValues,
  PlannedActivity,
  PlannedGymExercise,
  PlanVersionEntity,
  PreferencesDto,
  SportEntity,
} from './wire';

/** The catalog metric that measures the whole session, in minutes (the app keeps it in seconds). */
export const DURATION_METRIC_KEY = 'duration_minutes';
/** Contract limits. */
const MAX_TEXT_METRIC = 200;
const MAX_REPS = 100;
const MAX_WEIGHT_KG = 1000;
const MAX_SETS = 10;

export type ToAppSportId = (wireId: string) => string;
export type ToWireSportId = (appId: string) => string | null;

const unique = <T>(values: T[]) => [...new Set(values)];

/* -------------------------------------------------------------- Sports */

export function metricFromWire(metric: MetricDefinition): SportMetric {
  const isDuration = metric.key === DURATION_METRIC_KEY;
  const bounds = {
    ...(metric.minimum !== undefined ? { minimum: metric.minimum } : {}),
    ...(metric.maximum !== undefined ? { maximum: metric.maximum } : {}),
  };
  return {
    key: metric.key,
    description: metric.label,
    required: metric.required,
    value_schema:
      metric.type === 'number'
        ? { type: isDuration ? 'integer' : 'number', ...bounds }
        : { type: 'string', maxLength: MAX_TEXT_METRIC },
    ...(metric.unit ? { unit: metric.unit } : {}),
    ...(isDuration ? { represents_session_duration: true } : {}),
  };
}

/**
 * A catalog row as the app's sport: availability from generation_enabled;
 * description, suggested and buffer from the sport library (by name); gym
 * sports get the library's exercises, since plans name those IDs.
 */
export function sportFromWire(sport: SportEntity, toAppSportId: ToAppSportId): SportDefinition {
  const slug = slugForSportName(sport.name);
  const known = slug ? librarySport(slug) : undefined;
  const base = {
    id: toAppSportId(sport.id),
    name: sport.name,
    description: known?.description ?? '',
    availability: sport.generation_enabled ? ('working' as const) : ('preview' as const),
    ...(known?.suggested && sport.generation_enabled ? { suggested: true } : {}),
    ...(known?.buffer_seconds !== undefined ? { buffer_seconds: known.buffer_seconds } : {}),
  };
  return sport.is_gym
    ? { ...base, is_gym: 1, exercises: EXERCISES }
    : { ...base, is_gym: 0, metrics: sport.metrics.map(metricFromWire) };
}

/* --------------------------------------------------------- Preferences */

/**
 * The app's answers as the contract's document. Sports the catalog does not
 * have are dropped; with no interest left, discovery becomes explore (the
 * contract requires it).
 */
export function preferencesToWire(preferences: Preferences, toWireSportId: ToWireSportId): PreferencesDto {
  const ids = (appIds: string[]) =>
    unique(appIds.map(toWireSportId).filter((id): id is string => id !== null));
  const interests = ids(preferences.activity_interests);
  return {
    starting_comfort: preferences.starting_comfort,
    sessions_per_week: preferences.sessions_per_week,
    session_minutes: preferences.session_minutes,
    preferred_window: preferences.preferred_window
      ? { start_hour: preferences.preferred_window[0], end_hour: preferences.preferred_window[1] }
      : null,
    activity_interests: interests,
    discovery_preference: interests.length ? preferences.discovery_preference : 'explore',
    available_locations: [...preferences.available_locations],
    available_equipment: [...preferences.available_equipment],
    avoidances: [...preferences.avoidances],
    starting_obstacles: [...preferences.starting_obstacles],
    excluded_activity_types: ids(preferences.excluded_activity_types),
    timezone: preferences.timezone,
  };
}

export function preferencesFromWire(dto: PreferencesDto, toAppSportId: ToAppSportId): Preferences {
  return {
    timezone: dto.timezone,
    starting_comfort: dto.starting_comfort,
    sessions_per_week: dto.sessions_per_week,
    session_minutes: dto.session_minutes,
    preferred_window: dto.preferred_window ? [dto.preferred_window.start_hour, dto.preferred_window.end_hour] : null,
    activity_interests: unique(dto.activity_interests.map(toAppSportId)),
    discovery_preference: dto.discovery_preference,
    available_locations: [...dto.available_locations],
    available_equipment: [...dto.available_equipment],
    avoidances: [...dto.avoidances],
    starting_obstacles: [...dto.starting_obstacles],
    excluded_activity_types: unique(dto.excluded_activity_types.map(toAppSportId)),
  };
}

/* ------------------------------------------------------------ Feedback */

/** just_right is the contract's okay; a missing note is ''. */
export function feedbackToWire(feedback: SaveFeedbackInput): FeedbackDto {
  return {
    effort: feedback.felt === 'just_right' ? 'okay' : feedback.felt,
    enjoyment: feedback.choose_again,
    notes: feedback.note?.trim() ?? '',
  };
}

/** The completion has no separate feedback time, so `createdAt` is its completed_at. */
export function feedbackFromWire(feedback: FeedbackDto | null, createdAt: string): SessionFeedback | null {
  if (!feedback) return null;
  return {
    felt: feedback.effort === 'okay' ? 'just_right' : feedback.effort,
    note: feedback.notes.trim() ? feedback.notes : null,
    choose_again: feedback.enjoyment,
    created_at: createdAt,
  };
}

/** "Would you choose this again?" is kept per activity title: 'Easy walk' → 'easy-walk'. */
export function activityKey(title: string): string {
  const key = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100)
    .replace(/-+$/, '');
  return key || 'activity';
}

/* ------------------------------------------------------------ Sessions */

/** Planned exercises: the set count and the first set's repetitions; how-to text from the library. */
export function gymExercisesFromWire(exercises: PlannedGymExercise[]): GymExercise[] {
  return exercises.map((exercise) => ({
    name: exercise.name,
    exercise_id: exercise.id,
    sets: exercise.sets.length,
    repetitions: exercise.sets[0]?.repetitions ?? 0,
    description: libraryExercise(exercise.id)?.description ?? '',
  }));
}

export interface SessionContext {
  /** The saved completion of this activity, if any. */
  completion?: ActivityCompletionEntity | null;
  /** A local log not saved yet; the session already counts as done. */
  draft?: Draft | null;
  now: Date;
  toAppSportId: ToAppSportId;
}

/**
 * A planned activity as the app's session. Done when it has a completion or a
 * draft; editable only while planned and in the future. `version` is the one
 * the activity is read from (see data.findActivity). Optional, skipped and the
 * Updated tag have no backend: callers may set changed_in_version from a diff.
 */
export function sessionFromActivity(
  activity: PlannedActivity,
  version: PlanVersionEntity,
  context: SessionContext,
): PlannedSession {
  const done = !!(context.completion || context.draft);
  const status: SessionStatus = done ? 'completed' : 'planned';
  const base = {
    id: activity.id,
    sport_id: context.toAppSportId(activity.sport_id),
    title: activity.title,
    description: activity.description,
    time_slot: { start: activity.start_at, duration: activity.duration_minutes * 60 },
    status,
    editable: !done && Date.parse(activity.start_at) > context.now.getTime(),
    plan_version: version.version,
    optional: false,
    changed_in_version: null,
    log_id: context.completion?.id ?? context.draft?.id ?? null,
  };
  return activity.gym_exercises.length
    ? { ...base, exercises: gymExercisesFromWire(activity.gym_exercises) }
    : { ...base, metrics: {}, parts: [] };
}

/* ---------------------------------------------------------------- Logs */

/** Saved gym actuals as the app's sets, named from the plan (else the library). */
export function gymLogFromWire(gymLog: GymLogEntry[], activity: PlannedActivity): LoggedSet[] {
  return gymLog.flatMap((entry) => {
    const name =
      activity.gym_exercises.find((exercise) => exercise.id === entry.exercise_id)?.name ??
      libraryExercise(entry.exercise_id)?.name ??
      entry.exercise_id;
    return entry.sets.map((set, index) => ({
      exercise_id: entry.exercise_id,
      exercise_name: name,
      set_index: index,
      reps: set.repetitions,
      weight_kg: set.weight_kg,
      seconds: null,
    }));
  });
}

const plannedSetCount = (activity: PlannedActivity) =>
  activity.gym_exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);

/**
 * A saved completion as the app's log. Duration comes from the duration
 * metric (else the planned length) and the start is completed_at minus it;
 * the source is not stored, so it reads as typed. A gym session with fewer
 * sets than planned counts as ended early.
 */
export function logFromCompletion(
  completion: ActivityCompletionEntity,
  activity: PlannedActivity,
  toAppSportId: ToAppSportId,
): ActivityLog {
  const minutes = completion.metrics[DURATION_METRIC_KEY];
  const durationSeconds =
    typeof minutes === 'number' && minutes > 0 ? Math.round(minutes * 60) : activity.duration_minutes * 60;
  const metrics: Record<string, MetricValue> = {};
  for (const [key, value] of Object.entries(completion.metrics)) {
    metrics[key] = key === DURATION_METRIC_KEY && typeof value === 'number' ? Math.round(value * 60) : value;
  }
  const sets = gymLogFromWire(completion.gym_log, activity);
  return {
    id: completion.id,
    session_id: completion.activity_id,
    sport_id: toAppSportId(activity.sport_id),
    title: activity.title,
    started_at: toIsoWithOffset(new Date(Date.parse(completion.completed_at) - durationSeconds * 1000)),
    duration_seconds: durationSeconds,
    source: 'typed',
    file_name: null,
    metrics,
    sets,
    ended_early: activity.gym_exercises.length > 0 && sets.length < plannedSetCount(activity),
    extra: false,
    feedback: feedbackFromWire(completion.feedback, completion.completed_at),
    created_at: completion.completed_at,
    actuals_locked: true,
  };
}

/** A local draft as the app's log (no feedback yet). */
export function logFromDraft(draft: Draft): ActivityLog {
  return {
    id: draft.id,
    session_id: draft.activity_id,
    sport_id: draft.sport_id,
    title: draft.title,
    started_at: draft.started_at,
    duration_seconds: draft.duration_seconds,
    source: draft.source,
    file_name: draft.file_name,
    metrics: { ...draft.metrics },
    sets: draft.sets.map((set) => ({ ...set })),
    ended_early: draft.ended_early,
    extra: false,
    feedback: null,
    created_at: draft.created_at,
    actuals_locked: false,
  };
}

/**
 * The app's metric values as the completion's: only the sport's own keys;
 * the duration metric from seconds to whole minutes (`durationSeconds` fills
 * it when the form had none, e.g. a gym session); numbers finite and ≥ 0;
 * text trimmed to 200 characters; booleans and blanks dropped.
 */
export function metricsToWire(
  metrics: Record<string, MetricValue>,
  sport: SportEntity,
  durationSeconds?: number,
): MetricValues {
  const values: MetricValues = {};
  for (const definition of sport.metrics) {
    const value = metrics[definition.key];
    if (definition.key === DURATION_METRIC_KEY && definition.type === 'number') {
      const seconds = typeof value === 'number' ? value : durationSeconds;
      if (seconds !== undefined && Number.isFinite(seconds) && seconds > 0) {
        values[definition.key] = Math.max(1, Math.round(seconds / 60));
      }
      continue;
    }
    if (value === undefined || typeof value === 'boolean') continue;
    if (definition.type === 'number') {
      const number = typeof value === 'number' ? value : value.trim() ? Number(value.trim()) : Number.NaN;
      if (Number.isFinite(number) && number >= 0) values[definition.key] = number;
    } else {
      const text = String(value).trim();
      if (text) values[definition.key] = text.slice(0, MAX_TEXT_METRIC);
    }
  }
  return values;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Gym sets as the completion's gym_log: grouped per planned exercise (by ID,
 * else by name) in plan order, sets in set order, at most 10 each. Exercises
 * not in the plan or without sets are left out. A timed set (no reps) is sent
 * with 0 repetitions, since the contract has no seconds.
 */
export function gymLogToWire(sets: LoggedSet[], activity: PlannedActivity): GymLogEntry[] {
  const planned = activity.gym_exercises;
  const byExercise = new Map<string, LoggedSet[]>();
  for (const set of sets) {
    const id =
      (set.exercise_id && planned.some((exercise) => exercise.id === set.exercise_id) ? set.exercise_id : null) ??
      planned.find((exercise) => exercise.name.trim().toLowerCase() === set.exercise_name.trim().toLowerCase())?.id;
    if (!id) continue;
    byExercise.set(id, [...(byExercise.get(id) ?? []), set]);
  }
  return planned.flatMap((exercise) => {
    const done = byExercise.get(exercise.id);
    if (!done?.length) return [];
    return [
      {
        exercise_id: exercise.id,
        sets: [...done]
          .sort((a, b) => a.set_index - b.set_index)
          .slice(0, MAX_SETS)
          .map((set) => ({
            repetitions: clamp(Math.round(set.reps ?? 0), 0, MAX_REPS),
            weight_kg:
              set.weight_kg === null || !Number.isFinite(set.weight_kg) ? null : clamp(set.weight_kg, 0, MAX_WEIGHT_KG),
          })),
      },
    ];
  });
}
