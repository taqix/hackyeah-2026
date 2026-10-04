/**
 * The product API's wire types: a hand-written mirror of
 * `packages/contracts/src/product.ts` (contract_version "1"), including the
 * additive extensions (nullable completion feedback, PUT /completions/feedback,
 * opinions, POST /plans/undo, POST /google/token and the google_calendar
 * availability source). Mobile does not import the contract, because
 * the package ships zod and builds to dist/; tests/remote/contract-compat.test.ts
 * fails typecheck when this mirror and the contract source drift apart.
 *
 * Conventions: sport IDs are bigint decimal strings; other IDs are UUIDs;
 * instants are ISO 8601 with Z or an offset; dates are YYYY-MM-DD.
 */

/** A catalog sport ID as the API sends it, e.g. "3". The app uses slugs (see data.ts). */
export type WireSportId = string;

/* ------------------------------------------------------------ Profile */

export interface WirePreferredWindow {
  /** 7–20. */
  start_hour: number;
  /** 8–21, greater than start_hour. */
  end_hour: number;
}

/** Strict on the server: unknown keys are rejected. */
export interface PreferencesDto {
  starting_comfort: 'starting_out' | 'occasionally_active' | 'some_routine';
  sessions_per_week: number;
  session_minutes: number;
  preferred_window: WirePreferredWindow | null;
  /** At most 20 unique catalog IDs; empty requires discovery_preference explore. */
  activity_interests: WireSportId[];
  discovery_preference: 'selected_only' | 'occasional' | 'explore';
  available_locations: ('home' | 'outdoors' | 'gym' | 'pool')[];
  available_equipment: ('mat' | 'resistance_band' | 'dumbbells' | 'bicycle' | 'stationary_bike')[];
  avoidances: ('jumping' | 'floor_exercises' | 'noisy_activities')[];
  starting_obstacles: ('time' | 'low_energy' | 'boredom' | 'uncertainty' | 'discomfort')[];
  excluded_activity_types: WireSportId[];
  timezone: string;
}

export interface ProfileEntity {
  id: string;
  username: string | null;
  created_at: string | null;
  /** Null until onboarding is saved. */
  preferences: PreferencesDto | null;
}

/** PUT /profile replaces the whole document. */
export interface UpdateProfileDto {
  username: string | null;
  preferences: PreferencesDto;
}

/* ------------------------------------------------------------- Sports */

export interface MetricDefinition {
  key: string;
  label: string;
  unit: string | null;
  type: 'number' | 'text';
  required: boolean;
  minimum?: number;
  maximum?: number;
}

export interface SportEntity {
  id: WireSportId;
  name: string;
  is_gym: boolean;
  /** False marks a preview sport that cannot be planned. */
  generation_enabled: boolean;
  /** At most five. */
  metrics: MetricDefinition[];
}

/* -------------------------------------------------------------- Plans */

export interface AvailableSlot {
  start_at: string;
  end_at: string;
}

export interface AvailabilityDto {
  /** Extension: google_calendar is free time read from Google Calendar's free/busy. */
  source: 'device_calendar' | 'google_calendar' | 'manual';
  captured_at: string;
  /** At most 100, sorted, non-overlapping. `[]` means no free time. */
  slots: AvailableSlot[];
}

export interface PlannedGymExercise {
  /** Unique in the activity; the library's exercise ID when the planner used one. */
  id: string;
  name: string;
  /** 1–10 sets, repetitions 1–100. */
  sets: { repetitions: number }[];
}

export interface PlannedActivity {
  id: string;
  sport_id: WireSportId;
  title: string;
  description: string;
  start_at: string;
  /** 5–60 in steps of 5. */
  duration_minutes: number;
  /** [] for non-gym sports. */
  gym_exercises: PlannedGymExercise[];
}

/** One week's complete plan. A saved empty week has `activities: []`. */
export interface PlanSnapshot {
  week_start: string;
  timezone: string;
  /** At most seven, inside the local week, no overlaps. */
  activities: PlannedActivity[];
}

export interface PlanEntity {
  id: string;
  profile_id: string;
  active_version_id: string | null;
  created_at: string;
}

/** `undo` is a contract extension (POST /plans/undo). */
export type PlanVersionOrigin = 'generate' | 'revise' | 'undo';

export interface PlanVersionEntity {
  id: string;
  plan_id: string;
  profile_id: string;
  /** Positive, increasing across all weeks of the plan. */
  version: number;
  origin: PlanVersionOrigin;
  plan: PlanSnapshot;
  summary: string;
  created_at: string;
}

export interface ActivePlanDto {
  plan: PlanEntity;
  version: PlanVersionEntity;
}

export interface GeneratePlanDto {
  request_id: string;
  /** The active version, or 0 without a plan. */
  expected_version: number;
  /** Null from mobile: plan from preferences. */
  sport_id: WireSportId | null;
  week_start: string;
  availability: AvailabilityDto;
}

/** Extension: restores the version before the active `revise` version of the same week. */
export interface UndoPlanDto {
  request_id: string;
  plan_id: string;
  expected_version: number;
}

/* --------------------------------------------------------------- Chat */

export interface ChatMessageEntity {
  id: string;
  profile_id: string;
  plan_id: string;
  role: 'user' | 'assistant';
  content: string;
  /** Null for user messages. */
  outcome: 'plan_updated' | 'reply' | 'clarification' | null;
  /** The new version for plan_updated. */
  plan_version_id: string | null;
  created_at: string;
  request_id: string;
}

export interface SendChatDto {
  request_id: string;
  plan_id: string;
  /** The active version; positive. */
  expected_version: number;
  /** 1–2000 characters. */
  message: string;
  activity_id?: string;
  availability: AvailabilityDto;
}

export type ChatResultDto =
  | { outcome: 'plan_updated'; active_plan: ActivePlanDto; messages: ChatMessageEntity[] }
  | { outcome: 'reply' | 'clarification'; active_plan: null; messages: ChatMessageEntity[] };

/* -------------------------------------------------------- Completions */

export interface FeedbackDto {
  effort: 'easy' | 'okay' | 'hard' | 'too_much';
  /** "Would you choose this again?"; null means no opinion. */
  enjoyment: 'yes' | 'maybe' | 'no' | null;
  /** At most 1000 characters; '' when absent. */
  notes: string;
}

/** At most five keys; numbers finite and ≥ 0, strings at most 200 characters. */
export type MetricValues = Record<string, number | string>;

export interface GymLogEntry {
  /** An exercise ID from the planned activity; unique in the log. */
  exercise_id: string;
  /** 1–10 sets; repetitions 0–100, weight_kg null or 0–1000. */
  sets: { repetitions: number; weight_kg: number | null }[];
}

export interface CompleteActivityDto {
  plan_version_id: string;
  activity_id: string;
  request_id: string;
  metrics: MetricValues;
  gym_log: GymLogEntry[];
  /** Nullable by extension: feedback can be given later with PUT /completions/feedback. */
  feedback: FeedbackDto | null;
  /** At most 5 minutes ahead of the server clock. */
  completed_at: string;
}

export interface ActivityCompletionEntity extends CompleteActivityDto {
  id: string;
  profile_id: string;
}

/** Extension: PUT /completions/feedback. */
export interface UpdateFeedbackDto {
  completion_id: string;
  feedback: FeedbackDto;
}

/* ----------------------------------------------------------- Opinions */

export type OpinionValue = 'yes' | 'maybe' | 'no';

/** Extension: GET /opinions, newest updated_at first. */
export interface ActivityOpinionEntity {
  /** 1–100 characters, `^[a-z0-9][a-z0-9_-]*$`. */
  activity_key: string;
  title: string;
  sport_id: WireSportId;
  opinion: OpinionValue;
  last_date: string;
  updated_at: string;
}

/** Extension: PUT /opinions; a null opinion clears it (the response data is then null). */
export interface PutOpinionDto {
  activity_key: string;
  title: string;
  sport_id: WireSportId;
  opinion: OpinionValue | null;
  last_date: string;
}

/** Extension: POST /opinions/reset with `{}`. */
export interface ClearedDto {
  cleared: number;
}

/* ------------------------------------------------------ Google Calendar */

/** Extension: POST /google/token. The refresh token stays on the device otherwise. */
export interface GoogleTokenDto {
  /** 1–2048 characters. */
  refresh_token: string;
}

/** Extension: POST /google/token's data, a new Google access token. */
export interface GoogleTokenResultDto {
  access_token: string;
  /** Seconds until it expires, a positive integer. */
  expires_in: number;
}

/* ------------------------------------------------------------ Envelope */

export type WireErrorCode =
  | 'INVALID_REQUEST'
  | 'UNAUTHENTICATED'
  | 'NOT_FOUND'
  | 'VERSION_CONFLICT'
  | 'REQUEST_CONFLICT'
  | 'ALREADY_COMPLETED'
  | 'AI_NOT_CONFIGURED'
  | 'INVALID_AI_OUTPUT'
  | 'PROVIDER_UNAVAILABLE'
  | 'DATA_UNAVAILABLE'
  | 'INTERNAL_ERROR'
  | 'METHOD_NOT_ALLOWED'
  | 'PAYLOAD_TOO_LARGE'
  /** Extension: the active version is not a chat change. */
  | 'NOTHING_TO_UNDO'
  /** Extension: a done session differs between the two versions. */
  | 'UNDO_LOCKED'
  /** Extension (501): the function has no Google OAuth client secrets. */
  | 'GOOGLE_NOT_CONFIGURED'
  /** Extension (409): Google rejected the refresh token; reconnect Google Calendar. */
  | 'GOOGLE_RECONNECT_REQUIRED';

export interface WireMeta {
  contract_version: '1';
  request_id: string | null;
}

export interface WireEnvelope<T> {
  data: T;
  meta: WireMeta;
}

export interface WireErrorEnvelope {
  error: { code: WireErrorCode; message: string; retryable: boolean };
  meta: WireMeta;
}

/** Collections page with limit 1–100 (default 50) and offset 0–10000. */
export const PAGE_LIMIT = 100;
export const MAX_OFFSET = 10_000;
