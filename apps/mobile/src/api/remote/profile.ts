import { debugLog } from '../../lib/debug-log';
import type { ApiClient } from '../client';
import { ApiError, type AssistantSummary, type FeedbackOverview } from '../types';
import type { RemoteContext } from './context';
import { serverError } from './http';
import type { ClearedDto, ProfileEntity, PutOpinionDto, UpdateProfileDto } from './wire';

/** The assistant summary needs its own AI call (deferred), so the You tab hides the card. */
const UNAVAILABLE_SUMMARY: AssistantSummary = {
  status: 'unavailable',
  generated_at: null,
  little_data: true,
  title: '',
  headline: '',
  statements: [],
};

/**
 * True when the server has no such route yet (the contract extensions are not
 * deployed): the router answers 405 for a known path, or 404 "Endpoint not
 * found." for an unknown one. Other 404s mean the row itself is missing.
 */
export function isMissingRoute(error: unknown): boolean {
  const detail = serverError(error);
  if (!detail) return false;
  if (detail.status === 405 || detail.code === 'METHOD_NOT_ALLOWED') return true;
  return detail.status === 404 && /endpoint not found/i.test(detail.message ?? '');
}

/** A clear, non-retryable error for a route the server does not have yet. */
export function missingRouteError(message: string, cause: unknown): ApiError {
  return new ApiError('unknown', message, { retryable: false, cause });
}

/** PUT /opinions; a null opinion clears it. Rejects as-is, so callers decide how a missing route reads. */
export async function putOpinion(ctx: RemoteContext, body: PutOpinionDto): Promise<void> {
  try {
    await ctx.http.put<unknown>('/opinions', body);
  } finally {
    ctx.data.invalidate('opinions');
  }
}

const unique = <T>(values: T[]) => [...new Set(values)];

/** Opinions from GET /opinions (newest first) and the switched-off sports from the profile, with app sport IDs. */
async function feedbackOverview(ctx: RemoteContext): Promise<FeedbackOverview> {
  const [opinions, profile, ids] = await Promise.all([ctx.data.opinions(), ctx.data.profile(), ctx.data.sportIds()]);
  return {
    opinions: opinions.map((opinion) => ({
      activity_key: opinion.activity_key,
      title: opinion.title,
      sport_id: ids.toApp(opinion.sport_id),
      opinion: opinion.opinion,
      last_date: opinion.last_date,
      // Discovery suggestions are not marked in the plan contract.
      new_idea: false,
    })),
    excluded_sport_ids: unique((profile?.preferences?.excluded_activity_types ?? []).map(ids.toApp)),
  };
}

/** The assistant summary (unavailable), opinions (GET/PUT /opinions) and switched-off sports (PUT /profile). */
export function createRemoteProfile(ctx: RemoteContext): ApiClient['profile'] {
  return {
    getSummary: async () => ({ ...UNAVAILABLE_SUMMARY, statements: [] }),
    getFeedback: () => feedbackOverview(ctx),
    async setOpinion(activityKey, opinion) {
      const existing = (await ctx.data.opinions()).find((item) => item.activity_key === activityKey);
      if (!existing) throw new ApiError('not_found', 'There is no feedback for this activity.');
      try {
        await putOpinion(ctx, {
          activity_key: existing.activity_key,
          title: existing.title,
          sport_id: existing.sport_id,
          opinion,
          last_date: existing.last_date,
        });
      } catch (error) {
        if (isMissingRoute(error)) throw missingRouteError("We can't change these answers yet. Nothing was changed.", error);
        throw error;
      }
      debugLog('profile', `✓ opinion ${opinion ?? 'cleared'}`);
      return feedbackOverview(ctx);
    },
    async resetFeedback() {
      try {
        const result = await ctx.http.post<ClearedDto | null>('/opinions/reset', {});
        debugLog('profile', `✓ opinions reset: ${result?.cleared ?? '?'} cleared`);
      } catch (error) {
        if (isMissingRoute(error)) throw missingRouteError("We can't reset these answers yet. Nothing was changed.", error);
        throw error;
      } finally {
        ctx.data.invalidate('opinions');
      }
      return feedbackOverview(ctx);
    },
    async setSportExcluded(sportId, excluded) {
      // PUT /profile replaces the whole document, so start from a fresh read.
      const userId = await ctx.data.userId();
      ctx.data.invalidate('profile');
      const [profile, ids] = await Promise.all([ctx.data.profile(), ctx.data.sportIds()]);
      const preferences = profile?.preferences;
      if (!profile || !preferences) throw new ApiError('validation', 'Save your answers first.');
      // Compared in app IDs, so a sport the catalog no longer has can still be switched back on.
      const rest = preferences.excluded_activity_types.filter((id) => ids.toApp(id) !== sportId);
      let next = rest;
      if (excluded) {
        const wireId = ids.toWire(sportId);
        if (!wireId) throw new ApiError('not_found', "We couldn't find that activity.");
        next = [...rest, wireId];
      }
      const body: UpdateProfileDto = {
        username: profile.username,
        preferences: { ...preferences, excluded_activity_types: next },
      };
      const saved = await ctx.http.put<ProfileEntity>('/profile', body);
      debugLog('profile', `✓ sport ${sportId} ${excluded ? 'switched off' : 'switched back on'}`, {
        switched_off: next.length,
      });
      ctx.data.setProfile(saved, userId);
      return feedbackOverview(ctx);
    },
  };
}
