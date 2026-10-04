/**
 * Mobile client view of the application API.
 *
 * The NestJS application API is not defined yet. Shapes that exist in the plan
 * exchange on `codex/gemini-plan-contract` (packages/contracts/src/plan-types.ts)
 * are mirrored here with the same field names: the sport catalog, metrics,
 * preferences, time slots and workouts. Everything marked "Proposal" is what the
 * design needs beyond that contract (design/README.md lists them as "Not decided
 * yet"). When the backend lands, move the agreed parts to `packages/contracts`
 * and swap the mock client in `src/api/mock` for an HTTP one; screens only use
 * the hooks in `src/api/hooks`, so they keep working.
 *
 * Conventions: snake_case fields like the contract; instants are ISO 8601 with
 * an explicit offset; calendar days are local `YYYY-MM-DD` in the user's
 * timezone; durations are seconds unless the name says minutes.
 */

/** ISO 8601 instant with an explicit offset, e.g. 2026-10-07T07:00:00+02:00. */
export type IsoDateTime = string;
/** Local calendar day in the user's timezone, e.g. 2026-10-07. */
export type LocalDate = string;
/** 24-hour local time without leading zero, e.g. 7:00 or 18:30. */
export type LocalTime = string;

/* ------------------------------------------------------------------ Auth */

/**
 * How the account signs in. `guest`: a web guest (Continue as guest), an
 * anonymous account with no email or password that lives in one browser
 * until it is saved with an email (`auth.upgradeGuest`).
 */
export type AuthProvider = 'google' | 'email' | 'guest';

export interface User {
  id: string;
  /** Empty for a guest, which has no email. */
  email: string;
  /**
   * The name the person is greeted by: asked at sign-up, from Google, or set in
   * Settings › Account. Null when the account has none (the greeting then omits it).
   */
  name: string | null;
  provider: AuthProvider;
  created_at: IsoDateTime;
}

export interface AuthSession {
  user: User;
  /** Supabase access token sent to NestJS. Opaque to the app. */
  access_token: string;
}

/** A web guest's account: anonymous, kept in this browser until saved with an email. */
export const isGuest = (user: Pick<User, 'provider'> | null | undefined): boolean => user?.provider === 'guest';

/** The name a new guest is greeted by (Settings › Account › Name changes it). */
export const GUEST_NAME = 'Guest';

/** Which sign-in methods the server has switched on (Welcome hides Google while it is off). */
export interface AuthProviders {
  google: boolean;
}

/** One email field for everyone: an existing account asks for its password, a new one creates it. */
export interface EmailLookup {
  email: string;
  exists: boolean;
}

/* --------------------------------------------------------- Sport catalog */

/** A deliberately small JSON Schema subset for database-defined metric values (contract). */
export type MetricValueSchema =
  | { type: 'number' | 'integer'; minimum?: number; maximum?: number; enum?: number[] }
  | {
      type: 'string';
      minLength?: number;
      maxLength?: number;
      enum?: string[];
      format?: 'date' | 'date-time' | 'time' | 'duration';
    }
  | { type: 'boolean' };

export type MetricValue = string | number | boolean;

export interface SportMetric {
  key: string;
  /** Used as the field label. */
  description: string;
  required: boolean;
  value_schema: MetricValueSchema;
  unit?: string;
  /** The metric measuring the whole session, stored in seconds, typed in minutes. */
  represents_session_duration?: boolean;
}

/** How a gym exercise is logged. Proposal: the contract has sets and repetitions only. */
export type ExerciseTracking = 'reps' | 'time';

export interface ExerciseDefinition {
  id: string;
  name: string;
  /** One sentence; there are no demo videos in the MVP. */
  description: string;
  /** Proposal. Defaults to reps. */
  tracking?: ExerciseTracking;
  /** Proposal: "2 × 8 each side". */
  per_side?: boolean;
  /** Proposal: whether the steppers show a weight (kg). */
  uses_weight?: boolean;
  /** Proposal: stepper increment for the weight, e.g. 2 for dumbbells. */
  weight_step_kg?: number;
  /** Proposal: rest after a set, seconds. Defaults to 60. */
  rest_seconds?: number;
}

interface SportBase {
  id: string;
  name: string;
  description: string;
  /** Preparation and wrap-up allowance, each side, seconds. Defaults to 300. */
  buffer_seconds?: number;
  /**
   * Proposal: preview sports are shown clearly marked and cannot be planned yet
   * (docs/product.md: gym, fitness, running and football are the working sports).
   */
  availability: 'working' | 'preview';
  /** Proposal: shown as one of the six suggested tags in onboarding. */
  suggested?: boolean;
}

export type SportDefinition = SportBase &
  ({ is_gym: 0; metrics: SportMetric[] } | { is_gym: 1; exercises?: ExerciseDefinition[] });

/* ----------------------------------------------------------- Preferences */

export type StartingComfort = 'starting_out' | 'occasionally_active' | 'some_routine';
export type DiscoveryPreference = 'selected_only' | 'occasional' | 'explore';
export type LocationOption = 'home' | 'outdoors' | 'gym' | 'pool';
export type EquipmentOption = 'mat' | 'resistance_band' | 'dumbbells' | 'bicycle' | 'stationary_bike';
export type AvoidanceOption = 'jumping' | 'floor_exercises' | 'noisy_activities';
export type ObstacleOption = 'time' | 'low_energy' | 'boredom' | 'uncertainty' | 'discomfort';

/**
 * The person's answers, stored on the server as one JSON document. Shape follows
 * the 3 October review (preferred_window, starting_obstacles as an array,
 * activity_interests as catalog IDs); PREFERENCES.md still needs updating.
 */
export interface Preferences {
  /** From the device, never asked. IANA name. */
  timezone: string;
  starting_comfort: StartingComfort;
  /** 1–7. */
  sessions_per_week: number;
  /** 5–60 in steps of 5. The plan contract calls this preferred_duration (seconds). */
  session_minutes: number;
  /** Whole hours inside 7–21, at least one hour wide; null means any time. */
  preferred_window: [number, number] | null;
  /** Catalog sport IDs. */
  activity_interests: string[];
  /** Forced to `explore` when no sport is picked. */
  discovery_preference: DiscoveryPreference;
  /** At least one. */
  available_locations: LocationOption[];
  /** `[]` means no equipment. */
  available_equipment: EquipmentOption[];
  avoidances: AvoidanceOption[];
  starting_obstacles: ObstacleOption[];
  /** Whole activities switched off from feedback. Starts as []. */
  excluded_activity_types: string[];
}

/** The onboarding steps, also the sections of Profile › Edit. */
export type PreferenceSection = 'starting' | 'time' | 'activities' | 'places' | 'extras';

/* ------------------------------------------------------------------ Plan */

/** Contract: durations are seconds; starts are ISO 8601 with an explicit offset. */
export interface TimeSlot {
  start: IsoDateTime;
  duration: number;
}

export interface GymExercise {
  name: string;
  exercise_id?: string;
  sets: number;
  repetitions: number;
  description: string;
  /** Proposal: seconds per round for time-tracked exercises (holds, warm-up walks). */
  hold_seconds?: number;
}

/** Contract workout details: non-gym metrics and ordered parts, or gym exercises. */
export type WorkoutDetails =
  | { metrics: Record<string, MetricValue>; parts: { description: string }[] }
  | { exercises: GymExercise[] };

export type SessionStatus = 'planned' | 'completed' | 'skipped';

interface PlannedSessionBase {
  id: string;
  sport_id: string;
  /** Proposal: short display title ("Walk-run intervals"); the contract only has a description. */
  title: string;
  time_slot: TimeSlot;
  /** The plan's description, shown as the hero body. Never claims progress the planner didn't get. */
  description: string;
  status: SessionStatus;
  /** Set by the backend; done, skipped and started sessions are not editable. */
  editable: boolean;
  /** The plan version this session belongs to; done sessions keep the version they were done in. */
  plan_version: number;
  /** Proposal: a new activity to try, marked Optional. */
  optional: boolean;
  /** Proposal: the version that last changed this session (Home's Updated tag), or null. */
  changed_in_version: number | null;
  /** The completion log once logged. */
  log_id: string | null;
}

export type PlannedSession = PlannedSessionBase & WorkoutDetails;
export type GymSession = PlannedSessionBase & Extract<WorkoutDetails, { exercises: GymExercise[] }>;
export type MetricSession = PlannedSessionBase & Extract<WorkoutDetails, { parts: { description: string }[] }>;

export function isGymSession(session: PlannedSession): session is GymSession {
  return 'exercises' in session;
}

export type PlanStatus = 'none' | 'building' | 'ready' | 'failed';

export interface PlanState {
  /** none: no plan requested yet; building: first plan generating; failed: no partial plan exists. */
  status: PlanStatus;
  active_version: number | null;
  /** Monday of the first planned week; the week strip pages back to it and no further. */
  first_week_start: LocalDate | null;
  /** Last planned day. Plans go one week ahead, so › opens a week only once it is planned. */
  planned_through: LocalDate | null;
  /** Shown on Home 5.8; answers are kept. */
  failure_message: string | null;
  /**
   * Why the last build failed, with status failed: ai_unavailable means the plan
   * assistant is not connected yet (a provider-pending state, no Try again
   * loop); anything else is a failure worth retrying. Null otherwise.
   */
  failure_code: ApiErrorCode | null;
  /** Home 5.4: the most recent chat change, until the person has seen it on Home. */
  recent_change: { summary: string; chat_message_id: string; created_at: IsoDateTime } | null;
}

export interface PlanWeek {
  /** Monday. */
  week_start: LocalDate;
  /** Sunday. */
  week_end: LocalDate;
  /** False for a future week that is not planned yet. */
  planned: boolean;
  sessions: PlannedSession[];
  /** Workouts added in chat (history, not the plan): shown with an Extra tag, not counted. */
  extras: ActivityLog[];
  /** Proposal (app copy): "Three short sessions, with rest days between." Null for past weeks. */
  summary: string | null;
}

/** answers: a saved answer re-planned the upcoming sessions of the current week. */
export type PlanVersionSource = 'first_plan' | 'weekly_plan' | 'chat' | 'undo' | 'answers';

export interface PlanVersion {
  version: number;
  created_at: IsoDateTime;
  source: PlanVersionSource;
  summary: string;
  /** "Monday and Wednesday were done in this version." */
  kept_note: string | null;
  /** For chat and undo versions: the change card's message, for "See the chat". */
  chat_message_id: string | null;
  active: boolean;
}

/**
 * What to plan. Free time is read by the client itself (device calendar, or
 * the preferred window without access), so callers pass no slots.
 */
export interface BuildPlanInput {
  /** The Monday of the week to plan. Defaults to the current week. */
  week_start?: LocalDate;
  /**
   * One ID per user action (`newRequestId()` in `lib/ids`). Pass the same ID
   * again only to resend the same action after a transport failure (offline,
   * timeout); the server then replays the saved result instead of planning twice.
   */
  request_id?: string;
}

/* ------------------------------------------------------------------ Logs */

export type LogSource = 'typed' | 'file' | 'chat' | 'live';
export type Felt = 'easy' | 'just_right' | 'hard' | 'too_much';
/** Proposal: "Would you choose this again?" per session. */
export type ChooseAgain = 'yes' | 'maybe' | 'no';

export interface SessionFeedback {
  felt: Felt;
  /** Feeds the description our assistant keeps of the person (user_description). */
  note: string | null;
  choose_again: ChooseAgain | null;
  created_at: IsoDateTime;
}

/** One gym set as done. reps/weight for reps tracking, seconds for time tracking. */
export interface LoggedSet {
  exercise_id: string | null;
  exercise_name: string;
  /** 0-based. */
  set_index: number;
  reps: number | null;
  weight_kg: number | null;
  seconds: number | null;
}

/** Proposal: a completed session (logged afterwards, live gym, or added in chat). */
export interface ActivityLog {
  id: string;
  /** Null for a workout done outside the plan (an extra). */
  session_id: string | null;
  sport_id: string;
  title: string;
  started_at: IsoDateTime;
  duration_seconds: number;
  source: LogSource;
  /** The imported .fit/.gpx file's name when source is file. */
  file_name: string | null;
  /** Non-gym metric values by metric key; the session-duration metric is in seconds. */
  metrics: Record<string, MetricValue>;
  /** Gym sets, in the order done. */
  sets: LoggedSet[];
  /** Ending a gym session early saves what was done; it still counts as done. */
  ended_early: boolean;
  extra: boolean;
  feedback: SessionFeedback | null;
  created_at: IsoDateTime;
  /**
   * True once the log is saved on the server: its time, metrics and sets can
   * no longer change (feedback still can), so Edit and Fix sets are hidden.
   * Unset or false: editable (a local draft, or any mock log).
   */
  actuals_locked?: boolean;
}

export interface CreateLogInput {
  session_id: string | null;
  sport_id: string;
  started_at: IsoDateTime;
  duration_seconds: number;
  source: LogSource;
  file_name?: string | null;
  metrics?: Record<string, MetricValue>;
  sets?: LoggedSet[];
  ended_early?: boolean;
}

export type UpdateLogInput = Partial<
  Pick<ActivityLog, 'started_at' | 'duration_seconds' | 'metrics' | 'sets' | 'file_name' | 'source'>
>;

export interface SaveFeedbackInput {
  felt: Felt;
  note: string | null;
  choose_again: ChooseAgain | null;
}

/** "Last time, Mon 12 Oct: 3 × 10 · 8 kg": pre-fills the first set's weight. */
export interface LastExerciseResult {
  exercise_name: string;
  date: LocalDate;
  sets: number;
  reps: number | null;
  weight_kg: number | null;
}

/* ------------------------------------------------------------------ Chat */

/** A session attached to a chat message ("Today · Walk-run intervals"). */
export interface SessionRef {
  session_id: string;
  date: LocalDate;
  title: string;
  sport_id: string;
}

/** One changed value, old (struck through) → new. Null `from` means newly set. */
export type ChangeDiff =
  | { field: 'date'; from: LocalDate | null; to: LocalDate }
  | { field: 'time'; from: LocalTime | null; to: LocalTime }
  | { field: 'duration'; from: number | null; to: number };

export type ChangeRowKind = 'changed' | 'moved' | 'added' | 'removed' | 'swapped';

/** One row per changed session, in day order. Done, skipped and started sessions are never rows. */
export interface ChangeRow {
  kind: ChangeRowKind;
  session_id: string;
  /** The day the session is on now (for removed: the day it was on). */
  date: LocalDate;
  title: string;
  /** For swapped sessions: the old title, struck through above the new one. */
  was_title: string | null;
  sport_id: string;
  diffs: ChangeDiff[];
  /** "Three runs instead of six." */
  note: string | null;
}

/** Proposal: the change card (the Gemini modify mode returns a message and operations only). */
export interface PlanChange {
  from_version: number;
  to_version: number;
  /** One line: "All your sessions are at 7:00 now, and Friday is 10 minutes." */
  summary: string;
  /** A sport switch adds a Sport row. Catalog sport IDs. */
  sport_switch: { from: string; to: string } | null;
  rows: ChangeRow[];
  /** What couldn't change, with the reason: "7:00, not 6:00 — Sessions are planned between 7:00 and 21:00." */
  not_changed: { title: string; reason: string }[];
  /** The lock line naming what stays: "Monday to Wednesday stay as you did them." */
  kept: string;
  /** Only the newest card has Undo; it goes once a newer change exists or a changed session started. */
  can_undo: boolean;
  undone: boolean;
}

export type ChatMessage =
  | {
      id: string;
      created_at: IsoDateTime;
      role: 'user';
      kind: 'text';
      text: string;
      about: SessionRef | null;
    }
  | {
      id: string;
      created_at: IsoDateTime;
      role: 'coach';
      /** A message that changed nothing. */
      kind: 'reply';
      text: string;
      /** Send at once when tapped. */
      quick_replies: string[];
      /** The last, least prominent answer (8.15 "Skip it this time" with "Nothing to make up."). */
      quiet_option: { label: string; note: string | null } | null;
      /** Under the message: "Plan unchanged", or "Nothing saved yet" under a question about a workout. */
      foot: 'plan_unchanged' | 'nothing_saved';
    }
  | {
      id: string;
      created_at: IsoDateTime;
      role: 'coach';
      kind: 'change';
      change: PlanChange;
    }
  | {
      id: string;
      created_at: IsoDateTime;
      role: 'coach';
      /** 8.16: a workout done outside the plan, saved as history. */
      kind: 'workout_logged';
      log: ActivityLog;
      can_undo: boolean;
      undone: boolean;
    };

export interface SendChatInput {
  text: string;
  /** The session attached from Not today, an activity's Adjust, or Move it. */
  about_session_id: string | null;
  /** The active plan version the request was built on; a stale one is rejected (8.13). */
  base_version: number | null;
  /**
   * One ID per user action (`newRequestId()` in `lib/ids`). Reuse it only for a
   * transport retry of the same message (offline, timeout); a stale_version
   * retry or a new message gets a new one. Omitted: the client makes one.
   */
  request_id?: string;
}

/** The messages a turn added (the user's message first). Refetch the thread for updated cards. */
export interface ChatTurn {
  messages: ChatMessage[];
  plan_changed: boolean;
  active_version: number | null;
}

/* --------------------------------------------------------------- Profile */

export type SummarySourceKind = 'answers' | 'sessions' | 'feedback';

/** A stored fact behind a summary statement. */
export interface SummaryEvidence {
  id: string;
  kind: 'answer' | 'session' | 'feedback';
  title: string;
  detail: string;
  /** Where to change it: an answer opens its Profile › Edit section. */
  section: PreferenceSection | null;
  session_id: string | null;
}

/** Proposal: the 9.2 section a statement sits under. */
export type SummaryGroup = 'enjoy' | 'helps' | 'leave_out';

export interface SummaryStatement {
  id: string;
  /** Proposal: 9.2 groups statements under What you enjoy, What helps, What we leave out. */
  group: SummaryGroup;
  /** Second person, no "I", no scores, streaks, percentages or praise. */
  text: string;
  source_kind: SummarySourceKind;
  /** "From your answers", "From 3 sessions". */
  source_label: string;
  /** At least one; statements without evidence are rejected. */
  evidence: SummaryEvidence[];
}

/** Proposal: our assistant's description of the person (9–9.3). It never changes anything. */
export interface AssistantSummary {
  /** updating keeps the old text marked as updating; unavailable hides the card. */
  status: 'ready' | 'updating' | 'unavailable';
  generated_at: IsoDateTime | null;
  /** With little data it says so (9.1). */
  little_data: boolean;
  /** Proposal: the card's title on the You tab, "Mornings, on foot." */
  title: string;
  /** The one-line body on the You tab. */
  headline: string;
  statements: SummaryStatement[];
}

/** Proposal: "Would you choose this again?" grouped per activity (9.5). */
export interface ActivityOpinion {
  /** Stable key for an activity, e.g. the session title slug. */
  activity_key: string;
  title: string;
  sport_id: string;
  opinion: ChooseAgain;
  last_date: LocalDate;
  /** "a new idea on 15 Oct": an optional session suggested by discovery. */
  new_idea: boolean;
}

export interface FeedbackOverview {
  opinions: ActivityOpinion[];
  /** Same as preferences.excluded_activity_types; listed with Switch on. */
  excluded_sport_ids: string[];
}

/* --------------------------------------------------------------- Account */

export interface Account {
  user: User;
  /** From the device. */
  timezone: string;
}

/* ---------------------------------------------------------------- Errors */

export type ApiErrorCode =
  | 'offline'
  | 'timeout'
  | 'unauthorized'
  | 'invalid_credentials'
  | 'email_taken'
  | 'weak_password'
  | 'not_found'
  | 'validation'
  /** AI timeout, provider failure, or a result that failed validation; the plan stays as it was. */
  | 'generation_failed'
  /** The plan changed elsewhere while the request ran; nothing was applied. */
  | 'stale_version'
  | 'conflict'
  /** The plan assistant is not connected yet (no AI provider). Not retryable; answers and the plan are kept. */
  | 'ai_unavailable'
  /** Sign-up worked, but the email address has to be confirmed before signing in. */
  | 'confirmation_required'
  /** This build has no backend configuration (Supabase URL or key missing). */
  | 'not_configured'
  | 'unknown';

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly retryable: boolean;

  constructor(code: ApiErrorCode, message: string, options?: { retryable?: boolean; cause?: unknown }) {
    super(message, { cause: options?.cause });
    this.name = 'ApiError';
    this.code = code;
    this.retryable =
      options?.retryable ??
      (code === 'offline' || code === 'timeout' || code === 'generation_failed' || code === 'stale_version');
  }
}

export function isApiError(error: unknown, code?: ApiErrorCode): error is ApiError {
  return error instanceof ApiError && (code === undefined || error.code === code);
}
