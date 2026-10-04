import { useRouter } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { usePlanState } from '@/api/hooks';
import type { LocalDate } from '@/api/types';
import { Content, PageHeader, Screen } from '@/components/layout';
import { Button, Card, IconButton, Skeleton } from '@/components/ui';
import { webStyle } from '@/components/ui/web-style';
import { useNow } from '@/lib/clock';
import { formatLongDate, formatMonthYear, toLocalDate } from '@/lib/dates';
import { routes } from '@/navigation/routes';

import { headerKicker } from './calendar-labels';
import { DayDetail } from './day-detail';
import { entrance } from './entrance';
import { KeyHints } from './key-hints';
import { isInMonth } from './month';
import { type BoardDensity, MonthBoard } from './month-board';
import { MonthTally } from './month-tally';
import { NoPlanYet } from './no-plan-yet';
import { PlanHistorySection } from './plan-history-section';
import { PrivacyNote } from './privacy-note';
import { LoadError } from './states';
import { type CalendarBounds, useCalendarMonth } from './use-calendar-month';
import { useCalendarShortcuts } from './use-calendar-shortcuts';
import { usePageWidth } from './use-page-width';

/** Content at least this wide shows the selected day beside the month; narrower, under it. */
const SIDE_MIN = 820;
/** From here the day column gets roomier. */
const SIDE_ROOMY_MIN = 1016;
const COLUMN_GAP = 28;
/** Tiles narrower than this show each session's sport only. */
const ROOMY_TILE_MIN = 84;

/** The day column sticks below the top of the page while the month scrolls past (web only). */
const sticky = webStyle({ position: 'sticky', top: 24 });

/**
 * How the page arranges itself at this content width: the day column's width
 * (0 when the day goes under the month) and the tiles. Under the month, the
 * tiles stay compact so the picked day shows without scrolling.
 */
function arrange(width: number): { side: number; density: BoardDensity } {
  const side = width >= SIDE_MIN ? (width >= SIDE_ROOMY_MIN ? 340 : 296) : 0;
  // Seven tiles with six 6-point gaps between them.
  const tile = (width - side - COLUMN_GAP - 36) / 7;
  return { side, density: side && tile >= ROOMY_TILE_MIN ? 'roomy' : 'compact' };
}

/**
 * 10 on the desktop web: the month as a board of day tiles beside the
 * selected day, with the month and year as the page title. Paging, Today and
 * the keyboard (arrows between days, T, P and N) move around it.
 */
export function CalendarDesktopScreen() {
  const plan = usePlanState();
  const router = useRouter();
  const today = toLocalDate(useNow());
  const page = usePageWidth();
  const firstWeekStart = plan.data?.first_week_start ?? null;
  const plannedThrough = plan.data?.planned_through ?? null;
  const kicker = headerKicker(today, firstWeekStart);

  let body: ReactNode;
  if (plan.isPending) {
    body = (
      <>
        <PageHeader kicker={kicker} title="Calendar" />
        <DesktopSkeleton side={arrange(page.width).side} />
      </>
    );
  } else if (plan.isError || !firstWeekStart || !plannedThrough) {
    body = (
      <>
        <PageHeader kicker={kicker} title="Calendar" />
        <View style={styles.notice}>
          {plan.isError ? (
            <LoadError title="Calendar won't load." onRetry={() => void plan.refetch()} retrying={plan.isFetching} />
          ) : (
            <NoPlanYet status={plan.data.status} onToday={() => router.navigate(routes.today())} />
          )}
        </View>
      </>
    );
  } else {
    body = (
      <DesktopCalendar
        today={today}
        firstWeekStart={firstWeekStart}
        plannedThrough={plannedThrough}
        kicker={kicker}
        width={page.width}
      />
    );
  }

  return (
    <Screen>
      <Content gap={28} onLayout={page.onLayout}>
        {body}
      </Content>
    </Screen>
  );
}

type DesktopCalendarProps = CalendarBounds & { kicker: string; width: number };

function DesktopCalendar({ today, firstWeekStart, plannedThrough, kicker, width }: DesktopCalendarProps) {
  const reduced = useReducedMotion();
  const calendar = useCalendarMonth({ today, firstWeekStart, plannedThrough });
  const { month, selected, days, range } = calendar;
  // Which side a new month slides in from.
  const [direction, setDirection] = useState<1 | -1>(1);
  const { side, density } = arrange(width);

  const showMonth = (target: LocalDate) => {
    setDirection(target > month ? 1 : -1);
    calendar.showMonth(target);
  };
  /** Picks a day, in another month too; false for a day past the plan or outside the months on offer. */
  const showDay = (date: LocalDate) => {
    if (date > plannedThrough && date !== today) return false;
    if (!isInMonth(date, month)) setDirection(date > month ? 1 : -1);
    return calendar.showDay(date);
  };
  const toPrevious = () => {
    if (calendar.canGoBack) showMonth(calendar.previous);
  };
  const toNext = () => {
    if (calendar.canGoForward) showMonth(calendar.next);
  };
  const toToday = () => void showDay(today);
  useCalendarShortcuts({ today: toToday, previousMonth: toPrevious, nextMonth: toNext });

  const board = (
    <View style={styles.boardBlock}>
      <MonthBoard
        month={month}
        days={days}
        today={today}
        plannedThrough={plannedThrough}
        selected={selected}
        onSelect={calendar.select}
        onKeyPick={showDay}
        direction={direction}
        density={density}
      />
      <View style={styles.legendRow}>
        <MonthTally month={month} days={days} today={today} />
        {side ? <KeyHints /> : null}
      </View>
    </View>
  );
  const day = range.isError ? (
    <LoadError title="Sessions won't load." onRetry={() => void range.refetch()} retrying={range.isFetching} />
  ) : (
    <DayDetail
      date={selected}
      items={days ? (days.get(selected) ?? []) : undefined}
      today={today}
      firstWeekStart={firstWeekStart}
      plannedThrough={plannedThrough}
    />
  );
  const history = (
    <Card style={styles.history}>
      <PlanHistorySection style={styles.historySection} />
    </Card>
  );

  return (
    <>
      <PageHeader
        kicker={kicker}
        title={formatMonthYear(month)}
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              icon="calendar-check"
              accessibilityLabel={`Today, ${formatLongDate(today)}`}
              onPress={toToday}>
              Today
            </Button>
            <IconButton
              icon="chevron-left"
              variant="secondary"
              size="sm"
              accessibilityLabel={
                calendar.canGoBack ? `Previous month, ${formatMonthYear(calendar.previous)}` : 'No earlier sessions'
              }
              disabled={!calendar.canGoBack}
              onPress={toPrevious}
            />
            <IconButton
              icon="chevron-right"
              variant="secondary"
              size="sm"
              accessibilityLabel={
                calendar.canGoForward
                  ? `Next month, ${formatMonthYear(calendar.next)}`
                  : `Planned up to ${formatLongDate(plannedThrough)}`
              }
              disabled={!calendar.canGoForward}
              onPress={toNext}
            />
          </>
        }
      />
      {side ? (
        <View style={[styles.split, { gap: COLUMN_GAP }]}>
          <Animated.View style={[styles.main, entrance(1, reduced)]}>
            {board}
            <PrivacyNote />
            {history}
          </Animated.View>
          <View style={{ width: side }}>
            <Animated.View style={[sticky, entrance(2, reduced)]}>
              {day}
            </Animated.View>
          </View>
        </View>
      ) : (
        <Animated.View style={[styles.stack, entrance(1, reduced)]}>
          {board}
          {day}
          <PrivacyNote />
          {history}
        </Animated.View>
      )}
    </>
  );
}

/** First load: the board's tiles and the day column, so nothing jumps. */
function DesktopSkeleton({ side }: { side: number }) {
  return (
    <View accessible accessibilityLabel="Loading your calendar" style={[styles.split, { gap: COLUMN_GAP }]}>
      <View style={[styles.main, styles.skeletonWeeks]}>
        <Skeleton width={180} height={14} />
        {[0, 1, 2, 3, 4].map((week) => (
          <View key={week} style={styles.skeletonWeek}>
            {[0, 1, 2, 3, 4, 5, 6].map((tile) => (
              <Skeleton key={tile} height={96} radius={12} style={styles.skeletonTile} />
            ))}
          </View>
        ))}
      </View>
      {side ? <Skeleton width={side} height={220} radius={24} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  notice: { maxWidth: 640 },
  split: { flexDirection: 'row', alignItems: 'stretch' },
  main: { flex: 1, minWidth: 0, gap: 24 },
  stack: { gap: 24 },
  boardBlock: { gap: 16 },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 24,
    rowGap: 10,
  },
  history: { padding: 24 },
  historySection: { marginTop: 0 },
  skeletonWeeks: { gap: 6 },
  skeletonWeek: { flexDirection: 'row', gap: 6 },
  skeletonTile: { flex: 1, width: 'auto' },
});
