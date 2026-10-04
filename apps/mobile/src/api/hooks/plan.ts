import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/api';
import { queryKeys } from '@/api/query-keys';
import type { BuildPlanInput, LocalDate, PlanState } from '@/api/types';

/** Plan reads other than the state itself. */
const otherPlanQueries = { queryKey: queryKeys.planAll, predicate: (q: { queryKey: readonly unknown[] }) => q.queryKey[1] !== 'state' };

/**
 * Plan status; polls every second while the first plan is building. When the
 * status or the active version changes (built, a weekly plan on Sunday), the
 * weeks and sessions refetch.
 */
export function usePlanState(options?: { enabled?: boolean }) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: queryKeys.planState,
    queryFn: async () => {
      const previous = queryClient.getQueryData<PlanState>(queryKeys.planState);
      const next = await api.plan.getState();
      if (previous && (previous.status !== next.status || previous.active_version !== next.active_version)) {
        void queryClient.invalidateQueries(otherPlanQueries);
      }
      return next;
    },
    enabled: options?.enabled ?? true,
    refetchInterval: (query) => (query.state.data?.status === 'building' ? 1_000 : false),
  });
}

/** Review's Build plan, or Try again after 5.8. Resolves with status building; poll with usePlanState. */
export function useBuildPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: BuildPlanInput) => api.plan.build(input),
    onSuccess: (state) => {
      queryClient.setQueryData(queryKeys.planState, state);
      void queryClient.invalidateQueries(otherPlanQueries);
    },
  });
}

/** One Monday-to-Sunday week: sessions, extras, whether it is planned, and its summary. */
export function useWeek(weekStart: LocalDate | null | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.week(weekStart ?? ''),
    queryFn: () => api.plan.getWeek(weekStart as LocalDate),
    enabled: !!weekStart && (options?.enabled ?? true),
  });
}

/** Sessions and extras whose day is in [from, to] (the Calendar month). */
export function useSessionsInRange(from: LocalDate | null | undefined, to: LocalDate | null | undefined) {
  return useQuery({
    queryKey: queryKeys.sessions(from ?? '', to ?? ''),
    queryFn: () => api.plan.listSessions({ from: from as LocalDate, to: to as LocalDate }),
    enabled: !!from && !!to,
    // Paging months keeps the last month's marks until the next one arrives.
    placeholderData: keepPreviousData,
  });
}

/** One planned session (Activity 6, Log it, the gym). */
export function usePlannedSession(id: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.plannedSession(id ?? ''),
    queryFn: () => api.plan.getSession(id as string),
    enabled: !!id,
  });
}

/** Plan history (10.1), newest first. */
export function usePlanVersions() {
  return useQuery({ queryKey: queryKeys.versions, queryFn: () => api.plan.listVersions() });
}

/** Home 5.4: the Plan updated note was seen. Hides it at once. */
export function useDismissRecentChange() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.plan.dismissRecentChange(),
    onMutate: () => {
      queryClient.setQueryData<PlanState>(queryKeys.planState, (state) =>
        state ? { ...state, recent_change: null } : state,
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.planState }),
  });
}
