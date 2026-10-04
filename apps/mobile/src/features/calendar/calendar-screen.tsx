import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { usePlanState } from '@/api/hooks';
import { Col, Content, H1, Kicker, Row, Screen, useLayout } from '@/components/layout';
import { IconButton, Skeleton, Text } from '@/components/ui';
import { useNow } from '@/lib/clock';
import { formatLongDate, formatMonthYear, toLocalDate } from '@/lib/dates';
import { useBottomClearance } from '@/navigation/bottom-clearance';
import { routes } from '@/navigation/routes';

import { Agenda } from './agenda';
import { CalendarDesktopScreen } from './calendar-desktop';
import { headerKicker } from './calendar-labels';
import { Legend, MonthGrid } from './month-grid';
import { NoPlanYet } from './no-plan-yet';
import { PlanHistorySection } from './plan-history-section';
import { PrivacyNote } from './privacy-note';
import { LoadError } from './states';
import { type CalendarBounds, useCalendarMonth } from './use-calendar-month';

/**
 * 10 — Calendar: a month of sessions only, the selected day, and the plan
 * version in use. The desktop web lays the same out as a board beside the day.
 */
export function CalendarScreen() {
  const { isDesktop } = useLayout();
  return isDesktop ? <CalendarDesktopScreen /> : <PhoneCalendarScreen />;
}

function PhoneCalendarScreen() {
  const plan = usePlanState();
  const router = useRouter();
  const today = toLocalDate(useNow());
  const clearance = useBottomClearance();
  const firstWeekStart = plan.data?.first_week_start ?? null;
  const plannedThrough = plan.data?.planned_through ?? null;

  let body: ReactNode;
  if (plan.isPending) {
    body = <CalendarSkeleton />;
  } else if (plan.isError) {
    body = <LoadError title="Calendar won't load." onRetry={() => void plan.refetch()} retrying={plan.isFetching} />;
  } else if (!firstWeekStart || !plannedThrough) {
    body = <NoPlanYet status={plan.data.status} onToday={() => router.navigate(routes.today())} />;
  } else {
    body = <CalendarBody today={today} firstWeekStart={firstWeekStart} plannedThrough={plannedThrough} />;
  }

  return (
    <Screen>
      <Content gap={20} bottomInset={clearance}>
        <Col gap={4} style={styles.header}>
          <Kicker>{headerKicker(today, firstWeekStart)}</Kicker>
          <H1>Calendar</H1>
        </Col>
        {body}
      </Content>
    </Screen>
  );
}

function CalendarBody({ today, firstWeekStart, plannedThrough }: CalendarBounds) {
  const calendar = useCalendarMonth({ today, firstWeekStart, plannedThrough });
  const { month, selected, days, range, previous, next, canGoBack, canGoForward } = calendar;

  return (
    <>
      <Col gap={10}>
        <Row gap={2} style={styles.monthBar}>
          <Text variant="section" style={styles.monthLabel}>
            {formatMonthYear(month)}
          </Text>
          <IconButton
            icon="chevron-left"
            size="sm"
            accessibilityLabel={canGoBack ? `Previous month, ${formatMonthYear(previous)}` : 'No earlier sessions'}
            disabled={!canGoBack}
            onPress={() => calendar.showMonth(previous)}
          />
          <IconButton
            icon="chevron-right"
            size="sm"
            accessibilityLabel={
              canGoForward ? `Next month, ${formatMonthYear(next)}` : `Planned up to ${formatLongDate(plannedThrough)}`
            }
            disabled={!canGoForward}
            onPress={() => calendar.showMonth(next)}
          />
        </Row>
        <MonthGrid
          month={month}
          days={days}
          today={today}
          plannedThrough={plannedThrough}
          selected={selected}
          onSelect={calendar.select}
        />
        <Legend />
      </Col>
      {range.isError ? (
        <LoadError title="Sessions won't load." onRetry={() => void range.refetch()} retrying={range.isFetching} />
      ) : (
        <Agenda
          date={selected}
          items={days ? (days.get(selected) ?? []) : undefined}
          today={today}
          firstWeekStart={firstWeekStart}
          plannedThrough={plannedThrough}
        />
      )}
      <PrivacyNote />
      <PlanHistorySection />
    </>
  );
}

/** First load: the shapes of the loaded screen, so nothing jumps. */
function CalendarSkeleton() {
  return (
    <View accessible accessibilityLabel="Loading your calendar" style={styles.skeleton}>
      <Col gap={10}>
        <Row style={styles.monthBar}>
          <Skeleton width={140} height={20} />
        </Row>
        <Skeleton height={14} />
        {[0, 1, 2, 3, 4].map((week) => (
          <Skeleton key={week} height={44} radius={12} />
        ))}
      </Col>
      <Skeleton height={112} radius={24} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { minWidth: 0 },
  monthBar: { marginRight: -6, minHeight: 36 },
  monthLabel: { flex: 1 },
  skeleton: { gap: 20 },
});
