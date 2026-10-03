/**
 * The ApiClient over the Supabase product API, composed from one module per
 * section. Pure: everything platform-specific arrives in `RemoteDeps`, so Node
 * tests build it with fakes. `default.ts` wires the real dependencies.
 */
import type { ApiClient } from '../client';
import { createRemoteAccount } from './account';
import { createRemoteAuth } from './auth';
import { createRemoteCatalog } from './catalog';
import { createRemoteChat } from './chat';
import type { RemoteContext } from './context';
import { createRemoteData, type RemoteData } from './data';
import type { AuthErrorLike, AuthPort, RemoteDeps } from './deps';
import { createDraftStore, type DraftStore } from './drafts';
import { createProductApi, type ProductApi } from './http';
import { createRemoteLogs, flushDrafts } from './logs';
import { createRemotePlan } from './plan';
import { createRemotePreferences } from './preferences';
import { createRemoteProfile } from './profile';

/** A network failure inside supabase-js (as opposed to an Auth answer such as an expired refresh token). */
export function isAuthNetworkError(error: AuthErrorLike | null | undefined): boolean {
  return !!error && (error.name === 'AuthRetryableFetchError' || error.status === 0);
}

/**
 * The access token for API calls: the stored session (supabase-js refreshes
 * it when it is about to expire), or a forced refresh after a 401. Null means
 * signed out; a network failure rejects, so it reads as offline.
 */
export function accessTokenGetter(auth: AuthPort): (forceRefresh?: boolean) => Promise<string | null> {
  return async (forceRefresh = false) => {
    const { data, error } = forceRefresh ? await auth.refreshSession() : await auth.getSession();
    if (isAuthNetworkError(error)) throw error;
    return data.session?.access_token ?? null;
  };
}

export interface RemoteRuntime {
  client: ApiClient;
  http: ProductApi;
  /** Reset on sign-out; invalidate after writes. */
  data: RemoteData;
  drafts: DraftStore;
  /** Saves logs left as drafts (an earlier session closed before saving). Never rejects. */
  flushDrafts(): Promise<void>;
}

export function createRemoteRuntime(deps: RemoteDeps): RemoteRuntime {
  const http = createProductApi({
    fetch: deps.fetch,
    baseUrl: deps.productApiUrl,
    publishableKey: deps.publishableKey,
    getAccessToken: accessTokenGetter(deps.auth),
  });
  const data = createRemoteData(http, deps);
  const drafts = createDraftStore(deps.storage, data.userId);
  const ctx: RemoteContext = { http, data, deps, drafts };
  const client: ApiClient = {
    auth: createRemoteAuth(ctx),
    catalog: createRemoteCatalog(ctx),
    preferences: createRemotePreferences(ctx),
    plan: createRemotePlan(ctx),
    logs: createRemoteLogs(ctx),
    chat: createRemoteChat(ctx),
    profile: createRemoteProfile(ctx),
    account: createRemoteAccount(ctx),
  };
  return { client, http, data, drafts, flushDrafts: () => flushDrafts(ctx) };
}

export function createRemoteApiClient(deps: RemoteDeps): ApiClient {
  return createRemoteRuntime(deps).client;
}
