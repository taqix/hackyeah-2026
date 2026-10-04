import { useRouter } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { usePlanState, usePlanVersions, useSessionsInRange } from '@/api/hooks';
import type { LocalDate, PlanStatus } from '@/api/types';
import { Col, Content, H1, Kicker, Row, Screen, Section } from '@/components/layout';
import { Icon, IconButton, Skeleton, Text } from '@/components/ui';
import { useNow } from '@/lib/clock';
import { diffDays, formatDayLong, formatLongDate, formatMonthYear, fromLocalDate, MONTHS_LONG, startOfWeek, toLocalDate } from '@/lib/dates';
import { useBottomClearance } from '@/navigation/bottom-clearance';
import { routes } from '@/navigation/routes';
import { useTheme } from '@/theme';

import { Agenda } from './agenda';
import { groupByDay } from './day-items';
import { addMonths, clampMonth, dayOfMonth, isInMonth, monthEnd, monthOf } from './month';
import { Legend, MonthGrid } from './month-grid';
import { EmptyState, LoadError } from './states';
import { VersionEntry } from './version-entry';

/** 10 — Calendar: a month of sessions only, the selected day, and the plan version in use. */
export function CalendarScreen() {
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

/** "Wednesday, 21 October · Week 3" */
function headerKicker(today: LocalDate, firstWeekStart: LocalDate | null): string {
  const date = `${formatDayLong(today)}, ${dayOfMonth(today)} ${MONTHS_LONG[fromLocalDate(today).getMonth()]}`;
  if (!firstWeekStart || today < firstWeekStart) return date;
  const week = Math.floor(diffDays(firstWeekStart, startOfWeek(today)) / 7) + 1;
  return `${date} · Week ${week}`;
}

type CalendarBodyProps = { today: LocalDate; firstWeekStart: LocalDate; plannedThrough: LocalDate };

function CalendarBody({ today, firstWeekStart, plannedThrough }: CalendarBodyProps) {
  const { colors } = useTheme();
  // The month pages back to the first week and stops at the last planned day.
  const minMonth = monthOf(firstWeekStart);
  const maxMonth = monthOf(plannedThrough) < minMonth ? minMonth : monthOf(plannedThrough);
  const [pickedMonth, setPickedMonth] = useState<LocalDate | null>(null);
  const [pickedDay, setPickedDay] = useState<LocalDate | null>(null);
  const month = clampMonth(pickedMonth ?? monthOf(today), minMonth, maxMonth);
  const selected = pickedDay && isInMonth(pickedDay, month) ? pickedDay : defaultDay(month, today, firstWeekStart);

  const range = useSessionsInRange(month, monthEnd(month));
  const days = range.data ? groupByDay(range.data.sessions, range.data.extras) : undefined;
  const canGoBack = month > minMonth;
  const canGoForward = month < maxMonth;
  const previous = addMonths(month, -1);
  const next = addMonths(month, 1);

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
            onPress={() => setPickedMonth(previous)}
          />
          <IconButton
            icon="chevron-right"
            size="sm"
            accessibilityLabel={
              canGoForward ? `Next month, ${formatMonthYear(next)}` : `Planned up to ${formatLongDate(plannedThrough)}`
            }
            disabled={!canGoForward}
            onPress={() => setPickedMonth(next)}
          />
        </Row>
        <MonthGrid
          month={month}
          days={days}
          today={today}
          plannedThrough={plannedThrough}
          selected={selected}
          onSelect={setPickedDay}
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
      <Row gap={10} style={styles.privacy}>
        <View style={styles.privacyIcon}>
          <Icon name="eye-off" size={16} color={colors.textSecondary} />
        </View>
        <Text variant="bodySm" style={styles.privacyText}>
          Only your sessions show here. We read when you&apos;re busy, never what&apos;s in your calendar. Plans go one
          week ahead.
        </Text>
      </Row>
      <PlanHistorySection />
    </>
  );
}

/** Today in its month; an earlier month opens on its first day of the plan, a later one on the 1st. */
function defaultDay(month: LocalDate, today: LocalDate, firstWeekStart: LocalDate): LocalDate {
  if (isInMonth(today, month)) return today;
  if (isInMonth(firstWeekStart, month)) return firstWeekStart;
  return month;
}

/** The version in use, with a link to every version (10.1). */
function PlanHistorySection() {
  const router = useRouter();
  const versions = usePlanVersions();

  if (versions.isPending) {
    return (
      <Col gap={14} style={styles.history}>
        <Skeleton width={120} height={18} />
        <Row gap={14} style={styles.historySkeleton}>
          <Skeleton width={32} height={32} radius={16} />
          <Col gap={8} style={styles.grow}>
            <Skeleton width="40%" height={14} />
            <Skeleton width="56%" height={10} />
            <Skeleton width="90%" height={12} />
          </Col>
        </Row>
      </Col>
    );
  }
  if (versions.isError) {
    return (
      <Col gap={14} style={styles.history}>
        <Section>Plan history</Section>
        <LoadError
          title="Plan history won't load."
          onRetry={() => void versions.refetch()}
          retrying={versions.isFetching}
          quiet
        />
      </Col>
    );
  }
  const list = versions.data;
  const inUse = list.find((v) => v.active) ?? list[0];
  if (!inUse) return null;

  return (
    <Col gap={14} style={styles.history}>
      <View style={styles.historyHeader}>
        <Section>Plan history</Section>
        <Text variant="caption" tabular>
          {list.length} {list.length === 1 ? 'version' : 'versions'}
        </Text>
      </View>
      <VersionEntry
        version={inUse}
        last
        action={{
          label: 'See every version',
          hint: 'Opens the plan history',
          onPress: () => router.push('/plan-history'),
        }}
      />
    </Col>
  );
}

function NoPlanYet({ status, onToday }: { status: PlanStatus; onToday: () => void }) {
  const action = { label: 'Go to Today', onPress: onToday };
  if (status === 'building') {
    return (
      <EmptyState
        icon="calendar-clock"
        title="Your first plan is on its way."
        body="Its sessions show here once it's ready. This takes about a minute."
        action={action}
      />
    );
  }
  return (
    <EmptyState
      icon="calendar-days"
      title="No sessions yet."
      body="Your sessions show here once your first plan is ready. Plans go one week ahead."
      action={action}
    />
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
  privacy: { alignItems: 'flex-start' },
  privacyIcon: { marginTop: 2 },
  privacyText: { flex: 1 },
  history: { marginTop: 8 },
  historyHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  historySkeleton: { alignItems: 'flex-start' },
  grow: { flex: 1 },
  skeleton: { gap: 20 },
});
