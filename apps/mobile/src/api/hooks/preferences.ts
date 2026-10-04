import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/api';
import { queryKeys } from '@/api/query-keys';
import { planningFieldsChanged } from '@/api/remote/preferences';
import type { PlanState, Preferences } from '@/api/types';

import { watchPlanChanges } from './plan';

/** The saved answers, or null before onboarding is finished. */
export function usePreferences(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.preferences,
    queryFn: () => api.preferences.get(),
    enabled: options?.enabled ?? true,
  });
}

/**
 * Save the answers (Review's Build plan, Profile › Edit's Save). Once a plan
 * exists, upcoming sessions follow the new answers and done ones stay; the
 * Supabase backend re-plans in the background, so the plan state is watched
 * until the new version arrives.
 */
export function useSavePreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (preferences: Preferences) => api.preferences.save(preferences),
    onSuccess: (saved) => {
      const before = queryClient.getQueryData<Preferences | null>(queryKeys.preferences);
      const plan = queryClient.getQueryData<PlanState>(queryKeys.planState);
      if (before && plan?.status === 'ready' && planningFieldsChanged(before, saved)) watchPlanChanges();
      queryClient.setQueryData(queryKeys.preferences, saved);
      void queryClient.invalidateQueries({ queryKey: queryKeys.planAll });
      void queryClient.invalidateQueries({ queryKey: queryKeys.summary });
      void queryClient.invalidateQueries({ queryKey: queryKeys.account });
    },
  });
}
