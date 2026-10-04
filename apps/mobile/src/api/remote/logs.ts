import { toIsoWithOffset, toLocalDate } from '../../lib/dates';
import { debugLog, debugWarn, describeError, errorLabel, shortId } from '../../lib/debug-log';
import type { ApiClient } from '../client';
import { ApiError, type ActivityLog, type LoggedSet, type SaveFeedbackInput, type UpdateLogInput } from '../types';
import type { RemoteContext } from './context';
import type { FoundActivity } from './data';
import { DRAFT_PREFIX, isDraftId, type Draft } from './drafts';
import { serverErrorCode } from './http';
import {
  activityKey,
  DURATION_METRIC_KEY,
  feedbackToWire,
  gymLogToWire,
  logFromCompletion,
  logFromDraft,
  metricsToWire,
} from './mappers';
import { isMissingRoute, missingRouteError, putOpinion } from './profile';
import type { ActivityCompletionEntity, CompleteActivityDto, FeedbackDto, UpdateFeedbackDto } from './wire';

/**
 * Logs are local drafts (`ctx.drafts`) until feedback is saved or the
 * feedback screen closes; then POST /completions. Saved completions read from
 * `ctx.data.completions()`.
 *
 * A draft's ID is `draft:<request_id>` (the request_id it was made with), so
 * a draft that was saved can still be found by its old ID, also after a
 * restart. Once saved, its actuals are read-only; only feedback can change.
 */

/** Drafts left this long without feedback are saved without it at the next start. */
export const DRAFT_FLUSH_AFTER_MS = 24 * 60 * 60 * 1000;

const NOT_IN_PLAN = 'This session is no longer in your plan.';
const SAVED_ELSEWHERE = 'This workout is no longer here.';

/** Per-runtime state shared by the logs section and flushDrafts. */
interface LogsState {
  /** Saved drafts: draft ID → completion ID (also found later through the request_id). */
  aliases: Map<string, string>;
  /** One save at a time per draft (feedback Save, close and the start-up flush can overlap). */
  locks: Map<string, Promise<unknown>>;
  flushing: Promise<void> | null;
}

const states = new WeakMap<RemoteContext, LogsState>();

function stateFor(ctx: RemoteContext): LogsState {
  let state = states.get(ctx);
  if (!state) {
    state = { aliases: new Map(), locks: new Map(), flushing: null };
    states.set(ctx, state);
  }
  return state;
}

function locked<T>(state: LogsState, id: string, task: () => Promise<T>): Promise<T> {
  const run = (state.locks.get(id) ?? Promise.resolve()).then(task, task);
  const tail = run.catch(() => undefined);
  state.locks.set(id, tail);
  void tail.then(() => {
    if (state.locks.get(id) === tail) state.locks.delete(id);
  });
  return run;
}

/** Offline, a timeout or a server failure: the body may have been saved, so a retry must resend it unchanged. */
const outcomeUnknown = (error: unknown) =>
  error instanceof ApiError && (error.code === 'offline' || error.code === 'timeout' || error.code === 'unknown');

const sameFeedback = (a: FeedbackDto | null, b: FeedbackDto) =>
  !!a && a.effort === b.effort && a.enjoyment === b.enjoyment && a.notes === b.notes;

/** The activity a draft completes: in the draft's version, else wherever it lives now. */
async function activityForDraft(ctx: RemoteContext, draft: Draft): Promise<FoundActivity> {
  const version = await ctx.data.versionById(draft.plan_version_id);
  const activity = version?.plan.activities.find((item) => item.id === draft.activity_id);
  if (version && activity) return { activity, version };
  const found = await ctx.data.findActivity(draft.activity_id);
  if (!found) throw new ApiError('not_found', NOT_IN_PLAN);
  return found;
}

/**
 * The POST /completions body for a draft. The duration metric comes from the
 * draft's length when the form had none (a gym session); completed_at is the
 * start plus the length, never later than now (the server rejects the future).
 */
async function completionBody(
  ctx: RemoteContext,
  draft: Draft,
  found: FoundActivity,
  feedback: SaveFeedbackInput | null,
): Promise<CompleteActivityDto> {
  const sport = (await ctx.data.sports()).find((item) => item.id === found.activity.sport_id);
  const gym = sport ? sport.is_gym : found.activity.gym_exercises.length > 0;
  const end = Math.min(Date.parse(draft.started_at) + draft.duration_seconds * 1000, ctx.deps.now().getTime());
  return {
    plan_version_id: found.version.id,
    activity_id: draft.activity_id,
    request_id: draft.request_id,
    metrics: sport ? metricsToWire(draft.metrics, sport, draft.duration_seconds) : {},
    gym_log: gym ? gymLogToWire(draft.sets, found.activity) : [],
    feedback: feedback ? feedbackToWire(feedback) : null,
    completed_at: toIsoWithOffset(new Date(Number.isFinite(end) ? end : ctx.deps.now().getTime())),
  };
}

/** The completion a saved draft became: through the alias, else by the request_id in its ID. */
async function completionForDraftId(
  ctx: RemoteContext,
  state: LogsState,
  draftId: string,
): Promise<ActivityCompletionEntity | null> {
  const alias = state.aliases.get(draftId);
  const requestId = draftId.slice(DRAFT_PREFIX.length);
  const completions = await ctx.data.completions();
  return completions.find((item) => (alias ? item.id === alias : item.request_id === requestId)) ?? null;
}

async function logForCompletion(ctx: RemoteContext, completion: ActivityCompletionEntity): Promise<ActivityLog> {
  const [found, ids] = await Promise.all([ctx.data.findActivity(completion.activity_id), ctx.data.sportIds()]);
  if (!found) throw new ApiError('not_found', SAVED_ELSEWHERE);
  return logFromCompletion(completion, found.activity, ids.toApp);
}

/** PUT /completions/feedback: feedback given or changed after the session was saved. */
async function putFeedback(
  ctx: RemoteContext,
  completionId: string,
  feedback: SaveFeedbackInput,
): Promise<ActivityCompletionEntity> {
  const body: UpdateFeedbackDto = { completion_id: completionId, feedback: feedbackToWire(feedback) };
  try {
    const saved = await ctx.http.put<ActivityCompletionEntity>('/completions/feedback', body);
    debugLog('logs', `✓ feedback saved on completion=${shortId(completionId)}`);
    return saved;
  } catch (error) {
    debugWarn('logs', `✕ feedback on completion=${shortId(completionId)} ${errorLabel(error)}`, () =>
      describeError(error),
    );
    if (isMissingRoute(error)) {
      throw missingRouteError("We can't add feedback to a saved session yet. The session itself is saved.", error);
    }
    throw error;
  } finally {
    ctx.data.invalidate('completions');
  }
}

/**
 * Saves a draft as a completion. The body is stored on the draft before it
 * is sent, so a retry (now or at the next start) resends the same bytes under
 * the same request_id. ALREADY_COMPLETED (or the request_id already used)
 * means the session is saved: the existing completion is taken. Feedback that
 * the saved body does not carry (an earlier attempt without it) follows with
 * PUT /completions/feedback.
 */
function saveDraft(
  ctx: RemoteContext,
  draftId: string,
  feedback: SaveFeedbackInput | null,
): Promise<ActivityCompletionEntity> {
  const state = stateFor(ctx);
  return locked(state, draftId, async () => {
    debugLog('logs', `→ save ${shortId(draftId)} feedback=${feedback ? 'given' : 'none'}`);
    const draft = await ctx.drafts.get(draftId);
    if (!draft) {
      // Saved meanwhile: another tap, or the start-up flush.
      debugLog('logs', `${shortId(draftId)} was saved meanwhile: using its completion`);
      const saved = await completionForDraftId(ctx, state, draftId);
      if (!saved) throw new ApiError('not_found', SAVED_ELSEWHERE);
      return feedback && !sameFeedback(saved.feedback, feedbackToWire(feedback))
        ? putFeedback(ctx, saved.id, feedback)
        : saved;
    }

    let body = draft.submission;
    if (!body) {
      body = await completionBody(ctx, draft, await activityForDraft(ctx, draft), feedback);
      await ctx.drafts.put({ ...draft, submission: body });
    }

    let completion: ActivityCompletionEntity;
    try {
      completion = await ctx.http.post<ActivityCompletionEntity>('/completions', body, { retryTransport: true });
    } catch (error) {
      const code = serverErrorCode(error);
      if (code === 'ALREADY_COMPLETED' || code === 'REQUEST_CONFLICT') {
        ctx.data.invalidate('completions');
        const existing = (await ctx.data.completionByActivityId()).get(draft.activity_id);
        if (!existing) {
          debugWarn('logs', `✕ save ${shortId(draftId)} ${code}: no saved completion, a new request_id next time`);
          await ctx.drafts.put({ ...draft, request_id: ctx.deps.newId(), submission: null });
          throw error;
        }
        debugLog('logs', `${shortId(draftId)} already saved (${code}): using completion=${shortId(existing.id)}`);
        completion = existing;
      } else {
        // A definite answer (validation, not found) saved nothing: rebuild the body next time.
        const next = outcomeUnknown(error) ? 'same body resent next time' : 'body rebuilt next time';
        debugWarn('logs', `✕ save ${shortId(draftId)} ${errorLabel(error)}: ${next}`, () => describeError(error));
        if (!outcomeUnknown(error)) await ctx.drafts.put({ ...draft, submission: null });
        throw error;
      }
    }

    state.aliases.set(draft.id, completion.id);
    await ctx.drafts.remove(draft.id);
    debugLog('logs', `✓ saved ${shortId(draft.id)} as completion=${shortId(completion.id)}`);
    ctx.data.invalidate('completions');
    if (feedback && !sameFeedback(completion.feedback, feedbackToWire(feedback))) {
      completion = await putFeedback(ctx, completion.id, feedback);
    }
    return completion;
  });
}

/** "Would you choose this again?" kept per activity title. A server without opinions still has it in the feedback. */
async function saveOpinion(ctx: RemoteContext, completion: ActivityCompletionEntity, feedback: SaveFeedbackInput) {
  if (feedback.choose_again === null) return;
  const found = await ctx.data.findActivity(completion.activity_id);
  if (!found) return;
  try {
    await putOpinion(ctx, {
      activity_key: activityKey(found.activity.title),
      title: found.activity.title,
      sport_id: found.activity.sport_id,
      opinion: feedback.choose_again,
      last_date: toLocalDate(found.activity.start_at),
    });
    debugLog('profile', `✓ opinion ${feedback.choose_again} saved for activity=${shortId(completion.activity_id)}`);
  } catch (error) {
    // The answer is saved with the completion's feedback; only the overview list waits for the route.
    if (isMissingRoute(error)) {
      debugLog('profile', 'opinion skipped: the server has no opinions route yet (kept in the feedback)');
      return;
    }
    throw error;
  }
}

/**
 * Saves every pending draft as a completion (without feedback, or with the
 * body already sent). Called by AuthSessionSync at a signed-in start; must not
 * reject: a draft that still fails stays for the next start.
 *
 * Saved: drafts with a body sent before (the feedback screen closed while
 * offline) and drafts older than a day. Newer drafts wait, so "Say how it
 * felt" still saves feedback in the same request. Dropped: drafts whose
 * session is saved already or no longer in any plan version.
 */
export function flushDrafts(ctx: RemoteContext): Promise<void> {
  const state = stateFor(ctx);
  state.flushing ??= (async () => {
    try {
      const drafts = await ctx.drafts.list();
      if (!drafts.length) return;
      debugLog('logs', `flush: ${drafts.length} pending draft(s)`);
      const done = await ctx.data.completionByActivityId();
      const now = ctx.deps.now().getTime();
      for (const draft of drafts) {
        try {
          const saved = done.get(draft.activity_id);
          if (saved || !(await ctx.data.findActivity(draft.activity_id))) {
            if (saved) state.aliases.set(draft.id, saved.id);
            const why = saved ? 'already saved' : 'no longer in any plan version';
            debugLog('logs', `flush: dropped ${shortId(draft.id)} (${why})`);
            await ctx.drafts.remove(draft.id);
            continue;
          }
          const age = now - Date.parse(draft.created_at);
          if (draft.submission || !(age < DRAFT_FLUSH_AFTER_MS)) await saveDraft(ctx, draft.id, null);
          else debugLog('logs', `flush: ${shortId(draft.id)} waits for feedback (newer than a day)`);
        } catch (error) {
          // Stays for the next start.
          debugWarn('logs', `flush: ${shortId(draft.id)} kept for the next start: ${errorLabel(error)}`);
        }
      }
    } catch (error) {
      // Signed out or offline: nothing to do until the next start.
      debugWarn('logs', `flush skipped: ${errorLabel(error)}`);
    } finally {
      state.flushing = null;
    }
  })();
  return state.flushing;
}

/** The session-duration metric in seconds, filled from the length when the form had none (as the mock does). */
function withDuration(
  metrics: Draft['metrics'],
  durationSeconds: number,
  sport: { is_gym: boolean; metrics: { key: string }[] } | undefined,
): Draft['metrics'] {
  const next = { ...metrics };
  if (sport && !sport.is_gym && sport.metrics.some((m) => m.key === DURATION_METRIC_KEY)) {
    next[DURATION_METRIC_KEY] ??= durationSeconds;
  }
  return next;
}

const copySets = (sets: LoggedSet[]) => sets.map((set) => ({ ...set }));

export function createRemoteLogs(ctx: RemoteContext): ApiClient['logs'] {
  const state = stateFor(ctx);

  async function get(id: string): Promise<ActivityLog> {
    if (isDraftId(id)) {
      const draft = await ctx.drafts.get(id);
      if (draft) return logFromDraft(draft);
      const saved = await completionForDraftId(ctx, state, id);
      if (!saved) throw new ApiError('not_found', SAVED_ELSEWHERE);
      return logForCompletion(ctx, saved);
    }
    const completion = (await ctx.data.completions()).find((item) => item.id === id);
    if (!completion) throw new ApiError('not_found', SAVED_ELSEWHERE);
    return logForCompletion(ctx, completion);
  }

  async function wireSport(appId: string) {
    const [sports, ids] = await Promise.all([ctx.data.sports(), ctx.data.sportIds()]);
    const wireId = ids.toWire(appId);
    return sports.find((sport) => sport.id === wireId);
  }

  return {
    async create(input) {
      if (input.session_id === null) {
        throw new ApiError('validation', "Workouts outside the plan aren't available yet.");
      }
      if (!(input.duration_seconds > 0)) throw new ApiError('validation', 'Add how long it took.');
      const sessionId = input.session_id;
      const [found, done, drafts, sports, ids] = await Promise.all([
        ctx.data.findActivity(sessionId),
        ctx.data.completionByActivityId(),
        ctx.drafts.list(),
        ctx.data.sports(),
        ctx.data.sportIds(),
      ]);
      if (!found) throw new ApiError('not_found', NOT_IN_PLAN);
      if (done.has(sessionId) || drafts.some((draft) => draft.activity_id === sessionId)) {
        throw new ApiError('conflict', 'This session is already logged.');
      }
      const requestId = ctx.deps.newId();
      const draft: Draft = {
        id: `${DRAFT_PREFIX}${requestId}`,
        request_id: requestId,
        activity_id: sessionId,
        plan_version_id: found.version.id,
        sport_id: ids.toApp(found.activity.sport_id),
        title: found.activity.title,
        started_at: input.started_at,
        duration_seconds: input.duration_seconds,
        source: input.source,
        file_name: input.file_name ?? null,
        metrics: withDuration(
          input.metrics ?? {},
          input.duration_seconds,
          sports.find((sport) => sport.id === found.activity.sport_id),
        ),
        sets: copySets(input.sets ?? []),
        ended_early: input.ended_early ?? false,
        created_at: toIsoWithOffset(ctx.deps.now()),
        submission: null,
      };
      await ctx.drafts.put(draft);
      debugLog('logs', `draft created ${shortId(draft.id)} source=${input.source}`, () => ({
        activity_id: shortId(sessionId),
        sets: draft.sets.length,
        metrics: Object.keys(draft.metrics).join(',') || 'none',
      }));
      return logFromDraft(draft);
    },

    get,

    update(id, patch: UpdateLogInput) {
      if (!isDraftId(id)) return Promise.reject(new ApiError('conflict', "Saved sessions can't be edited."));
      return locked(state, id, async () => {
        const draft = await ctx.drafts.get(id);
        if (!draft) {
          if (await completionForDraftId(ctx, state, id)) throw new ApiError('conflict', "Saved sessions can't be edited.");
          throw new ApiError('not_found', SAVED_ELSEWHERE);
        }
        const durationSeconds = patch.duration_seconds ?? draft.duration_seconds;
        if (!(durationSeconds > 0)) throw new ApiError('validation', 'Add how long it took.');
        const sport = patch.metrics ? await wireSport(draft.sport_id) : undefined;
        const next: Draft = {
          ...draft,
          started_at: patch.started_at ?? draft.started_at,
          duration_seconds: durationSeconds,
          source: patch.source ?? draft.source,
          file_name: patch.file_name !== undefined ? patch.file_name : draft.file_name,
          metrics: patch.metrics ? withDuration(patch.metrics, durationSeconds, sport) : draft.metrics,
          sets: patch.sets ? copySets(patch.sets) : draft.sets,
          // A body sent before may be saved under its request_id; a changed body needs a new one.
          ...(draft.submission ? { request_id: ctx.deps.newId(), submission: null } : {}),
        };
        await ctx.drafts.put(next);
        const renewed = draft.submission ? ' (new request_id: the body changed after a send)' : '';
        debugLog('logs', `draft updated ${shortId(id)}${renewed}`);
        return logFromDraft(next);
      });
    },

    async saveFeedback(logId, feedback) {
      let completion: ActivityCompletionEntity;
      if (isDraftId(logId)) {
        completion = await saveDraft(ctx, logId, feedback);
      } else {
        const saved = (await ctx.data.completions()).find((item) => item.id === logId);
        if (!saved) throw new ApiError('not_found', SAVED_ELSEWHERE);
        completion = await putFeedback(ctx, saved.id, feedback);
      }
      await saveOpinion(ctx, completion, feedback);
      return logForCompletion(ctx, completion);
    },

    async commit(id) {
      if (!isDraftId(id)) return get(id);
      return logForCompletion(ctx, await saveDraft(ctx, id, null));
    },

    async lastForExercise(exercise) {
      const name = exercise.name.trim().toLowerCase();
      const matches = (set: LoggedSet) =>
        (!!exercise.exercise_id && set.exercise_id === exercise.exercise_id) ||
        set.exercise_name.trim().toLowerCase() === name;
      const [completions, ids] = await Promise.all([ctx.data.completions(), ctx.data.sportIds()]);
      // Newest completed_at first.
      for (const completion of completions) {
        if (!completion.gym_log.length) continue;
        const found = await ctx.data.findActivity(completion.activity_id);
        if (!found) continue;
        const log = logFromCompletion(completion, found.activity, ids.toApp);
        const sets = log.sets.filter(matches);
        if (!sets.length) continue;
        const weights = sets.map((set) => set.weight_kg).filter((weight): weight is number => weight !== null);
        return {
          exercise_name: sets[0].exercise_name,
          date: toLocalDate(log.started_at),
          sets: sets.length,
          reps: sets[0].reps,
          weight_kg: weights.length ? Math.max(...weights) : null,
        };
      }
      return null;
    },
  };
}
