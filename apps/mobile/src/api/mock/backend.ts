/**
 * The mock backend's logic: every ApiClient call as a synchronous function on
 * a plain MockDb, with no storage, latency or demo switches (client.ts adds
 * those). Pure, so tests run it in Node with a fixed clock.
 */
import {
  addDays,
  atLocalTime,
  diffDays,
  formatDayLong,
  formatTime,
  joinAnd,
  numberWord,
  startOfWeek,
  toIsoWithOffset,
  toLocalDate,
  weekdayIndex,
} from '../../lib/dates';
import { answersSentence } from '../../lib/preference-options';
import { sessionLocalDate, sessionMinutes, sessionStart, sortSessions } from '../../lib/sessions';
import {
  ApiError,
  type Account,
  type ActivityLog,
  type AssistantSummary,
  type AuthProviders,
  type AuthSession,
  type ChatMessage,
  type ChatTurn,
  type ChooseAgain,
  type CreateLogInput,
  type EmailLookup,
  type FeedbackOverview,
  type LastExerciseResult,
  type LocalDate,
  type PlannedSession,
  type PlanState,
  type PlanVersion,
  type PlanWeek,
  type Preferences,
  type SaveFeedbackInput,
  type SendChatInput,
  type SportDefinition,
  type TimeSlot,
  type UpdateLogInput,
  type User,
} from '../types';
import { SPORTS } from './catalog';
import { coach, type CoachChange, type CoachLog } from './coach';
import { activityKey, emptyUserData, nextId, type MockAccount, type MockDb, type UserData } from './model';
import { generatePlanWeek, summarizeWeek, weeklyVersionSummary } from './planner';
import { buildSummary } from './summary';

export interface BackendDeps {
  db: () => MockDb;
  /** The app's "now" (demo time travel included). */
  now: () => Date;
  /** The device clock, for the ~3 s plan build. */
  wallMs?: () => number;
  catalog?: SportDefinition[];
}

export const BUILD_MS = 3_000;
export const GOOGLE_EMAIL = 'sam@gmail.example';
/** The one password that is always wrong, to show 1.3. */
export const WRONG_PASSWORD = 'wrong-password';
const FAILURE_MESSAGE = 'Something went wrong on our side. Your answers are saved, so trying again only takes a moment.';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeEmail = (email: string) => email.trim().toLowerCase();

function validateEmail(email: string): string {
  const e = normalizeEmail(email);
  if (!EMAIL.test(e)) throw new ApiError('validation', 'Enter an email address like name@example.com.');
  return e;
}

export function createBackend(deps: BackendDeps) {
  const catalog = deps.catalog ?? SPORTS;
  const wallMs = deps.wallMs ?? (() => Date.now());
  const db = () => deps.db();
  const now = () => deps.now();
  const nowIso = () => toIsoWithOffset(now());
  const today = () => toLocalDate(now());
  const newId = (prefix: string) => () => nextId(db(), prefix);

  /* --------------------------------------------------------- Session */

  function account(): MockAccount {
    const d = db();
    const found = d.accounts.find((a) => a.user.id === d.session_user_id);
    if (!found) throw new ApiError('unauthorized', 'Sign in to continue.');
    return found;
  }

  function data(): UserData {
    const d = db();
    const user = account().user;
    d.users[user.id] ??= emptyUserData();
    return d.users[user.id];
  }

  function sessionFor(user: User): AuthSession {
    return { user, access_token: `mock-token-${user.id}` };
  }

  function createAccount(email: string, password: string | null, name: string | null, provider: User['provider']): MockAccount {
    const d = db();
    const user: User = { id: nextId(d, 'user'), email, name, provider, created_at: nowIso() };
    const acc = { user, password };
    d.accounts.push(acc);
    d.users[user.id] = emptyUserData();
    return acc;
  }

  /* ------------------------------------------------------- Read helpers */

  const editable = (s: PlannedSession): PlannedSession => ({ ...s, editable: s.status === 'planned' });
  const inRange = (date: LocalDate, from: LocalDate, to: LocalDate) => date >= from && date <= to;
  const extrasIn = (u: UserData, from: LocalDate, to: LocalDate) =>
    u.logs
      .filter((l) => l.extra && inRange(toLocalDate(l.started_at), from, to))
      .sort((a, b) => a.started_at.localeCompare(b.started_at));
  const maxVersion = (u: UserData) => u.versions.reduce((m, v) => Math.max(m, v.version), 0);

  function planState(u: UserData): PlanState {
    const p = u.plan;
    return {
      status: p.status,
      active_version: p.active_version,
      first_week_start: p.first_week_start,
      planned_through: p.planned_through,
      failure_message: p.failure_message,
      failure_code: p.status === 'failed' ? 'generation_failed' : null,
      recent_change: p.recent_change,
    };
  }

  /** Record a new version and make it active. */
  function addVersion(
    u: UserData,
    source: PlanVersion['source'],
    summary: string,
    snapshot: PlannedSession[],
    chatMessageId: string | null = null,
    version = maxVersion(u) + 1,
  ): number {
    u.versions.push({ version, created_at: nowIso(), source, summary, chat_message_id: chatMessageId, snapshot });
    u.plan.active_version = version;
    return version;
  }

  /* ------------------------------------------------------------- Plan */

  function finishBuild(u: UserData) {
    const build = u.plan.build;
    const prefs = u.preferences;
    if (!build || !prefs) return;
    u.plan.build = null;
    if (build.fail) {
      u.plan.status = 'failed';
      u.plan.failure_message = FAILURE_MESSAGE;
      return;
    }
    const from = today();
    const to = addDays(from, 6);
    const version = maxVersion(u) + 1;
    const sessions = generatePlanWeek(
      prefs,
      catalog,
      { from, to, version, notBefore: now(), newId: newId('s') },
      build.slots,
      u.sessions,
    );
    u.sessions.push(...sessions);
    addVersion(u, 'first_plan', `Built from your answers: ${answersSentence(prefs, catalog)}.`, sessions, null, version);
    Object.assign(u.plan, {
      status: 'ready',
      first_week_start: startOfWeek(from),
      planned_through: to,
      failure_message: null,
    });
  }

  /** Plan `count` sessions into [from, to] as a weekly_plan version. */
  function planWeek(u: UserData, from: LocalDate, to: LocalDate, count: number, newIdea: boolean) {
    const prefs = u.preferences;
    if (!prefs || from > to) return;
    const version = maxVersion(u) + 1;
    const sessions = generatePlanWeek(
      prefs,
      catalog,
      { from, to, version, count, newIdea, notBefore: from === today() ? now() : undefined, newId: newId('s') },
      null,
      u.sessions,
    );
    u.plan.planned_through = to;
    if (!sessions.length) return;
    u.sessions.push(...sessions);
    const weekStart = startOfWeek(from);
    const weekNumber = Math.floor(diffDays(u.plan.first_week_start ?? weekStart, weekStart) / 7) + 1;
    const weekSessions = u.sessions.filter((s) => inRange(sessionLocalDate(s), weekStart, addDays(weekStart, 6)));
    addVersion(u, 'weekly_plan', weeklyVersionSummary(weekNumber, weekStart, weekSessions), sessions, null, version);
  }

  /** Plans run one week ahead: on Sunday the next week is planned; a return after a gap plans this week. */
  function ensureWeeks(u: UserData) {
    const prefs = u.preferences;
    if (u.plan.status !== 'ready' || !prefs || !u.plan.planned_through) return;
    const t = today();
    const weekStart = startOfWeek(t);
    const weekEnd = addDays(weekStart, 6);
    const countIn = (from: LocalDate, to: LocalDate) =>
      u.sessions.filter((s) => !s.optional && s.status !== 'skipped' && inRange(sessionLocalDate(s), from, to)).length;
    if (u.plan.planned_through < t) {
      const daysLeft = diffDays(t, weekEnd) + 1;
      const remaining = Math.max(0, prefs.sessions_per_week - countIn(weekStart, weekEnd));
      const count = Math.min(remaining, Math.max(1, Math.round((prefs.sessions_per_week * daysLeft) / 7)));
      planWeek(u, t, weekEnd, count, daysLeft >= 4);
      u.plan.planned_through = weekEnd;
    }
    if (weekdayIndex(t) === 6) {
      const nextMonday = addDays(t, 1);
      const nextSunday = addDays(t, 7);
      if (u.plan.planned_through < nextSunday) {
        const from = u.plan.planned_through >= nextMonday ? addDays(u.plan.planned_through, 1) : nextMonday;
        const count = Math.max(0, prefs.sessions_per_week - countIn(nextMonday, nextSunday));
        planWeek(u, from, nextSunday, count, true);
        u.plan.planned_through = nextSunday;
      }
    }
  }

  /** Settle a finished build and keep the weeks planned. Runs before every plan read. */
  function tick(u: UserData) {
    if (u.plan.status === 'building' && u.plan.build && wallMs() >= u.plan.build.ready_at_ms) finishBuild(u);
    ensureWeeks(u);
  }

  /** "Monday and Wednesday were done in this version." */
  function keptNote(u: UserData, version: number): string | null {
    const all = u.sessions.filter((s) => s.plan_version === version && !s.optional);
    const done = sortSessions(all.filter((s) => s.status === 'completed'));
    if (!done.length) return null;
    if (done.length === all.length && done.length > 2) {
      return `All ${numberWord(done.length)} were done in this version.`;
    }
    const days = [...new Set(done.map((s) => formatDayLong(sessionLocalDate(s))))];
    return `${joinAnd(days)} ${days.length === 1 ? 'was' : 'were'} done in this version.`;
  }

  /** Re-plan the upcoming sessions after saved answers; done ones stay. */
  function replanFromAnswers(u: UserData) {
    const prefs = u.preferences;
    if (u.plan.status !== 'ready' || !prefs || !u.plan.planned_through) return;
    const t = today();
    const until = u.plan.planned_through;
    const upcoming = u.sessions.filter((s) => s.status === 'planned' && sessionLocalDate(s) >= t);
    u.sessions = u.sessions.filter((s) => !upcoming.includes(s));
    const version = maxVersion(u) + 1;
    const added: PlannedSession[] = [];
    for (let weekStart = startOfWeek(t); weekStart <= until; weekStart = addDays(weekStart, 7)) {
      const from = weekStart < t ? t : weekStart;
      const to = addDays(weekStart, 6) < until ? addDays(weekStart, 6) : until;
      const done = u.sessions.filter(
        (s) => !s.optional && s.status === 'completed' && inRange(sessionLocalDate(s), weekStart, addDays(weekStart, 6)),
      ).length;
      const count = Math.max(0, prefs.sessions_per_week - done);
      const sessions = generatePlanWeek(
        prefs,
        catalog,
        { from, to, version, count, newIdea: weekStart > startOfWeek(t), notBefore: now(), newId: newId('s') },
        null,
        [...u.sessions, ...added],
      );
      added.push(...sessions.map((s) => ({ ...s, changed_in_version: version })));
    }
    u.sessions.push(...added);
    addVersion(u, 'answers', `Planned again from your answers: ${answersSentence(prefs, catalog)}.`, added, null, version);
  }

  /* ------------------------------------------------------------- Chat */

  /** Only the newest card keeps Undo. */
  function retireUndo(u: UserData) {
    u.chat = u.chat.map((m) => {
      if (m.kind === 'change' && m.change.can_undo) return { ...m, change: { ...m.change, can_undo: false } };
      if (m.kind === 'workout_logged' && m.can_undo) return { ...m, can_undo: false };
      return m;
    });
  }

  /** A change card loses Undo once a session it changed has been done. */
  function lockChangesFor(u: UserData, sessionId: string) {
    const ids = new Set(u.changes.filter((c) => c.before.some((b) => b.id === sessionId) || c.added_ids.includes(sessionId)).map((c) => c.message_id));
    u.chat = u.chat.map((m) => (m.kind === 'change' && ids.has(m.id) ? { ...m, change: { ...m.change, can_undo: false } } : m));
  }

  function applyChange(u: UserData, result: CoachChange, messageId: string): ChatMessage {
    const fromVersion = u.plan.active_version ?? 0;
    const version = maxVersion(u) + 1;
    const before = result.updated.map((s) => u.sessions.find((x) => x.id === s.id)).filter((s): s is PlannedSession => !!s);
    const stamp = (s: PlannedSession): PlannedSession => ({ ...s, plan_version: version, changed_in_version: version });
    u.sessions = u.sessions.map((s) => {
      const next = result.updated.find((x) => x.id === s.id);
      return next ? stamp(next) : s;
    });
    u.sessions.push(...result.added.map(stamp));
    u.changes.push({ message_id: messageId, before, added_ids: result.added.map((s) => s.id) });
    addVersion(u, 'chat', result.summary, [...result.updated, ...result.added].map(stamp), messageId, version);
    retireUndo(u);
    const created_at = nowIso();
    u.plan.recent_change = { summary: result.summary, chat_message_id: messageId, created_at };
    return {
      id: messageId,
      created_at,
      role: 'coach',
      kind: 'change',
      change: {
        from_version: fromVersion,
        to_version: version,
        summary: result.summary,
        sport_switch: result.sport_switch,
        rows: result.rows,
        not_changed: result.not_changed,
        kept: result.kept,
        can_undo: true,
        undone: false,
      },
    };
  }

  function logFromChat(u: UserData, result: CoachLog, messageId: string): ChatMessage {
    const sport = catalog.find((s) => s.id === result.sport_id);
    const n = now();
    let start: Date;
    if (result.date === toLocalDate(n)) {
      const back = new Date(n.getTime() - result.minutes * 60_000);
      start = new Date(Math.floor(back.getTime() / 300_000) * 300_000);
      if (toLocalDate(start) !== result.date) start = atLocalTime(result.date, 7);
    } else {
      start = atLocalTime(result.date, result.evening ? 19 : 18, result.evening ? 30 : 0);
    }
    const metrics: ActivityLog['metrics'] = {};
    const metricList = sport && sport.is_gym === 0 ? sport.metrics : [];
    const durationKey = metricList.find((m) => m.represents_session_duration)?.key;
    if (durationKey) metrics[durationKey] = result.minutes * 60;
    if (result.distance !== null && metricList.some((m) => m.key === 'distance')) metrics.distance = result.distance;
    const log: ActivityLog = {
      id: nextId(db(), 'log'),
      session_id: null,
      sport_id: result.sport_id,
      title: result.title,
      started_at: toIsoWithOffset(start),
      duration_seconds: result.minutes * 60,
      source: 'chat',
      file_name: null,
      metrics,
      sets: [],
      ended_early: false,
      extra: true,
      feedback: null,
      created_at: nowIso(),
    };
    u.logs.push(log);
    retireUndo(u);
    return { id: messageId, created_at: nowIso(), role: 'coach', kind: 'workout_logged', log, can_undo: true, undone: false };
  }

  function findLog(u: UserData, id: string): ActivityLog {
    const log = u.logs.find((l) => l.id === id);
    if (!log) throw new ApiError('not_found', 'That workout is no longer saved.');
    return log;
  }

  function feedbackOverview(u: UserData): FeedbackOverview {
    return {
      opinions: [...u.opinions].sort((a, b) => b.last_date.localeCompare(a.last_date)),
      excluded_sport_ids: [...(u.preferences?.excluded_activity_types ?? [])],
    };
  }

  /* -------------------------------------------------------------- API */

  return {
    auth: {
      getSession(): AuthSession | null {
        const d = db();
        const acc = d.accounts.find((a) => a.user.id === d.session_user_id);
        return acc ? sessionFor(acc.user) : null;
      },
      lookupEmail(email: string): EmailLookup {
        const e = validateEmail(email);
        return { email: e, exists: db().accounts.some((a) => a.user.email === e) };
      },
      signInWithEmail(email: string, password: string): AuthSession {
        const e = validateEmail(email);
        const acc = db().accounts.find((a) => a.user.email === e && a.user.provider === 'email');
        if (!acc || password === WRONG_PASSWORD || password.length < 8) {
          throw new ApiError('invalid_credentials', "That password doesn't match this account.");
        }
        db().session_user_id = acc.user.id;
        return sessionFor(acc.user);
      },
      signUpWithEmail(email: string, password: string): AuthSession {
        const e = validateEmail(email);
        if (db().accounts.some((a) => a.user.email === e)) {
          throw new ApiError('email_taken', 'An account already uses this email. Sign in instead.');
        }
        if (password.length < 8) throw new ApiError('weak_password', 'Use at least 8 characters.');
        const acc = createAccount(e, password, null, 'email');
        db().session_user_id = acc.user.id;
        return sessionFor(acc.user);
      },
      signInWithGoogle(): AuthSession {
        const acc =
          db().accounts.find((a) => a.user.email === GOOGLE_EMAIL) ?? createAccount(GOOGLE_EMAIL, null, 'Sam', 'google');
        db().session_user_id = acc.user.id;
        return sessionFor(acc.user);
      },
      sendPasswordReset(email: string): void {
        validateEmail(email);
      },
      updatePassword(password: string): void {
        if (password.length < 8) throw new ApiError('weak_password', 'Use at least 8 characters.');
        const d = db();
        const acc = d.accounts.find((a) => a.user.id === d.session_user_id);
        if (!acc) throw new ApiError('unauthorized', 'Open the link from the email again.');
        acc.password = password;
      },
      getProviders(): AuthProviders {
        return { google: true };
      },
      signOut(): void {
        db().session_user_id = null;
      },
    },

    catalog: {
      listSports(): SportDefinition[] {
        return catalog;
      },
    },

    preferences: {
      get(): Preferences | null {
        return data().preferences;
      },
      save(prefs: Preferences): Preferences {
        const u = data();
        const valid =
          Number.isInteger(prefs.sessions_per_week) &&
          prefs.sessions_per_week >= 1 &&
          prefs.sessions_per_week <= 7 &&
          prefs.session_minutes >= 5 &&
          prefs.session_minutes <= 60 &&
          prefs.session_minutes % 5 === 0 &&
          prefs.available_locations.length > 0 &&
          (prefs.preferred_window === null ||
            (prefs.preferred_window[0] >= 7 &&
              prefs.preferred_window[1] <= 21 &&
              prefs.preferred_window[1] - prefs.preferred_window[0] >= 1));
        if (!valid) throw new ApiError('validation', 'Some answers are out of range. Check them and save again.');
        const saved: Preferences = {
          ...prefs,
          discovery_preference: prefs.activity_interests.length ? prefs.discovery_preference : 'explore',
        };
        const planning = (p: Preferences | null) =>
          p && JSON.stringify({ ...p, timezone: null, starting_obstacles: null, excluded_activity_types: null });
        const replan = planning(u.preferences) !== planning(saved);
        u.preferences = saved;
        u.summary_at = nowIso();
        if (replan) replanFromAnswers(u);
        return saved;
      },
    },

    plan: {
      getState(): PlanState {
        const u = data();
        tick(u);
        return planState(u);
      },
      /** Plans today and the next six days; free time (null: none known) shapes the times. */
      build(slots: TimeSlot[] | null = null, fail = false): PlanState {
        const u = data();
        tick(u);
        if (!u.preferences) throw new ApiError('validation', 'Save your answers before building a plan.');
        if (u.plan.status === 'none' || u.plan.status === 'failed') {
          u.plan.status = 'building';
          u.plan.failure_message = null;
          u.plan.build = { ready_at_ms: wallMs() + BUILD_MS, fail, slots };
        }
        return planState(u);
      },
      getWeek(weekStart: LocalDate): PlanWeek {
        const u = data();
        tick(u);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart) || weekdayIndex(weekStart) !== 0) {
          throw new ApiError('validation', 'Weeks start on a Monday.');
        }
        const weekEnd = addDays(weekStart, 6);
        const { first_week_start: first, planned_through: through } = u.plan;
        const planned = !!first && !!through && weekStart >= first && weekStart <= through;
        const sessions = sortSessions(u.sessions.filter((s) => inRange(sessionLocalDate(s), weekStart, weekEnd))).map(
          editable,
        );
        const past = weekEnd < today();
        return {
          week_start: weekStart,
          week_end: weekEnd,
          planned,
          sessions,
          extras: extrasIn(u, weekStart, weekEnd),
          summary: planned && !past ? summarizeWeek(sessions, weekStart === first) : null,
        };
      },
      listSessions(range: { from: LocalDate; to: LocalDate }): { sessions: PlannedSession[]; extras: ActivityLog[] } {
        const u = data();
        tick(u);
        return {
          sessions: sortSessions(u.sessions.filter((s) => inRange(sessionLocalDate(s), range.from, range.to))).map(editable),
          extras: extrasIn(u, range.from, range.to),
        };
      },
      getSession(id: string): PlannedSession {
        const u = data();
        tick(u);
        const s = u.sessions.find((x) => x.id === id);
        if (!s) throw new ApiError('not_found', 'This session is no longer in your plan.');
        return editable(s);
      },
      listVersions(): PlanVersion[] {
        const u = data();
        tick(u);
        return [...u.versions]
          .sort((a, b) => b.version - a.version)
          .map((v) => ({
            version: v.version,
            created_at: v.created_at,
            source: v.source,
            summary: v.summary,
            kept_note: keptNote(u, v.version),
            chat_message_id: v.chat_message_id,
            active: v.version === u.plan.active_version,
          }));
      },
      dismissRecentChange(): void {
        data().plan.recent_change = null;
      },
    },

    logs: {
      create(input: CreateLogInput): ActivityLog {
        const u = data();
        if (!(input.duration_seconds > 0)) throw new ApiError('validation', 'Add how long it took.');
        const session = input.session_id ? u.sessions.find((s) => s.id === input.session_id) : null;
        if (input.session_id && !session) throw new ApiError('not_found', 'This session is no longer in your plan.');
        if (session && session.status !== 'planned') throw new ApiError('conflict', 'This session is already logged.');
        const sport = catalog.find((s) => s.id === input.sport_id);
        const metrics = { ...(input.metrics ?? {}) };
        const durationKey = sport && sport.is_gym === 0 ? sport.metrics.find((m) => m.represents_session_duration)?.key : undefined;
        if (durationKey && metrics[durationKey] === undefined) metrics[durationKey] = input.duration_seconds;
        const log: ActivityLog = {
          id: nextId(db(), 'log'),
          session_id: input.session_id,
          sport_id: input.sport_id,
          title: session?.title ?? sport?.name ?? 'Workout',
          started_at: input.started_at,
          duration_seconds: input.duration_seconds,
          source: input.source,
          file_name: input.file_name ?? null,
          metrics,
          sets: input.sets ?? [],
          ended_early: input.ended_early ?? false,
          extra: input.session_id === null,
          feedback: null,
          created_at: nowIso(),
        };
        u.logs.push(log);
        if (session) {
          u.sessions = u.sessions.map((s) => (s.id === session.id ? { ...s, status: 'completed', log_id: log.id } : s));
          lockChangesFor(u, session.id);
        }
        u.summary_at = nowIso();
        return log;
      },
      get(id: string): ActivityLog {
        return findLog(data(), id);
      },
      update(id: string, patch: UpdateLogInput): ActivityLog {
        const u = data();
        const log = findLog(u, id);
        const next: ActivityLog = { ...log, ...patch, metrics: patch.metrics ? { ...patch.metrics } : log.metrics };
        u.logs = u.logs.map((l) => (l.id === id ? next : l));
        return next;
      },
      saveFeedback(logId: string, feedback: SaveFeedbackInput): ActivityLog {
        const u = data();
        const log = findLog(u, logId);
        const next: ActivityLog = { ...log, feedback: { ...feedback, created_at: nowIso() } };
        u.logs = u.logs.map((l) => (l.id === logId ? next : l));
        if (feedback.choose_again) {
          const key = activityKey(log.title);
          const session = u.sessions.find((s) => s.id === log.session_id);
          u.opinions = [
            ...u.opinions.filter((o) => o.activity_key !== key),
            {
              activity_key: key,
              title: log.title,
              sport_id: log.sport_id,
              opinion: feedback.choose_again,
              last_date: toLocalDate(log.started_at),
              new_idea: session?.optional ?? false,
            },
          ];
        }
        u.summary_at = nowIso();
        return next;
      },
      /** Mock logs are saved on create, so there is nothing left to save. */
      commit(id: string): ActivityLog {
        return findLog(data(), id);
      },
      lastForExercise(exercise: { exercise_id?: string; name: string }): LastExerciseResult | null {
        const u = data();
        const matches = (set: ActivityLog['sets'][number]) =>
          exercise.exercise_id
            ? set.exercise_id === exercise.exercise_id
            : set.exercise_name.toLowerCase() === exercise.name.toLowerCase();
        const log = [...u.logs]
          .sort((a, b) => b.started_at.localeCompare(a.started_at))
          .find((l) => l.sets.some(matches));
        if (!log) return null;
        const sets = log.sets.filter(matches);
        const weights = sets.map((s) => s.weight_kg).filter((w): w is number => w !== null);
        return {
          exercise_name: sets[0].exercise_name,
          date: toLocalDate(log.started_at),
          sets: sets.length,
          reps: sets[0].reps,
          weight_kg: weights.length ? Math.max(...weights) : null,
        };
      },
    },

    chat: {
      listMessages(): ChatMessage[] {
        return data().chat;
      },
      send(input: SendChatInput): ChatTurn {
        const u = data();
        tick(u);
        const text = input.text.trim();
        if (!text) throw new ApiError('validation', 'Write a message first.');
        if (!u.preferences || u.plan.status !== 'ready') {
          throw new ApiError('conflict', 'Your plan is still being built. Try again in a moment.');
        }
        if (input.base_version !== null && u.plan.active_version !== null && input.base_version !== u.plan.active_version) {
          throw new ApiError('stale_version', 'Your plan changed meanwhile, so nothing was overwritten.');
        }
        const about = input.about_session_id ? u.sessions.find((s) => s.id === input.about_session_id) : null;
        if (input.about_session_id && !about) throw new ApiError('not_found', 'This session is no longer in your plan.');
        const result = coach({
          text,
          now: now(),
          prefs: u.preferences,
          catalog,
          sessions: u.sessions,
          planned_through: u.plan.planned_through,
          about: about ?? null,
          pending: u.pending,
          retry: u.failed_texts.includes(text),
          newId: newId('s'),
        });
        if (result.kind === 'fail') {
          u.failed_texts.push(text);
          throw new ApiError('generation_failed', "Something went wrong on our side. Your plan hasn't changed.");
        }
        u.failed_texts = u.failed_texts.filter((t) => t !== text);
        const userMessage: ChatMessage = {
          id: nextId(db(), 'msg'),
          created_at: nowIso(),
          role: 'user',
          kind: 'text',
          text,
          about: about
            ? { session_id: about.id, date: sessionLocalDate(about), title: about.title, sport_id: about.sport_id }
            : null,
        };
        u.chat.push(userMessage);
        const replyId = nextId(db(), 'msg');
        let message: ChatMessage;
        if (result.kind === 'reply') {
          message = {
            id: replyId,
            created_at: nowIso(),
            role: 'coach',
            kind: 'reply',
            text: result.text,
            quick_replies: result.quick_replies,
            quiet_option: result.quiet_option,
            foot: result.foot,
          };
          u.pending = result.pending;
        } else if (result.kind === 'log') {
          message = logFromChat(u, result, replyId);
          u.pending = null;
        } else {
          message = applyChange(u, result, replyId);
          u.pending = null;
        }
        u.chat.push(message);
        return {
          messages: [userMessage, message],
          plan_changed: message.kind === 'change',
          active_version: u.plan.active_version,
        };
      },
      undo(messageId: string): ChatTurn {
        const u = data();
        const message = u.chat.find((m) => m.id === messageId);
        if (!message) throw new ApiError('not_found', 'That message is no longer in the chat.');
        if (message.kind === 'workout_logged') {
          if (!message.can_undo || message.undone) throw new ApiError('conflict', 'This workout can no longer be undone.');
          u.logs = u.logs.filter((l) => l.id !== message.log.id);
          const next: ChatMessage = { ...message, can_undo: false, undone: true };
          u.chat = u.chat.map((m) => (m.id === messageId ? next : m));
          return { messages: [next], plan_changed: false, active_version: u.plan.active_version };
        }
        if (message.kind !== 'change') throw new ApiError('validation', 'Only changes and added workouts can be undone.');
        const record = u.changes.find((c) => c.message_id === messageId);
        const touched = record
          ? u.sessions.filter((s) => record.before.some((b) => b.id === s.id) || record.added_ids.includes(s.id))
          : [];
        if (!record || !message.change.can_undo || message.change.undone || touched.some((s) => s.status === 'completed')) {
          throw new ApiError('conflict', 'This change can no longer be undone.');
        }
        const version = maxVersion(u) + 1;
        const restored = record.before.map((b) => ({ ...b, plan_version: version }));
        u.sessions = u.sessions
          .filter((s) => !record.added_ids.includes(s.id))
          .map((s) => restored.find((r) => r.id === s.id) ?? s);
        const only = restored.length === 1 && !record.added_ids.length ? restored[0] : null;
        const summary =
          only && only.status === 'planned'
            ? `Back to how it was: ${formatDayLong(sessionLocalDate(only))} at ${formatTime(sessionStart(only))}, for ${sessionMinutes(only)} minutes.`
            : 'Your plan is back to how it was before this change.';
        addVersion(u, 'undo', summary, restored, messageId, version);
        const next: ChatMessage = { ...message, change: { ...message.change, can_undo: false, undone: true, summary } };
        u.chat = u.chat.map((m) => (m.id === messageId ? next : m));
        if (u.plan.recent_change?.chat_message_id === messageId) u.plan.recent_change = null;
        return { messages: [next], plan_changed: true, active_version: u.plan.active_version };
      },
    },

    profile: {
      getSummary(): AssistantSummary {
        const u = data();
        if (!u.preferences) {
          return { status: 'unavailable', generated_at: null, little_data: true, title: '', headline: '', statements: [] };
        }
        return buildSummary({
          prefs: u.preferences,
          logs: u.logs,
          opinions: u.opinions,
          catalog,
          generated_at: u.summary_at ?? nowIso(),
        });
      },
      getFeedback(): FeedbackOverview {
        return feedbackOverview(data());
      },
      setOpinion(activityKeyValue: string, opinion: ChooseAgain | null): FeedbackOverview {
        const u = data();
        const found = u.opinions.find((o) => o.activity_key === activityKeyValue);
        if (!found) throw new ApiError('not_found', 'There is no feedback for this activity.');
        u.opinions = opinion
          ? u.opinions.map((o) => (o.activity_key === activityKeyValue ? { ...o, opinion } : o))
          : u.opinions.filter((o) => o.activity_key !== activityKeyValue);
        u.summary_at = nowIso();
        return feedbackOverview(u);
      },
      resetFeedback(): FeedbackOverview {
        const u = data();
        u.opinions = [];
        u.summary_at = nowIso();
        return feedbackOverview(u);
      },
      setSportExcluded(sportId: string, excluded: boolean): FeedbackOverview {
        const u = data();
        if (!u.preferences) throw new ApiError('validation', 'Save your answers first.');
        const list = u.preferences.excluded_activity_types.filter((id) => id !== sportId);
        u.preferences = { ...u.preferences, excluded_activity_types: excluded ? [...list, sportId] : list };
        u.summary_at = nowIso();
        return feedbackOverview(u);
      },
    },

    account: {
      get(): Account {
        const u = data();
        return { user: account().user, timezone: u.preferences?.timezone ?? 'Europe/Warsaw' };
      },
    },
  };
}

export type Backend = ReturnType<typeof createBackend>;

/** Free slots helper for tests: one free block per day between two hours. */
export function dailyFreeSlots(from: LocalDate, days: number, startHour: number, endHour: number): TimeSlot[] {
  return Array.from({ length: days }, (_, i) => ({
    start: toIsoWithOffset(atLocalTime(addDays(from, i), startHour)),
    duration: (endHour - startHour) * 3600,
  }));
}
