import { StyleSheet, View } from 'react-native';

import { Row } from '@/components/layout';
import { Icon, Text } from '@/components/ui';
import { diffDays, formatDayDate, relativeDayName, toLocalDate } from '@/lib/dates';
import { useTheme } from '@/theme';

/** 'Today', 'Tomorrow', 'Friday' within the week around today; 'Fri 18 Sep' further away. */
export function dayLabel(start: Date, today: Date): string {
  const days = diffDays(toLocalDate(today), toLocalDate(start));
  return Math.abs(days) < 7 ? relativeDayName(start, today) : formatDayDate(start);
}

/** A small line with an icon under the plan: the watch note, or how the gym rows work. */
export function Note({ icon, children }: { icon: 'watch' | 'info'; children: string }) {
  const { colors } = useTheme();
  return (
    <Row gap={10} style={styles.note}>
      <View style={styles.noteIcon}>
        <Icon name={icon} size={16} color={colors.textSecondary} />
      </View>
      <Text variant="bodySm" style={styles.noteText}>
        {children}
      </Text>
    </Row>
  );
}

const styles = StyleSheet.create({
  note: { alignItems: 'flex-start' },
  noteIcon: { marginTop: 2 },
  noteText: { flex: 1 },
});
