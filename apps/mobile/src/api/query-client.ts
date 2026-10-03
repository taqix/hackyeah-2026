import { QueryClient } from '@tanstack/react-query';

import { isApiError } from './types';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Offline and validation errors are shown with Try again; retry only transient failures once.
      retry: (failureCount, error) => failureCount < 1 && (!isApiError(error) || error.retryable),
    },
    mutations: { retry: false },
  },
});
