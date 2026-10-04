import { fromLocalDate, toLocalDate } from '../../lib/dates';
import type { ApiClient } from '../client';
import { ApiError, isApiError, type ChatMessage, type SendChatInput, type SessionRef } from '../types';
import { createAboutStore } from './chat/about';
import { EMPTY_THREAD_CONTEXT, isChangeMessage, threadFromWire, type ThreadContext } from './chat/thread';
import type { RemoteContext } from './context';
import { AI_TIMEOUT_MS, serverErrorCode } from './http';
import type { ActivePlanDto, ChatMessageEntity, ChatResultDto, SendChatDto, UndoPlanDto } from './wire';

/** The contract's message limit. */
const MAX_MESSAGE_LENGTH = 2000;
/** Bodies kept for a retry after a transport failure; older ones are dropped. */
const MAX_KEPT_BODIES = 20;

const NOT_READY = "Your plan isn't ready yet. You can chat once it is.";
const CANT_UNDO = 'This change can no longer be undone.';
const NO_FREE_TIME = "Couldn't read your free time. Your plan hasn't changed.";

const isTransport = (error: unknown) => isApiError(error, 'offline') || isApiError(error, 'timeout');
const activeVersionId = (current: ActivePlanDto) => current.plan.active_version_id ?? current.version.id;

/**
 * GET /chat/messages and POST /chat (with availability), and Undo through
 * POST /plans/undo. Change cards are diffed from the plan versions on read
 * (`chat/thread.ts`). One request_id per user action: a retry after a
 * transport failure passes the same ID and resends the exact body kept here
 * (same captured availability), so the server replays instead of acting twice.
 */
export function createRemoteChat(ctx: RemoteContext): ApiClient['chat'] {
  const about = createAboutStore(ctx.deps.storage, ctx.data.userId);
  /** request_id → the body sent with it. */
  const bodies = new Map<string, SendChatDto>();
  /** Change message id → the undo body sent for it. */
  const undoBodies = new Map<string, UndoPlanDto>();

  function keep<T>(map: Map<string, T>, key: string, value: T) {
    map.delete(key);
    map.set(key, value);
    while (map.size > MAX_KEPT_BODIES) map.delete(map.keys().next().value as string);
  }

  /** What the thread needs; versions and done sessions only when it has change cards. */
  async function threadContext(messages: ChatMessageEntity[], current: ActivePlanDto): Promise<ThreadContext> {
    const aboutById = await about.read();
    const base = { ...EMPTY_THREAD_CONTEXT, about: aboutById, activeVersionId: activeVersionId(current) };
    if (!messages.some(isChangeMessage)) return base;
    const [history, completions, drafts, ids] = await Promise.all([
      ctx.data.history(),
      ctx.data.completions(),
      ctx.drafts.list().catch(() => []),
      ctx.data.sportIds(),
    ]);
    const versions = history.some((v) => v.id === current.version.id) ? history : [current.version, ...history];
    const numberOf = new Map(versions.map((v) => [v.id, v.version]));
    const done = new Map<string, number | null>();
    for (const item of [...completions, ...drafts]) {
      if (!done.has(item.activity_id)) done.set(item.activity_id, numberOf.get(item.plan_version_id) ?? null);
    }
    return { ...base, versions, done, toAppSportId: ids.toApp };
  }

  async function thread(messages: ChatMessageEntity[], current: ActivePlanDto): Promise<ChatMessage[]> {
    return threadFromWire(messages, await threadContext(messages, current));
  }

  /** The attached session as the bubble's chip; null when no version has it. */
  async function sessionRef(sessionId: string): Promise<SessionRef | null> {
    const found = await ctx.data.findActivity(sessionId);
    if (!found) return null;
    const { activity } = found;
    return {
      session_id: activity.id,
      date: toLocalDate(activity.start_at),
      title: activity.title,
      sport_id: await ctx.data.toAppSportId(activity.sport_id),
    };
  }

  /** A new request: free time in the active week from now on, the base version, the attached session. */
  async function buildBody(input: SendChatInput, text: string, requestId: string, current: ActivePlanDto) {
    const weekStart = current.version.plan.week_start;
    const now = ctx.deps.now();
    const window = (await ctx.data.profile())?.preferences?.preferred_window ?? null;
    let availability: SendChatDto['availability'];
    try {
      availability = await ctx.deps.captureAvailability({
        weekStart,
        from: new Date(Math.max(now.getTime(), fromLocalDate(weekStart).getTime())),
        window: window ? [window.start_hour, window.end_hour] : null,
        capturedAt: now,
      });
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('unknown', NO_FREE_TIME, { retryable: false, cause: error });
    }
    const aboutId = input.about_session_id;
    // The API only takes an activity of the active version; an older one stays a local chip.
    const attach = !!aboutId && current.version.plan.activities.some((activity) => activity.id === aboutId);
    const body: SendChatDto = {
      request_id: requestId,
      plan_id: current.plan.id,
      expected_version: input.base_version ?? current.version.version,
      message: text,
      ...(attach ? { activity_id: aboutId } : {}),
      availability,
    };
    return body;
  }

  return {
    async listMessages() {
      const current = await ctx.data.currentPlan();
      if (!current) return [];
      return thread(await ctx.data.chat(current.plan.id), current);
    },

    async send(input) {
      const text = input.text.trim();
      if (!text) throw new ApiError('validation', 'Write a message first.');
      if (text.length > MAX_MESSAGE_LENGTH) {
        throw new ApiError('validation', 'That message is too long. Keep it under 2,000 characters.');
      }
      // Who the turn is for: its answer is cached only while the same account is signed in.
      const userId = await ctx.data.userId();
      const current = await ctx.data.currentPlan();
      if (!current) throw new ApiError('conflict', NOT_READY);

      const requestId = input.request_id ?? ctx.deps.newId();
      let body = bodies.get(requestId);
      if (!body || body.message !== text) {
        body = await buildBody(input, text, requestId, current);
        keep(bodies, requestId, body);
        if (input.about_session_id) {
          // Only the chip depends on this: never fail the message over it.
          const ref = await sessionRef(input.about_session_id).catch(() => null);
          if (ref) await about.save(requestId, ref).catch(() => undefined);
        }
      }

      let result: ChatResultDto;
      try {
        result = await ctx.http.post<ChatResultDto>('/chat', body, { timeoutMs: AI_TIMEOUT_MS, retryTransport: true });
      } catch (error) {
        // A transport failure may still have been applied: keep the body for Try again.
        if (!isTransport(error)) bodies.delete(requestId);
        if (isApiError(error, 'stale_version') || isApiError(error, 'conflict')) {
          ctx.data.invalidate('currentPlan', 'history', 'chat');
        }
        throw error;
      }
      bodies.delete(requestId);

      const changed = result.outcome === 'plan_updated';
      if (changed) {
        ctx.data.setCurrentPlan(result.active_plan, userId);
        ctx.data.invalidate('history', 'chat');
      } else {
        ctx.data.invalidate('chat');
      }
      const active = result.active_plan ?? current;
      // The turn is saved: if a read for the cards fails now, the refetched thread draws them.
      const messages = await thread(result.messages, active).catch(() =>
        threadFromWire(result.messages, { ...EMPTY_THREAD_CONTEXT, activeVersionId: activeVersionId(active) }),
      );
      return { messages, plan_changed: changed, active_version: active.version.version };
    },

    async undo(messageId) {
      const userId = await ctx.data.userId();
      const current = await ctx.data.currentPlan();
      if (!current) throw new ApiError('conflict', CANT_UNDO);
      let body = undoBodies.get(messageId);
      if (!body) {
        const message = (await ctx.data.chat(current.plan.id)).find((m) => m.id === messageId);
        if (!message || !isChangeMessage(message)) {
          throw new ApiError('not_found', "We couldn't find that change. It may have changed meanwhile.");
        }
        // The server undoes whatever change is active: only this card's change may be.
        if (message.plan_version_id !== activeVersionId(current)) throw new ApiError('conflict', CANT_UNDO);
        body = { request_id: ctx.deps.newId(), plan_id: current.plan.id, expected_version: current.version.version };
        keep(undoBodies, messageId, body);
      }

      let result: ActivePlanDto;
      try {
        result = await ctx.http.post<ActivePlanDto>('/plans/undo', body, { timeoutMs: AI_TIMEOUT_MS, retryTransport: true });
      } catch (error) {
        if (isTransport(error)) throw error;
        undoBodies.delete(messageId);
        ctx.data.invalidate('currentPlan', 'history', 'chat');
        if (serverErrorCode(error) === 'NOTHING_TO_UNDO') {
          throw new ApiError('conflict', CANT_UNDO, { retryable: false, cause: (error as ApiError).cause });
        }
        throw error;
      }
      undoBodies.delete(messageId);
      ctx.data.setCurrentPlan(result, userId);
      ctx.data.invalidate('history', 'chat');
      return { messages: [], plan_changed: true, active_version: result.version.version };
    },
  };
}
