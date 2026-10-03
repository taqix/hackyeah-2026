import { StyleSheet, View } from 'react-native';

import type { LocalDate } from '@/api/types';
import { PressableScale, Text } from '@/components/ui';
import { WEEKDAYS_SHORT } from '@/lib/dates';
import { useTheme } from '@/theme';

import { dayAccessibilityLabel, type DayItem, markState, type MarkState } from './day-items';
import { dayOfMonth, isInMonth, monthWeeks } from './month';

/** Most marks one date shows; the day's label still names every session. */
const MAX_MARKS = 4;

/** Decorative: each day's label already says it in words. aria-hidden works on iOS, Android and web. */
const hidden = { 'aria-hidden': true } as const;

/** One session under its date: done is filled, planned is the accent, skipped is a hollow ring. */
export function Mark({ state, size = 6 }: { state: MarkState; size?: number }) {
  const { colors } = useTheme();
  const look =
    state === 'done'
      ? { backgroundColor: colors.success }
      : state === 'planned'
        ? { backgroundColor: colors.accent }
        : { borderWidth: 1.5, borderColor: colors.textTertiary };
  return <View style={[{ width: size, height: size, borderRadius: size / 2 }, look]} />;
}

export function Legend() {
  const item = (state: MarkState, label: string) => (
    <View style={styles.legendItem}>
      <Mark state={state} size={8} />
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
    </View>
  );
  return (
    <View style={styles.legend} {...hidden}>
      {item('done', 'Done')}
      {item('planned', 'Planned')}
      {item('skipped', 'Skipped')}
    </View>
  );
}

type MonthGridProps = {
  month: LocalDate;
  /** Sessions and extras by day; undefined while they load. */
  days: Map<LocalDate, DayItem[]> | undefined;
  today: LocalDate;
  plannedThrough: LocalDate;
  selected: LocalDate;
  onSelect: (date: LocalDate) => void;
};

/** A plain Monday-first seven-column month; other months' days are muted and not buttons. */
export function MonthGrid({ month, days, today, plannedThrough, selected, onSelect }: MonthGridProps) {
  return (
    <View>
      <View style={[styles.week, styles.weekdays]} {...hidden}>
        {WEEKDAYS_SHORT.map((weekday, i) => (
          <Text key={i} variant="caption" align="center" style={styles.cell}>
            {weekday.charAt(0)}
          </Text>
        ))}
      </View>
      <View style={styles.weeks}>
        {monthWeeks(month).map((week) => (
          <View key={week[0]} style={styles.week}>
            {week.map((date) =>
              isInMonth(date, month) ? (
                <DayCell
                  key={date}
                  date={date}
                  items={days ? (days.get(date) ?? []) : undefined}
                  today={today}
                  plannedThrough={plannedThrough}
                  selected={date === selected}
                  onSelect={onSelect}
                />
              ) : (
                <OutsideDay key={date} date={date} />
              ),
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

function OutsideDay({ date }: { date: LocalDate }) {
  return (
    <View style={[styles.cell, styles.day]} {...hidden}>
      <View style={styles.number}>
        <Text variant="numeric" tone="tertiary" tabular style={[styles.numberText, styles.outside]}>
          {dayOfMonth(date)}
        </Text>
      </View>
    </View>
  );
}

type DayCellProps = {
  date: LocalDate;
  items: DayItem[] | undefined;
  today: LocalDate;
  plannedThrough: LocalDate;
  selected: boolean;
  onSelect: (date: LocalDate) => void;
};

function DayCell({ date, items, today, plannedThrough, selected, onSelect }: DayCellProps) {
  const { colors } = useTheme();
  const isToday = date === today;
  // Plans go one week ahead: nothing to show, or pick, past the last planned day.
  const ahead = date > plannedThrough && !isToday;
  const ring = selected && !isToday;

  return (
    <PressableScale
      onPress={() => onSelect(date)}
      disabled={ahead}
      accessibilityRole="button"
      accessibilityLabel={dayAccessibilityLabel(date, items, { today, plannedThrough })}
      aria-selected={selected} aria-disabled={ahead}
      style={[styles.cell, styles.day]}>
      <View
        style={[
          styles.number,
          isToday && { backgroundColor: colors.surfaceInverse },
          ring && { borderWidth: 2, borderColor: colors.textPrimary },
          ahead && styles.ahead,
        ]}>
        <Text
          variant="numeric"
          tone={isToday ? 'inverse' : ahead ? 'tertiary' : 'primary'}
          tabular
          style={styles.numberText}>
          {dayOfMonth(date)}
        </Text>
      </View>
      <View style={styles.marks}>
        {(items ?? []).slice(0, MAX_MARKS).map((item) => (
          <Mark key={item.key} state={markState(item)} />
        ))}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  weekdays: { marginBottom: 4 },
  weeks: { gap: 2 },
  week: { flexDirection: 'row' },
  cell: { flex: 1, minWidth: 0 },
  day: { height: 52, alignItems: 'center', gap: 5, paddingTop: 2 },
  number: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  numberText: { fontSize: 15, lineHeight: 18 },
  outside: { opacity: 0.45 },
  ahead: { opacity: 0.55 },
  marks: { flexDirection: 'row', gap: 3, height: 6 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
