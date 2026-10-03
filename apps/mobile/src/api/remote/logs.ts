import type { ApiClient } from '../client';
import { notImplemented, type RemoteContext } from './context';

/**
 * Logs are local drafts (`ctx.drafts`) until feedback is saved or the
 * feedback screen closes; then POST /completions. Saved completions read from
 * `ctx.data.completions()`.
 */
/**
 * Saves every pending draft as a completion (without feedback, or with the
 * body already sent). Called by AuthSessionSync at a signed-in start; must not
 * reject: a draft that still fails stays for the next start.
 */
export async function flushDrafts(ctx: RemoteContext): Promise<void> {}

export function createRemoteLogs(ctx: RemoteContext): ApiClient['logs'] {
  return {
    create: () => notImplemented(),
    get: () => notImplemented(),
    update: () => notImplemented(),
    saveFeedback: () => notImplemented(),
    commit: () => notImplemented(),
    lastForExercise: () => notImplemented(),
  };
}
