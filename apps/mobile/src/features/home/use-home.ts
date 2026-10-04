import { useFocusEffect, useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  useBuildPlan,
  useDismissRecentChange,
  useEnsureNextWeek,
  usePlanState,
  usePreferences,
  useSession,
  useSports,
  useWeek,
} from '@/api/hooks';
import type { LocalDate } from '@/api/types';
import { useNow } from '@/lib/clock';
import { addDays, startOfWeek, toLocalDate } from '@/lib/dates';
import { answersSentence } from '@/lib/preference-options';
import { useOpenChat } from '@/navigation/open-chat';

import { firstName, headerKicker, resolveSelection } from './home-model';

/**
 * What the Today tab reads and does, shared by the phone screen and the desktop
 * dashboard: the plan, the selected week and day (the route params `week` and
 * `day`, so chat's See week can open a day), and the actions on them.
 */
export function useHome() {
  const router = useRouter();
  const params = useLocalSearchParams<{ week?: string; day?: string }>();
  const now = useNow();
  const today = toLocalDate(now);
  const currentWeek = startOfWeek(today);

  const session = useSession();
  const preferences = usePreferences();
  const sports = useSports();
  const planState = usePlanState();
  const plan = planState.data;
  const ready = plan?.status === 'ready';

  const { weekStart, day } = resolveSelection(params, today, plan);
  const nextWeekStart = addDays(weekStart, 7);
  const canNext = nextWeekStart <= currentWeek || (!!plan?.planned_through && nextWeekStart <= plan.planned_through);
  const week = useWeek(weekStart, { enabled: ready });
  const nextWeek = useWeek(nextWeekStart, { enabled: ready && canNext });

  const build = useBuildPlan();
  const focused = useIsFocused();
  // Plans go one week ahead: from the last planned day, Home plans the next week.
  useEnsureNextWeek(focused);
  const openChat = useOpenChat();
  const recentChange = plan?.recent_change ?? null;
  const dismissChange = useDismissWhenLeft(!!recentChange);

  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        planState.refetch(),
        ready ? week.refetch() : null,
        ready && canNext ? nextWeek.refetch() : null,
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const select = (targetWeek: LocalDate, targetDay: LocalDate) => {
    if (targetWeek === currentWeek && targetDay === today) router.setParams({ week: undefined, day: undefined });
    else router.setParams({ week: targetWeek, day: targetDay });
  };

  return {
    now,
    today,
    currentWeek,
    /** The Today tab is on screen (not covered by a pushed screen). */
    focused,
    /** "Wednesday, 7 October · Week 1" */
    kicker: headerKicker(today, ready ? plan.first_week_start : null),
    name: firstName(session.data?.user.name),
    /** The saved answers in one sentence, once loaded. */
    answers: preferences.data ? answersSentence(preferences.data, sports.data) : null,
    preferences: preferences.data,
    sports: sports.data,
    planState,
    plan,
    weekStart,
    day,
    week,
    nextWeek,
    canNext,
    build,
    buildPlan: () => build.mutate({ week_start: currentWeek }),
    recentChange,
    dismissChange,
    openChat,
    reviewAnswers: () => router.navigate('/you'),
    refreshing,
    refresh,
    select,
  };
}

export type HomeState = ReturnType<typeof useHome>;

/**
 * The Plan updated note is shown once: Dismiss or See the chat hide it at
 * once, and leaving Home after it was on screen marks it seen.
 */
function useDismissWhenLeft(shown: boolean) {
  const { mutate } = useDismissRecentChange();
  const shownRef = useRef(shown);
  useEffect(() => {
    shownRef.current = shown;
  }, [shown]);
  useFocusEffect(
    useCallback(
      () => () => {
        if (shownRef.current) {
          shownRef.current = false;
          mutate();
        }
      },
      [mutate],
    ),
  );
  return () => {
    shownRef.current = false;
    mutate();
  };
}
