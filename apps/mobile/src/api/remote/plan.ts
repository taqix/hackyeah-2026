import { addDays, startOfWeek, toIsoWithOffset, toLocalDate } from '../../lib/dates';
import { debugLog } from '../../lib/debug-log';
import type { ApiClient } from '../client';
import { ApiError, type LocalDate, type PlanState, type PlannedSession } from '../types';
import type { RemoteContext } from './context';
import { isMonday, planRunner } from './plan/runner';
import { latestPlanChange, recentChange, versionsFromWire } from './plan/versions';
import { planBounds, projectSessions, sessionsBetween, snapshotsByWeek } from './plan/weeks';
import type { ActivePlanDto, ChatMessageEntity, PlanVersionEntity } from './wire';

/** When the person last dismissed Home's Plan updated note, per user (ISO instant). */
export const changeSeenKey = (userId: string) => `movo.remote.plan-change-seen.v1.${userId}`;

/** Every version: the history plus the active one (it may be newer than a cached history). */
async function allVersions(ctx: RemoteContext): Promise<{ current: ActivePlanDto | null; versions: PlanVersionEntity[] }> {
  const [history, current] = await Promise.all([ctx.data.history(), ctx.data.currentPlan()]);
  const versions = !current || history.some((v) => v.id === current.version.id) ? history : [current.version, ...history];
  return { current, versions };
}

/** The plan's chat, or [] when it cannot be read: the views that use it still work without it. */
async function chatOf(ctx: RemoteContext, current: ActivePlanDto | null): Promise<ChatMessageEntity[]> {
  if (!current) return [];
  try {
    return await ctx.data.chat(current.plan.id);
  } catch {
    return [];
  }
}

/** Every session of every week, done ones joined from completions and drafts. */
async function allSessions(ctx: RemoteContext): Promise<{ sessions: PlannedSession[]; versions: PlanVersionEntity[] }> {
  const [{ versions }, completions, drafts, ids] = await Promise.all([
    allVersions(ctx),
    ctx.data.completions(),
    ctx.drafts.list(),
    ctx.data.sportIds(),
  ]);
  const sessions = projectSessions({ versions, completions, drafts, now: ctx.deps.now(), toAppSportId: ids.toApp });
  return { sessions, versions };
}

function checkMonday(weekStart: LocalDate) {
  if (!isMonday(weekStart)) throw new ApiError('validation', 'Weeks start on a Monday.');
}

/**
 * Re-plans the active week after saved answers changed what the plan is built
 * from: same week, expected_version the active one, a new request_id, free
 * time from now. Runs in the background and never rejects; a failure shows
 * as a note in the plan state, and the week stays as it was. A week that is
 * already over is left alone.
 */
export async function replanActiveWeek(ctx: RemoteContext): Promise<void> {
  try {
    const userId = await ctx.data.userId();
    const runner = planRunner(ctx);
    // Answers saved twice in a row: the second re-plan waits for the first.
    await runner.running(userId)?.done.catch(() => undefined);
    const current = await ctx.data.currentPlan();
    if (!current) return;
    const weekStart = current.version.plan.week_start;
    if (addDays(weekStart, 6) < toLocalDate(ctx.deps.now())) {
      debugLog('plan', `re-plan skipped: week ${weekStart} is over`);
      return;
    }
    const job = await runner.start({ userId, weekStart, kind: 'replan' });
    await job.done;
  } catch {
    // Kept in the runner's failure (or, before sending, nothing changed): the answers are saved either way.
  }
}

/**
 * Plan state, weeks and sessions from the plan history (`ctx.data`), joined
 * with completions and drafts; build calls POST /plans/generate in the
 * background (see plan/runner).
 */
export function createRemotePlan(ctx: RemoteContext): ApiClient['plan'] {
  const runner = planRunner(ctx);

  async function readSeen(userId: string): Promise<string | null> {
    try {
      return await ctx.deps.storage.getItem(changeSeenKey(userId));
    } catch {
      return null;
    }
  }

  async function getState(): Promise<PlanState> {
    const userId = await ctx.data.userId();
    const current = await ctx.data.currentPlan();
    const failure = runner.failure(userId);
    if (!current) {
      const building = runner.running(userId) !== null;
      const failed = !building && failure !== null;
      return {
        status: building ? 'building' : failed ? 'failed' : 'none',
        active_version: null,
        first_week_start: null,
        planned_through: null,
        failure_message: failed ? failure.message : null,
        failure_code: failed ? failure.code : null,
        recent_change: null,
      };
    }
    const [{ versions }, messages, seen] = await Promise.all([allVersions(ctx), chatOf(ctx, current), readSeen(userId)]);
    return {
      status: 'ready',
      active_version: current.version.version,
      ...planBounds(snapshotsByWeek(versions)),
      // With a plan, a failed weekly plan or re-plan is a note above the week that stayed (Home).
      failure_message: failure && failure.kind !== 'first' ? failure.message : null,
      failure_code: null,
      recent_change: recentChange(messages, seen, current.version.id),
    };
  }

  return {
    getState,

    async build(input) {
      const weekStart = input.week_start ?? startOfWeek(ctx.deps.now());
      checkMonday(weekStart);
      const userId = await ctx.data.userId();
      const current = await ctx.data.currentPlan();
      const kind = !current ? 'first' : (await ctx.data.weekSnapshots()).has(weekStart) ? 'replan' : 'week';
      const job =
        runner.running(userId, weekStart) ?? (await runner.start({ userId, weekStart, kind, requestId: input.request_id }));
      // The first plan builds while Home polls; with a plan the caller waits, and the plan stays on failure.
      if (current) await job.done;
      return getState();
    },

    async getWeek(weekStart) {
      checkMonday(weekStart);
      const weekEnd = addDays(weekStart, 6);
      const { sessions, versions } = await allSessions(ctx);
      const snapshots = snapshotsByWeek(versions);
      const { first_week_start: first, planned_through: through } = planBounds(snapshots);
      const planned = !!first && !!through && weekStart >= first && weekStart <= through;
      const past = weekEnd < toLocalDate(ctx.deps.now());
      return {
        week_start: weekStart,
        week_end: weekEnd,
        planned,
        sessions: sessionsBetween(sessions, weekStart, weekEnd),
        extras: [],
        summary: planned && !past ? (snapshots.get(weekStart)?.summary ?? null) : null,
      };
    },

    async listSessions(range) {
      const { sessions } = await allSessions(ctx);
      return { sessions: sessionsBetween(sessions, range.from, range.to), extras: [] };
    },

    async getSession(id) {
      const { sessions } = await allSessions(ctx);
      const session = sessions.find((s) => s.id === id);
      if (!session) throw new ApiError('not_found', 'This session is no longer in your plan.');
      return session;
    },

    async listVersions() {
      const [{ current, versions }, completions] = await Promise.all([allVersions(ctx), ctx.data.completions()]);
      return versionsFromWire({
        versions,
        activeVersionId: current?.plan.active_version_id ?? current?.version.id ?? null,
        completions,
        messages: await chatOf(ctx, current),
      });
    },

    async dismissRecentChange() {
      const userId = await ctx.data.userId();
      const current = await ctx.data.currentPlan();
      // The change's own server time, so a device clock behind the server cannot bring the note back.
      const latest = latestPlanChange(await chatOf(ctx, current));
      const seen = await readSeen(userId);
      const at = latest?.created_at ?? toIsoWithOffset(ctx.deps.now());
      if (seen && Date.parse(seen) >= Date.parse(at)) return;
      await ctx.deps.storage.setItem(changeSeenKey(userId), at);
    },
  };
}
