import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { api } from '@/api';
import { queryKeys } from '@/api/query-keys';
import { weekToPlanNext } from '@/api/remote/plan/schedule';
import type { BuildPlanInput, LocalDate, PlanState } from '@/api/types';
import { useNow } from '@/lib/clock';
import { toLocalDate } from '@/lib/dates';

import { useSession } from './auth';

/** Plan reads other than the state itself. */
const otherPlanQueries = { queryKey: queryKeys.planAll, predicate: (q: { queryKey: readonly unknown[] }) => q.queryKey[1] !== 'state' };

/** How long a background re-plan may take: the AI's two minutes and a little more. */
const WATCH_MS = 130_000;
const WATCH_POLL_MS = 3_000;
/** Until when the plan state polls for a change made in the background (device time, ms). */
let watchUntil = 0;

/**
 * Saved answers re-plan the week in the background (the Supabase backend):
 * poll the plan state for a while, until the new version or a failure note
 * arrives, so Home and Calendar refresh on their own.
 */
export function watchPlanChanges(): void {
  watchUntil = Date.now() + WATCH_MS;
}

/**
 * Plan status; polls every second while the first plan is building, and every
 * few seconds while a background re-plan runs. When the status or the active
 * version changes (built, a weekly plan, a re-plan), the weeks and sessions
 * refetch.
 */
export function usePlanState(options?: { enabled?: boolean }) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: queryKeys.planState,
    queryFn: async () => {
      const previous = queryClient.getQueryData<PlanState>(queryKeys.planState);
      const next = await api.plan.getState();
      const changed = previous && (previous.status !== next.status || previous.active_version !== next.active_version);
      if (changed) void queryClient.invalidateQueries(otherPlanQueries);
      if (changed || (next.failure_message && next.failure_message !== previous?.failure_message)) watchUntil = 0;
      return next;
    },
    enabled: options?.enabled ?? true,
    refetchInterval: (query) =>
      query.state.data?.status === 'building' ? 1_000 : Date.now() < watchUntil ? WATCH_POLL_MS : false,
  });
}

/**
 * Review's Build plan, or Try again after 5.8. Resolves with status building;
 * poll with usePlanState. With a plan in use (the next week) it resolves once
 * the week is planned, and a failure leaves the plan as it was.
 */
export function useBuildPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: BuildPlanInput) => api.plan.build(input),
    onSuccess: (state) => {
      queryClient.setQueryData(queryKeys.planState, state);
      void queryClient.invalidateQueries(otherPlanQueries);
    },
    // A failed weekly plan shows as a note in the plan state.
    onError: () => queryClient.invalidateQueries({ queryKey: queryKeys.planState }),
  });
}

/** Weeks already asked for in this app session, per user: each is tried once, so a failure never loops. */
const askedWeeks = new Set<string>();

/**
 * Plans go one week ahead: from the last planned day, plan the next week
 * (after a gap, the current one), once per week per app session. Home calls
 * it with `active` while it is focused. A failure is the plan state's note.
 */
export function useEnsureNextWeek(active: boolean) {
  const { data: plan } = usePlanState();
  const userId = useSession().data?.user.id ?? null;
  const today = toLocalDate(useNow());
  const { mutate, isPending } = useBuildPlan();
  const target = weekToPlanNext(plan, today);

  useEffect(() => {
    if (!active || !target || !userId) return;
    const key = `${userId}:${target}`;
    if (askedWeeks.has(key)) return;
    askedWeeks.add(key);
    mutate({ week_start: target });
  }, [active, target, userId, mutate]);

  return { planning: isPending };
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
