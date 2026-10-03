import type { ApiClient } from '../client';
import { notImplemented, type RemoteContext } from './context';

/** GET /profile and PUT /profile (the whole document; keep the username). */
export function createRemotePreferences(ctx: RemoteContext): ApiClient['preferences'] {
  return {
    get: () => notImplemented(),
    save: () => notImplemented(),
  };
}
