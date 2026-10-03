/**
 * The mock database's shape. Plain JSON, so it persists as one AsyncStorage
 * value and the pure backend can run on it in Node tests.
 */
import type {
  ActivityLog,
  ActivityOpinion,
  ChatMessage,
  IsoDateTime,
  LocalDate,
  PlannedSession,
  PlanState,
  PlanVersionSource,
  Preferences,
  TimeSlot,
  User,
} from '../types';

export const DB_SCHEMA = 1;

export interface MockAccount {
  user: User;
  /** Null for Google accounts. */
  password: string | null;
}

/** A plan version with the sessions it planned at the time. */
export interface StoredVersion {
  version: number;
  created_at: IsoDateTime;
  source: PlanVersionSource;
  summary: string;
  chat_message_id: string | null;
  snapshot: PlannedSession[];
}

/** What a chat change replaced, so Undo can restore it. */
export interface ChangeRecord {
  message_id: string;
  /** The changed sessions as they were before (removed ones included). */
  before: PlannedSession[];
  /** Sessions the change created. */
  added_ids: string[];
}

/** A workout described in chat, waiting for how long it took. */
export interface WorkoutDraft {
  sport_id: string | null;
  title: string | null;
  date: LocalDate;
  minutes: number | null;
  /** In the sport's distance unit. */
  distance: number | null;
  evening: boolean;
}

/** What the coach asked last, so a short answer ("30 min", "Thursday") completes it. */
export type PendingCoach =
  | { kind: 'workout'; draft: WorkoutDraft }
  | { kind: 'move'; session_id: string }
  | { kind: 'easier'; session_id: string | null };

export interface PlanMeta extends PlanState {
  /** A first plan in progress: settles at `ready_at_ms` (device clock). */
  build: { ready_at_ms: number; fail: boolean; slots: TimeSlot[] | null } | null;
}

export interface UserData {
  preferences: Preferences | null;
  plan: PlanMeta;
  /** Every session ever planned (history and the active plan). */
  sessions: PlannedSession[];
  versions: StoredVersion[];
  logs: ActivityLog[];
  chat: ChatMessage[];
  changes: ChangeRecord[];
  pending: PendingCoach | null;
  /** Messages that failed with the demo "fail" keyword; a resend goes through. */
  failed_texts: string[];
  opinions: ActivityOpinion[];
  /** When anything the summary reads last changed. */
  summary_at: IsoDateTime | null;
}

export interface MockDb {
  schema: typeof DB_SCHEMA;
  /** ID counter. */
  seq: number;
  accounts: MockAccount[];
  session_user_id: string | null;
  users: Record<string, UserData>;
}

export function emptyPlan(): PlanMeta {
  return {
    status: 'none',
    active_version: null,
    first_week_start: null,
    planned_through: null,
    failure_message: null,
    recent_change: null,
    build: null,
  };
}

export function emptyUserData(): UserData {
  return {
    preferences: null,
    plan: emptyPlan(),
    sessions: [],
    versions: [],
    logs: [],
    chat: [],
    changes: [],
    pending: null,
    failed_texts: [],
    opinions: [],
    summary_at: null,
  };
}

export function emptyDb(): MockDb {
  return { schema: DB_SCHEMA, seq: 1, accounts: [], session_user_id: null, users: {} };
}

/** A fresh ID with a readable prefix: s_12, log_13. */
export function nextId(db: MockDb, prefix: string): string {
  const id = `${prefix}_${db.seq}`;
  db.seq += 1;
  return id;
}

/** Stable key for an activity's opinion: the session title as a slug. */
export function activityKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
