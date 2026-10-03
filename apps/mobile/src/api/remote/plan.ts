import type { ApiClient } from '../client';
import { notImplemented, type RemoteContext } from './context';

/**
 * Plan state, weeks and sessions from the plan history (`ctx.data`), joined
 * with completions and drafts; build calls POST /plans/generate.
 */
export function createRemotePlan(ctx: RemoteContext): ApiClient['plan'] {
  return {
    getState: () => notImplemented(),
    build: () => notImplemented(),
    getWeek: () => notImplemented(),
    listSessions: () => notImplemented(),
    getSession: () => notImplemented(),
    listVersions: () => notImplemented(),
    dismissRecentChange: () => notImplemented(),
  };
}
