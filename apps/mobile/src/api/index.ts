import type { ApiClient } from './client';
import { createMockApiClient } from './mock';

/**
 * The one place the app picks its backend. Screens never import this directly:
 * they use the hooks in `@/api/hooks`. Swap the mock for an HTTP client here
 * once the NestJS API exists.
 */
export const api: ApiClient = createMockApiClient();

export type { ApiClient } from './client';
export * from './types';
