import { QueryClient } from '@tanstack/react-query';

import { debugLogsEnabled } from '@/lib/debug-log';

import { logQueryActivity } from './query-logging';
import { isApiError } from './types';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Offline and validation errors are shown with Try again at once; retry other
      // transient failures once. (An offline retry would wait for the window to regain focus.)
      retry: (failureCount, error) =>
        failureCount < 1 && (!isApiError(error) || (error.retryable && error.code !== 'offline')),
    },
    mutations: { retry: false },
  },
});

// Debug builds: queries and mutations in the Metro and DevTools console (see query-logging.ts).
if (debugLogsEnabled) logQueryActivity(queryClient);
