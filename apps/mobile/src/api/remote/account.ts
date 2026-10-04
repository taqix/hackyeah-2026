import type { ApiClient } from '../client';
import { ApiError } from '../types';
import { readSession } from './auth';
import type { RemoteContext } from './context';
import { defaultErrorMessage } from './http';

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
      return { user: session.user, timezone: profile?.preferences?.timezone ?? deviceTimezone() };
    },
  };
}
