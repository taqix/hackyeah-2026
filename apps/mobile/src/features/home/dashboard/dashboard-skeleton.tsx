/**
 * The dashboard while it loads (5.12) or the first plan builds (5.7): shapes
 * that match the loaded page, so nothing jumps when it arrives. Pulses stop
 * under reduced motion (Skeleton).
 */
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { LocalDate } from '@/api/types';
import { Skeleton, Text } from '@/components/ui';
import { formatDayShort, fromLocalDate, weekDates } from '@/lib/dates';
import { useTheme } from '@/theme';

import { LARGE_HERO } from '../hero/hero-size';

/** The page header: date, greeting, the week's line. */
export function PageHeaderSkeleton() {
  return (
    <View style={styles.header}>
      <Skeleton width={210} height={14} />
      <Skeleton width={340} height={38} radius={10} />
      <Skeleton width={300} height={16} />
    </View>
  );
}

export function HeroSkeleton() {
  return <Skeleton height={LARGE_HERO.minHeight} radius={32} />;
}

/**
 * The board's seven days with their dates, the sessions still to come. Also
 * stands for the first week while it is built, so it names the days.
 */
export function BoardSkeleton({ weekStart, today, label }: { weekStart: LocalDate; today: LocalDate; label: string }) {
  const { colors, radius } = useTheme();
  return (
    <View accessible accessibilityLabel={label} style={styles.board}>
      <Skeleton width={120} height={18} />
      <View style={styles.columns}>
        {weekDates(weekStart).map((date, i) => (
          <View
            key={date}
            style={[
              styles.column,
              {
                borderRadius: radius.md,
                backgroundColor: colors.surfaceCard,
                borderColor: date === today ? colors.accent : colors.borderSubtle,
              },
            ]}>
            <Text variant="caption" tone={date === today ? 'accent' : 'tertiary'}>
              {date === today ? 'Today' : formatDayShort(date)}
            </Text>
            <View style={[styles.disc, { backgroundColor: colors.surfaceSunken }]}>
              <Text variant="numeric" tone="tertiary" tabular style={styles.discText}>
                {fromLocalDate(date).getDate()}
              </Text>
            </View>
            {i % 2 === 0 ? <Skeleton height={64} radius={12} /> : null}
          </View>
        ))}
      </View>
    </View>
  );
}

/** The side column's cards (progress, then two shorter ones), as separate cards for the layout to place. */
export function sideSkeletons(): ReactNode[] {
  return [168, 132, 120].map((height) => <Skeleton key={height} height={height} radius={24} />);
}

const styles = StyleSheet.create({
  header: { gap: 10, paddingTop: 2 },
  board: { gap: 14 },
  columns: { flexDirection: 'row', gap: 8 },
  column: {
    flex: 1,
    minWidth: 0,
    minHeight: 228,
    alignItems: 'center',
    gap: 8,
    paddingTop: 12,
    paddingHorizontal: 6,
    borderWidth: 1,
  },
  disc: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  discText: { fontSize: 16, lineHeight: 19, letterSpacing: 0 },
});
