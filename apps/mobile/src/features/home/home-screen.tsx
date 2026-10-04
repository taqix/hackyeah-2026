import type { ReactNode } from 'react';
import { View } from 'react-native';
import { RefreshControl } from 'react-native-gesture-handler';

import { isApiError } from '@/api/types';
import { Col, Content, Screen, useLayout } from '@/components/layout';
import { Skeleton } from '@/components/ui';
import { useBottomClearance } from '@/navigation/bottom-clearance';
import { useTheme } from '@/theme';

import { HomeDashboard } from './dashboard/home-dashboard';
import { HomeHeader } from './home-header';
import { changedWhen } from './home-model';
import { PlanUpdated } from './plan-updated';
import {
  BuildFailed,
  BuildingHero,
  HeaderSkeleton,
  NoPlanYet,
  PlanLoadError,
  PlanNote,
  WeekSkeleton,
} from './plan-states';
import { PlanWeekView } from './plan-week';
import { useHome } from './use-home';
import { WeekStripLoading } from './week-strip';

/**
 * The Today tab (5): what do I do today, and how is my week going? Phones get
 * the design's single column; the desktop web gets the dashboard.
 */
export function HomeScreen() {
  const home = useHome();
  const { isDesktop } = useLayout();
  if (isDesktop) return <HomeDashboard home={home} />;

  const {
    now,
    today,
    currentWeek,
    kicker,
    name,
    answers,
    planState,
    plan,
    weekStart,
    day,
    week,
    nextWeek,
    canNext,
    build,
    buildPlan,
    recentChange,
    dismissChange,
    openChat,
    reviewAnswers,
    preferences,
    sports,
    refreshing,
    refresh,
    select,
  } = home;
  const header = <HomeHeader kicker={kicker} name={name} now={now} />;

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
          unavailable={plan.failure_code === 'ai_unavailable'}
          answers={answers}
          retrying={build.isPending}
          retryFailed={build.isError}
          onRetry={buildPlan}
          onReviewAnswers={reviewAnswers}
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
        {plan.failure_message ? <PlanNote message={plan.failure_message} /> : null}
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
          preferences={preferences}
          sports={sports}
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
