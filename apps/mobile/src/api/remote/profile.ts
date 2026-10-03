import type { ApiClient } from '../client';
import { notImplemented, type RemoteContext } from './context';

/** The assistant summary (unavailable), opinions (GET/PUT /opinions) and switched-off sports (PUT /profile). */
export function createRemoteProfile(ctx: RemoteContext): ApiClient['profile'] {
  return {
    getSummary: () => notImplemented(),
    getFeedback: () => notImplemented(),
    setOpinion: () => notImplemented(),
    resetFeedback: () => notImplemented(),
    setSportExcluded: () => notImplemented(),
  };
}
