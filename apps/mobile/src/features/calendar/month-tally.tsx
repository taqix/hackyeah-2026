import { StyleSheet, View } from 'react-native';

import type { LocalDate } from '@/api/types';
import { Text } from '@/components/ui';
import { formatMonthYear } from '@/lib/dates';
import { useTheme } from '@/theme';

import { type DayItem, markState, type MarkState } from './day-items';
import { isInMonth } from './month';
import { Mark } from './month-grid';

type Counts = { done: number; planned: number; missed: number };

function countMonth(days: Map<LocalDate, DayItem[]>, month: LocalDate, today: LocalDate): Counts {
  const counts = { done: 0, planned: 0, missed: 0 };
  days.forEach((items, date) => {
    // While the next month loads, the map still holds the last one.
    if (!isInMonth(date, month)) return;
    for (const item of items) {
      const state = markState(item, today);
      if (state === 'done') counts.done += 1;
      else if (state === 'planned') counts.planned += 1;
      else counts.missed += 1;
    }
  });
  return counts;
}

type MonthTallyProps = {
  month: LocalDate;
  /** Sessions and extras by day; undefined while they load. */
  days: Map<LocalDate, DayItem[]> | undefined;
  today: LocalDate;
};

/** The legend with the month's counts beside each mark (desktop). */
export function MonthTally({ month, days, today }: MonthTallyProps) {
  const counts = days ? countMonth(days, month, today) : null;
  const label = counts
    ? `${formatMonthYear(month)}: ${counts.done} done, ${counts.planned} planned, ${counts.missed} skipped or not logged`
    : undefined;
  return (
    <View accessible={!!counts} accessibilityLabel={label} style={styles.tally}>
      <Item state="done" label="Done" count={counts?.done} />
      <Item state="planned" label="Planned" count={counts?.planned} />
      <Item state="skipped" label="Skipped or not logged" count={counts?.missed} />
    </View>
  );
}

function Item({ state, label, count }: { state: MarkState; label: string; count: number | undefined }) {
  const { fontFamily } = useTheme();
  return (
    <View style={styles.item}>
      <Mark state={state} size={8} />
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
      {count === undefined ? null : (
        <Text variant="caption" tone="primary" tabular style={{ fontFamily: fontFamily.bodySemibold }}>
          {count}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tally: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 20, rowGap: 6 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
