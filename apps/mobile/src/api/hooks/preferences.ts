import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/api';
import { queryKeys } from '@/api/query-keys';
import type { Preferences } from '@/api/types';

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
 * exists, upcoming sessions follow the new answers and done ones stay.
 */
export function useSavePreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (preferences: Preferences) => api.preferences.save(preferences),
    onSuccess: (saved) => {
      queryClient.setQueryData(queryKeys.preferences, saved);
      void queryClient.invalidateQueries({ queryKey: queryKeys.planAll });
      void queryClient.invalidateQueries({ queryKey: queryKeys.summary });
      void queryClient.invalidateQueries({ queryKey: queryKeys.account });
    },
  });
}
