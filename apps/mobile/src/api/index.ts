import type { ApiClient } from './client';
import { apiConfig } from './config';
import { createMockApiClient } from './mock';
import { createDefaultRemoteApiClient } from './remote/default';
import { createUnconfiguredApiClient } from './unconfigured';

/**
 * The one place the app picks its backend (EXPO_PUBLIC_API_MODE): the
 * Supabase product API by default, the offline mock in mock mode. A Supabase
 * build without its URL or key never falls back to the mock: every call
 * rejects with not_configured and the root layout shows the setup screen.
 * Screens never import this directly: they use the hooks in `@/api/hooks`.
 */
function pickClient(): ApiClient {
  if (apiConfig.mode === 'mock') return createMockApiClient();
  if (apiConfig.configured) return createDefaultRemoteApiClient();
  return createUnconfiguredApiClient(apiConfig.missing);
}

export const api: ApiClient = pickClient();

export type { ApiClient } from './client';
export * from './types';
