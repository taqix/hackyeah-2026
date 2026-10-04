import { checkName } from '../../lib/person-name';
import type { ApiClient } from '../client';
import { ApiError } from '../types';
import { mapAuthError, readSession, withProfileName } from './auth';
import type { RemoteContext } from './context';
import type { AuthPort } from './deps';
import { defaultErrorMessage } from './http';
import type { ProfileEntity, UpdateProfileDto } from './wire';

/** The device's IANA time zone, or Europe/Warsaw where Intl can't tell. */
function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Warsaw';
  } catch {
    return 'Europe/Warsaw';
  }
}

/** The signed-in Supabase user and the timezone from preferences (else the device). */
export function createRemoteAccount(ctx: RemoteContext): ApiClient['account'] {
  return {
    async get() {
      const session = await readSession(ctx.deps.auth);
      if (!session) throw new ApiError('unauthorized', defaultErrorMessage('unauthorized'));
      const profile = await ctx.data.profile();
      const { user } = await withProfileName(ctx, session);
      return { user, timezone: profile?.preferences?.timezone ?? deviceTimezone() };
    },

    /**
     * The profile's username first (PUT /profile replaces the whole document,
     * so it goes with the current answers; before onboarding there are none,
     * and the first save of the answers writes the name), then the Auth
     * metadata the session reads. A failure in either rejects, and trying
     * again repeats both.
     */
    async updateName(name) {
      const saved = checkName(name);
      const userId = await ctx.data.userId();
      const profile = await ctx.data.profile();
      if (profile?.preferences) {
        const body: UpdateProfileDto = { username: saved, preferences: profile.preferences };
        ctx.data.setProfile(await ctx.http.put<ProfileEntity>('/profile', body), userId);
      }
      let result: Awaited<ReturnType<AuthPort['updateUser']>>;
      try {
        result = await ctx.deps.auth.updateUser({ data: { name: saved, full_name: saved } });
      } catch (thrown) {
        throw mapAuthError(thrown);
      }
      if (result.error) throw mapAuthError(result.error);
      return saved;
    },
  };
}
