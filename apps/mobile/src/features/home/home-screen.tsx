import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { RefreshControl } from 'react-native-gesture-handler';

import {
  useBuildPlan,
  useDismissRecentChange,
  usePlanState,
  usePreferences,
  useSession,
  useSports,
  useWeek,
} from '@/api/hooks';
import { isApiError, type LocalDate } from '@/api/types';
import { Col, Content, Screen } from '@/components/layout';
import { Skeleton } from '@/components/ui';
import { useNow } from '@/lib/clock';
import { addDays, startOfWeek, toLocalDate } from '@/lib/dates';
import { answersSentence } from '@/lib/preference-options';
import { useBottomClearance } from '@/navigation/bottom-clearance';
import { useOpenChat } from '@/navigation/open-chat';
import { useTheme } from '@/theme';

import { HomeHeader } from './home-header';
import { changedWhen, firstName, headerKicker, resolveSelection } from './home-model';
import { PlanUpdated } from './plan-updated';
import { BuildFailed, BuildingHero, HeaderSkeleton, NoPlanYet, PlanLoadError, WeekSkeleton } from './plan-states';
import { PlanWeekView } from './plan-week';
import { WeekStripLoading } from './week-strip';

/**
 * The Today tab (5): what do I do today, and how is my week going? The route
 * params `week` and `day` hold the selection, so chat's See week can open a day.
 */
export function HomeScreen() {
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

  const name = firstName(session.data?.user.name);
  const answers = preferences.data ? answersSentence(preferences.data, sports.data) : null;
  const header = <HomeHeader kicker={headerKicker(today, ready ? plan.first_week_start : null)} name={name} now={now} />;
  const buildPlan = () => build.mutate({ available_slots: null });

  let body: ReactNode;
  if (planState.isPending) {
    body = (
      <View accessible role="status" accessibilityLabel="Loading your plan" style={{ gap: 20 }}>
        <HeaderSkeleton />
        <Col gap={6}>
          <Skeleton width={132} height={14} />
          <WeekStripLoading weekStart={currentWeek} today={today} />
        </Col>
        <WeekSkeleton />
      </View>
    );
  } else if (planState.isError || !plan) {
    body = (
      <>
        {header}
        <PlanLoadError
          offline={isApiError(planState.error, 'offline')}
          retrying={planState.isFetching}
          onRetry={() => void planState.refetch()}
        />
      </>
    );
  } else if (plan.status === 'building') {
    body = (
      <>
        {header}
        <WeekStripLoading weekStart={currentWeek} today={today} />
        <BuildingHero answers={answers} />
      </>
    );
  } else if (plan.status === 'failed') {
    body = (
      <>
        {header}
        <BuildFailed
          message={plan.failure_message}
          answers={answers}
          retrying={build.isPending}
          retryFailed={build.isError}
          onRetry={buildPlan}
          onReviewAnswers={() => router.navigate('/you')}
        />
      </>
    );
  } else if (plan.status === 'none') {
    body = (
      <>
        {header}
        <NoPlanYet building={build.isPending} failed={build.isError} onBuild={buildPlan} />
      </>
    );
  } else {
    body = (
      <>
        {header}
        {recentChange ? (
          <PlanUpdated
            summary={recentChange.summary}
            when={changedWhen(recentChange.created_at, now)}
            onDismiss={dismissChange}
            onSeeChat={() => {
              dismissChange();
              openChat();
            }}
          />
        ) : null}
        <PlanWeekView
          plan={plan}
          today={today}
          weekStart={weekStart}
          day={day}
          week={week.data}
          weekError={
            week.isError
              ? {
                  offline: isApiError(week.error, 'offline'),
                  retrying: week.isFetching,
                  retry: () => void week.refetch(),
                }
              : null
          }
          nextWeek={nextWeek.data?.planned ? nextWeek.data : null}
          canNext={canNext}
          preferences={preferences.data}
          sports={sports.data}
          onSelect={select}
        />
      </>
    );
  }

  return <HomeShell refreshing={refreshing} onRefresh={refresh}>{body}</HomeShell>;
}

/** Content scrolls under the floating tab bar; pull to refresh refetches the plan. */
function HomeShell({ children, refreshing, onRefresh }: { children: ReactNode; refreshing: boolean; onRefresh: () => void }) {
  const { colors } = useTheme();
  const clearance = useBottomClearance();
  return (
    <Screen>
      <Content
        gap={20}
        bottomInset={clearance}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.textTertiary}
            colors={[colors.accent]}
            progressBackgroundColor={colors.surfaceCard}
          />
        }>
        {children}
      </Content>
    </Screen>
  );
}

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
