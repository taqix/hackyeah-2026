/**
 * Data hooks for screens. The only way UI reads or changes server data.
 *
 * FOUNDATION STUB: the data-layer work completes this module (one file per
 * area, re-exported here). Keep these three exports and their return types:
 * the root gate and the app shell use them.
 */
import { useQuery } from '@tanstack/react-query';

import { api } from '@/api';
import { queryKeys } from '@/api/query-keys';

/** The signed-in session, or null. */
export function useSession() {
  return useQuery({ queryKey: queryKeys.session, queryFn: () => api.auth.getSession() });
}

/** The saved answers, or null before onboarding is finished. */
export function usePreferences(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.preferences,
    queryFn: () => api.preferences.get(),
    enabled: options?.enabled ?? true,
  });
}

/** Plan status; polls while the first plan is building. */
export function usePlanState(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.planState,
    queryFn: () => api.plan.getState(),
    enabled: options?.enabled ?? true,
    refetchInterval: (query) => (query.state.data?.status === 'building' ? 1_000 : false),
  });
}
