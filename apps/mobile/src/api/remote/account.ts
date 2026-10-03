import type { ApiClient } from '../client';
import { notImplemented, type RemoteContext } from './context';

/** The signed-in Supabase user and the timezone from preferences (else the device). */
export function createRemoteAccount(ctx: RemoteContext): ApiClient['account'] {
  return {
    get: () => notImplemented(),
  };
}
