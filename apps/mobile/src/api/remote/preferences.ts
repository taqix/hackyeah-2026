import { debugLog } from '../../lib/debug-log';
import { asUsername } from '../../lib/person-name';
import type { ApiClient } from '../client';
import type { Preferences } from '../types';
import { readSession } from './auth';
import type { RemoteContext } from './context';
import { preferencesFromWire, preferencesToWire } from './mappers';
import { replanActiveWeek } from './plan';
import type { PreferencesDto, ProfileEntity, UpdateProfileDto } from './wire';

/** The answers the planner reads. Timezone and obstacles do not change the plan. */
export const PLANNING_FIELDS = [
  'sessions_per_week',
  'session_minutes',
  'preferred_window',
  'activity_interests',
  'discovery_preference',
  'available_locations',
  'available_equipment',
  'avoidances',
  'excluded_activity_types',
  'starting_comfort',
] as const;

type PlanningField = (typeof PLANNING_FIELDS)[number];

/** Lists compare as sets: picking the same sports in another order changes nothing. The window is a pair. */
const comparable = (field: PlanningField, value: unknown) =>
  JSON.stringify(Array.isArray(value) && field !== 'preferred_window' ? [...value].map(String).sort() : (value ?? null));

/**
 * Whether saved answers change what the plan is built from. Works on the
 * app's answers and on the wire document alike (same field names); no
 * earlier answers counts as a change.
 */
export function planningFieldsChanged(
  before: Pick<Preferences, PlanningField> | Pick<PreferencesDto, PlanningField> | null | undefined,
  after: Pick<Preferences, PlanningField> | Pick<PreferencesDto, PlanningField>,
): boolean {
  if (!before) return true;
  return PLANNING_FIELDS.some((field) => comparable(field, before[field]) !== comparable(field, after[field]));
}

/**
 * The name in the signed-in user's Auth metadata (given at sign-up, or
 * Google's `full_name`/`name`), as a username, or null. PUT /profile can't
 * run before the first answers, so the first save writes it as the profile's
 * username when the server has not filled one in at sign-up.
 */
async function sessionName(ctx: RemoteContext): Promise<string | null> {
  try {
    // The contract's username is 1–200 characters: a name never blocks the answers.
    return asUsername((await readSession(ctx.deps.auth))?.user.name);
  } catch {
    return null;
  }
}

/**
 * GET /profile and PUT /profile (the whole document; the username is kept,
 * or taken from the session's name while the profile has none, so a username
 * the server filled in at sign-up is never replaced, and never by null).
 * When a plan exists and the answers it is built from changed, the active
 * week is re-planned in the background; the save does not wait for it.
 */
export function createRemotePreferences(ctx: RemoteContext): ApiClient['preferences'] {
  return {
    async get() {
      const profile = await ctx.data.profile();
      if (!profile?.preferences) return null;
      return preferencesFromWire(profile.preferences, (await ctx.data.sportIds()).toApp);
    },

    async save(preferences) {
      const userId = await ctx.data.userId();
      const [profile, ids] = await Promise.all([ctx.data.profile(), ctx.data.sportIds()]);
      const document = preferencesToWire(preferences, ids.toWire);
      const username = asUsername(profile?.username) ?? (await sessionName(ctx));
      const body: UpdateProfileDto = { username, preferences: document };
      const saved = await ctx.http.put<ProfileEntity>('/profile', body);
      ctx.data.setProfile(saved, userId);
      const kept = saved.preferences ?? document;
      if (profile?.preferences && planningFieldsChanged(profile.preferences, kept)) {
        // Only this account's plan in use is re-planned; replanActiveWeek checks that and never rejects.
        debugLog('profile', 'answers saved; planning fields changed: re-planning the active week in the background');
        void replanActiveWeek(ctx, userId);
      } else {
        debugLog('profile', `answers saved${profile?.preferences ? '; the plan is unaffected' : ' (first time)'}`);
      }
      return preferencesFromWire(kept, ids.toApp);
    },
  };
}
