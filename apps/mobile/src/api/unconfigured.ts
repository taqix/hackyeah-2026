import type { ApiClient } from './client';
import { ApiError } from './types';

/**
 * The client of a Supabase build without its configuration: every call
 * rejects with not_configured. The root layout shows the setup screen instead
 * of the app, so this only guards against a silent fallback to the mock.
 */
export function createUnconfiguredApiClient(missing: string[]): ApiClient {
  const fail = (): Promise<never> =>
    Promise.reject(
      new ApiError('not_configured', `This build isn't connected to a server yet. Missing: ${missing.join(', ')}.`),
    );
  return {
    auth: {
      getSession: fail,
      lookupEmail: fail,
      signInWithEmail: fail,
      signUpWithEmail: fail,
      signInWithGoogle: fail,
      sendPasswordReset: fail,
      updatePassword: fail,
      getProviders: fail,
      signOut: fail,
    },
    catalog: { listSports: fail },
    preferences: { get: fail, save: fail },
    plan: {
      getState: fail,
      build: fail,
      getWeek: fail,
      listSessions: fail,
      getSession: fail,
      listVersions: fail,
      dismissRecentChange: fail,
    },
    logs: { create: fail, get: fail, update: fail, saveFeedback: fail, commit: fail, lastForExercise: fail },
    chat: { listMessages: fail, send: fail, undo: fail },
    profile: { getSummary: fail, getFeedback: fail, setOpinion: fail, resetFeedback: fail, setSportExcluded: fail },
    account: { get: fail, updateName: fail },
  };
}
