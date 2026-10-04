/**
 * Plan generation in the background. POST /plans/generate waits for the AI
 * (up to two minutes), so the first plan is sent and left running while the
 * app shows the building state and polls getState. One runner per remote
 * context remembers what is running, the last failure (in memory only: after
 * a restart it reads as no plan, not failed) and each request's body, so
 * resending a request_id after a transport failure resends the identical
 * body, captured free time included.
 */
import { fromLocalDate, toLocalDate, weekdayIndex } from '../../../lib/dates';
import { debugLog, debugWarn, describeError, errorLabel, shortId, startTimer } from '../../../lib/debug-log';
import { ApiError, type ApiErrorCode, isApiError, type LocalDate } from '../../types';
import type { RemoteContext } from '../context';
import { AI_TIMEOUT_MS, defaultErrorMessage } from '../http';
import type { ActivePlanDto, GeneratePlanDto } from '../wire';

/** first: no plan yet; week: a week not planned before; replan: a planned week again (saved answers). */
export type PlanJobKind = 'first' | 'week' | 'replan';

export interface PlanJob {
  userId: string;
  weekStart: LocalDate;
  kind: PlanJobKind;
  /** The request_id last sent (a version conflict retries with a new one). */
  requestId: string;
  /** Resolves with the new plan; rejects with an ApiError. */
  done: Promise<ActivePlanDto>;
}

/** A job while it runs; `done` is added once it is sent. */
type RunningJob = Omit<PlanJob, 'done'>;

export interface PlanFailure {
  userId: string;
  weekStart: LocalDate;
  kind: PlanJobKind;
  requestId: string;
  code: ApiErrorCode;
  /** Home's copy: the failed state's body, or a note above a plan that stayed as it was. */
  message: string;
  /** Offline or timeout: the server may have the request, so a retry resends the same request_id. */
  transport: boolean;
}

export interface StartPlanJob {
  userId: string;
  weekStart: LocalDate;
  kind: PlanJobKind;
  requestId?: string;
}

export interface PlanRunner {
  /** The newest job running for the user (and week), or null. */
  running(userId: string, weekStart?: LocalDate): PlanJob | null;
  /** The user's last failure, until a new job starts. */
  failure(userId: string): PlanFailure | null;
  /**
   * Prepares the body (answers, free time, expected version) and sends it.
   * Rejects only when the body cannot be prepared (no answers, offline, the
   * calendar could not be read), recorded as the failure like a failed send;
   * the request's own outcome is `job.done`.
   */
  start(input: StartPlanJob): Promise<PlanJob>;
}

const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isMonday(date: string): boolean {
  return LOCAL_DATE.test(date) && weekdayIndex(date) === 0;
}

const FIRST_PLAN_MESSAGES: Partial<Record<ApiErrorCode, string>> = {
  ai_unavailable: "Plan building isn't connected yet. Your answers are saved.",
  validation: "We couldn't build a plan from these answers yet.",
  offline: "We couldn't reach the server, so your plan didn't build. Your answers are saved.",
  timeout: 'We stopped waiting for your plan. Your answers are saved, so trying again only takes a moment.',
};
const FIRST_PLAN_FALLBACK =
  'Something went wrong while building your plan. Your answers are saved, so trying again only takes a moment.';

/** Calm copy for a failed job: the first plan's failed state, or a note above the plan that stayed. */
export function planFailureMessage(kind: PlanJobKind, code: ApiErrorCode, weekStart: LocalDate, today: LocalDate): string {
  if (kind === 'first') return FIRST_PLAN_MESSAGES[code] ?? FIRST_PLAN_FALLBACK;
  const unplugged = code === 'ai_unavailable';
  if (kind === 'replan') {
    return unplugged
      ? "Your answers are saved. Plan building isn't connected yet, so your week stays as it was."
      : "Your answers are saved, but your week didn't update. It stays as it was for now.";
  }
  const which = weekStart <= today ? 'This week' : 'Next week';
  return unplugged
    ? `${which} isn't planned yet. Plan building isn't connected yet.`
    : `${which} isn't planned yet. We'll try again the next time you open the app.`;
}

const runners = new WeakMap<RemoteContext, PlanRunner>();

/** The context's runner: the plan and preferences sections share it. */
export function planRunner(ctx: RemoteContext): PlanRunner {
  let runner = runners.get(ctx);
  if (!runner) {
    runner = createPlanRunner(ctx);
    runners.set(ctx, runner);
  }
  return runner;
}

export function createPlanRunner({ http, data, deps }: RemoteContext): PlanRunner {
  const jobs: PlanJob[] = [];
  const bodies = new Map<string, GeneratePlanDto>();
  let lastFailure: PlanFailure | null = null;

  async function prepare(requestId: string, weekStart: LocalDate): Promise<GeneratePlanDto> {
    const saved = bodies.get(requestId);
    if (saved) return saved;
    const [profile, current] = await Promise.all([data.profile(), data.currentPlan()]);
    const preferences = profile?.preferences;
    if (!preferences) throw new ApiError('validation', 'Save your answers before building a plan.');
    const now = deps.now();
    const monday = fromLocalDate(weekStart);
    const window = preferences.preferred_window;
    const availability = await deps.captureAvailability({
      weekStart,
      from: now > monday ? now : monday,
      window: window ? [window.start_hour, window.end_hour] : null,
      minMinutes: 5,
      capturedAt: now,
    });
    const body: GeneratePlanDto = {
      request_id: requestId,
      expected_version: current?.version.version ?? 0,
      sport_id: null,
      week_start: weekStart,
      availability,
    };
    bodies.set(requestId, body);
    return body;
  }

  function fail(job: RunningJob, error: unknown): ApiError {
    const failure =
      error instanceof ApiError ? error : new ApiError('unknown', defaultErrorMessage('unknown'), { cause: error });
    const transport = failure.code === 'offline' || failure.code === 'timeout';
    lastFailure = {
      userId: job.userId,
      weekStart: job.weekStart,
      kind: job.kind,
      requestId: job.requestId,
      code: failure.code,
      message: planFailureMessage(job.kind, failure.code, job.weekStart, toLocalDate(deps.now())),
      transport,
    };
    return failure;
  }

  const generate = (body: GeneratePlanDto) =>
    http.post<ActivePlanDto>('/plans/generate', body, { timeoutMs: AI_TIMEOUT_MS, retryTransport: true });

  /**
   * One request; on a version conflict, the plan is read again and, unless
   * the week got planned meanwhile, sent once more with a new request_id.
   */
  async function send(job: RunningJob, body: GeneratePlanDto): Promise<ActivePlanDto> {
    try {
      return await generate(body);
    } catch (error) {
      if (!isApiError(error, 'stale_version')) throw error;
      debugLog('plan', `↻ ${job.kind} week=${job.weekStart}: version conflict, reading the plan again`);
      data.invalidate('currentPlan', 'history');
      const current = await data.currentPlan();
      if (current && job.kind !== 'replan' && (await data.weekSnapshots()).has(job.weekStart)) {
        debugLog('plan', `${job.kind} week=${job.weekStart} planned meanwhile: keeping v${current.version.version}`);
        return current;
      }
      const retry: GeneratePlanDto = {
        ...body,
        request_id: deps.newId(),
        expected_version: current?.version.version ?? 0,
      };
      bodies.set(retry.request_id, retry);
      job.requestId = retry.request_id;
      debugLog('plan', `↻ ${job.kind} week=${job.weekStart}: resending as rid=${shortId(retry.request_id)}`, {
        expected_version: retry.expected_version,
      });
      return generate(retry);
    }
  }

  async function settle(job: RunningJob, body: GeneratePlanDto): Promise<ActivePlanDto> {
    const took = startTimer();
    try {
      const result = await send(job, body);
      debugLog('plan', `✓ ${job.kind} week=${job.weekStart} ready: v${result.version.version} ${took()}`, () => ({
        activities: result.version.plan.activities.length,
      }));
      bodies.delete(body.request_id);
      bodies.delete(job.requestId);
      // A plan built for an account that has since signed out never reaches the next one's cache.
      data.setCurrentPlan(result, job.userId);
      data.invalidate('history');
      return result;
    } catch (error) {
      const failure = fail(job, error);
      debugWarn('plan', `✕ ${job.kind} week=${job.weekStart} failed ${took()} ${errorLabel(failure)}`, () =>
        describeError(failure),
      );
      if (failure.code !== 'offline' && failure.code !== 'timeout') bodies.delete(job.requestId);
      // A request that timed out may still have been saved: read the plan again.
      data.invalidate('currentPlan', 'history');
      throw failure;
    } finally {
      const index = jobs.findIndex((item) => item === job);
      if (index >= 0) jobs.splice(index, 1);
    }
  }

  return {
    running(userId, weekStart) {
      for (let i = jobs.length - 1; i >= 0; i -= 1) {
        const job = jobs[i];
        if (job.userId === userId && (weekStart === undefined || job.weekStart === weekStart)) return job;
      }
      return null;
    },
    failure: (userId) => (lastFailure?.userId === userId ? lastFailure : null),
    async start(input) {
      // Trying again after a transport failure resends the same request, so the server never plans twice.
      const resend =
        lastFailure?.transport && lastFailure.userId === input.userId && lastFailure.weekStart === input.weekStart
          ? lastFailure.requestId
          : null;
      const requestId = input.requestId ?? resend ?? deps.newId();
      const running: RunningJob = { ...input, requestId };
      const again = resend && requestId === resend ? ' (resending after a transport failure)' : '';
      debugLog('plan', `→ ${input.kind} week=${input.weekStart} rid=${shortId(requestId)}${again}`);
      let body: GeneratePlanDto;
      try {
        body = await prepare(requestId, input.weekStart);
      } catch (error) {
        // Nothing was sent; the failed state or note says so (a calendar error is never empty free time).
        debugWarn('plan', `✕ ${input.kind} week=${input.weekStart} not sent: ${errorLabel(error)}`, () =>
          describeError(error),
        );
        throw fail(running, error);
      }
      if (lastFailure?.userId === input.userId) lastFailure = null;
      const job: PlanJob = Object.assign(running, { done: settle(running, body) });
      jobs.push(job);
      // Callers that do not wait read the outcome from getState instead.
      job.done.catch(() => undefined);
      return job;
    },
  };
}
