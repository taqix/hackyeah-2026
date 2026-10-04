/**
 * The mocked ApiClient: the pure backend behind latency, the demo switches and
 * storage. Every call waits for the saved data to load, rejects with `offline`
 * when the demo says so, and returns copies, never live database objects.
 */
import { now } from '@/lib/clock';
import {
  debugLog,
  debugLogsEnabled,
  debugWarn,
  describeError,
  errorLabel,
  startTimer,
  summarizeData,
} from '@/lib/debug-log';

import type { ApiClient } from '../client';
import { ApiError } from '../types';
import { createBackend } from './backend';
import { getDb, hydrateDb, persistSoon } from './db';
import { demo } from './demo';

/** Chat replies take a little longer, so the Updating state (8.2) is visible. */
const CHAT_EXTRA_MS = 900;

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const copy = <T>(value: T): T => (value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T));

let ready: Promise<void> | null = null;
function whenReady(): Promise<void> {
  ready ??= demo.hydrate().then(() => hydrateDb().then(() => undefined));
  return ready;
}

/**
 * Debug builds: every mock call as `[movo:mock] plan.getState 12ms`, with the
 * result's shape or the error code; never arguments (emails, passwords, chat
 * text). Unchanged when debug logs are off.
 */
function withCallLogging(client: ApiClient): ApiClient {
  if (!debugLogsEnabled) return client;
  const sections = client as unknown as Record<string, Record<string, (...args: unknown[]) => Promise<unknown>>>;
  const logged: Record<string, Record<string, (...args: unknown[]) => Promise<unknown>>> = {};
  for (const [section, methods] of Object.entries(sections)) {
    logged[section] = {};
    for (const [name, method] of Object.entries(methods)) {
      logged[section][name] = (...args) => {
        const took = startTimer();
        const result = method(...args);
        void Promise.resolve(result).then(
          (value) => debugLog('mock', `${section}.${name} ${took()}`, () => ({ data: summarizeData(value) })),
          (error: unknown) =>
            debugWarn('mock', `✕ ${section}.${name} ${took()} ${errorLabel(error)}`, () => describeError(error)),
        );
        return result;
      };
    }
  }
  // Same sections and method names as `client`, each wrapped with the same signature.
  return logged as unknown as ApiClient;
}

export function createMockApiClient(): ApiClient {
  const backend = createBackend({ db: getDb, now });

  /** Run one request the way a server would answer it. */
  async function call<T>(run: () => T, extraMs = 0): Promise<T> {
    await whenReady();
    await delay(demo.get().latencyMs + extraMs);
    if (demo.get().offline) throw new ApiError('offline', "You're offline. Check your connection and try again.");
    try {
      return copy(run());
    } finally {
      persistSoon();
    }
  }

  return withCallLogging({
    auth: {
      getSession: () => call(() => backend.auth.getSession()),
      lookupEmail: (email) => call(() => backend.auth.lookupEmail(email)),
      signInWithEmail: (email, password) => call(() => backend.auth.signInWithEmail(email, password)),
      signUpWithEmail: (email, password, name) => call(() => backend.auth.signUpWithEmail(email, password, name)),
      signInWithGoogle: () => call(() => backend.auth.signInWithGoogle()),
      signInAsGuest: () => call(() => backend.auth.signInAsGuest()),
      upgradeGuest: (email, password) => call(() => backend.auth.upgradeGuest(email, password)),
      sendPasswordReset: (email) => call(() => backend.auth.sendPasswordReset(email)),
      updatePassword: (password) => call(() => backend.auth.updatePassword(password)),
      getProviders: () => call(() => backend.auth.getProviders()),
      signOut: () => call(() => backend.auth.signOut()),
    },
    catalog: {
      listSports: () => call(() => backend.catalog.listSports()),
    },
    preferences: {
      get: () => call(() => backend.preferences.get()),
      save: (preferences) => call(() => backend.preferences.save(copy(preferences))),
    },
    plan: {
      getState: () => call(() => backend.plan.getState()),
      // The mock plans from the preferred window; it does not read the calendar.
      build: () => call(() => backend.plan.build(null, demo.consume('failNextBuild'))),
      getWeek: (weekStart) => call(() => backend.plan.getWeek(weekStart)),
      listSessions: (range) => call(() => backend.plan.listSessions(range)),
      getSession: (id) => call(() => backend.plan.getSession(id)),
      listVersions: () => call(() => backend.plan.listVersions()),
      dismissRecentChange: () => call(() => backend.plan.dismissRecentChange()),
    },
    logs: {
      create: (input) => call(() => backend.logs.create(copy(input))),
      get: (id) => call(() => backend.logs.get(id)),
      update: (id, patch) => call(() => backend.logs.update(id, copy(patch))),
      saveFeedback: (logId, feedback) => call(() => backend.logs.saveFeedback(logId, copy(feedback))),
      commit: (id) => call(() => backend.logs.commit(id)),
      lastForExercise: (exercise) => call(() => backend.logs.lastForExercise(exercise)),
    },
    chat: {
      listMessages: () => call(() => backend.chat.listMessages()),
      send: (input) =>
        call(() => {
          if (demo.consume('failNextChat')) {
            throw new ApiError('generation_failed', "Something went wrong on our side. Your plan hasn't changed.");
          }
          if (demo.consume('staleNextChat')) {
            throw new ApiError('stale_version', 'Your plan changed meanwhile, so nothing was overwritten.');
          }
          return backend.chat.send(copy(input));
        }, CHAT_EXTRA_MS),
      undo: (messageId) => call(() => backend.chat.undo(messageId)),
    },
    profile: {
      getSummary: () => call(() => backend.profile.getSummary()),
      getFeedback: () => call(() => backend.profile.getFeedback()),
      setOpinion: (key, opinion) => call(() => backend.profile.setOpinion(key, opinion)),
      resetFeedback: () => call(() => backend.profile.resetFeedback()),
      setSportExcluded: (sportId, excluded) => call(() => backend.profile.setSportExcluded(sportId, excluded)),
    },
    account: {
      get: () => call(() => backend.account.get()),
      updateName: (name) => call(() => backend.account.updateName(name)),
    },
  });
}
