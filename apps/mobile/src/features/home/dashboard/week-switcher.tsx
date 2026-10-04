import { StyleSheet, View } from 'react-native';

import { Button, IconButton, Text } from '@/components/ui';
import { useTheme } from '@/theme';

export type WeekSwitcherProps = {
  /** "28 Sep – 4 Oct · this week" */
  label: string;
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
  /** Why › is off: "Next week is planned on Sunday" or "Plans go one week ahead". */
  nextHint: string;
  /** Away from this week, jumps back to it; off on this week. */
  onThisWeek: (() => void) | null;
};

/**
 * The page header's week control (the phone's WeekNav as one pill): ‹ goes back
 * through every past week to the first; › only to a week already planned, at
 * most one ahead. This week stays in place, off while on this week, and the
 * label keeps one width, so paging never moves the header. The arrow keys and
 * T do the same (useWeekKeys).
 */
export function WeekSwitcher({ label, onPrev, onNext, nextHint, onThisWeek }: WeekSwitcherProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Button
        variant="secondary"
        icon="calendar-check"
        disabled={!onThisWeek}
        onPress={onThisWeek ?? undefined}
        accessibilityHint="Shortcut: T">
        This week
      </Button>
      <View
        accessibilityRole="toolbar"
        accessibilityLabel="Week"
        style={[styles.pill, { borderColor: colors.borderStrong, backgroundColor: colors.surfaceCard }]}>
        <IconButton
          icon="chevron-left"
          size="sm"
          accessibilityLabel={onPrev ? 'Previous week' : 'No earlier weeks'}
          disabled={!onPrev}
          onPress={onPrev ?? undefined}
        />
        <Text variant="label" tabular numberOfLines={1} style={styles.label}>
          {label}
        </Text>
        <IconButton
          icon="chevron-right"
          size="sm"
          accessibilityLabel={onNext ? 'Next week' : nextHint}
          disabled={!onNext}
          onPress={onNext ?? undefined}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    paddingHorizontal: 5,
    gap: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  label: { width: 188, textAlign: 'center' },
});
