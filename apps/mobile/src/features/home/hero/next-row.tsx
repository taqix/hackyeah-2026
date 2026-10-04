import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import type { LocalDate, PlannedSession } from '@/api/types';
import { Icon, PressableScale, Text } from '@/components/ui';
import { formatMinutes, formatTime, relativeDayName } from '@/lib/dates';
import { sessionLocalDate, sessionMinutes, sessionStart } from '@/lib/sessions';
import { routes } from '@/navigation/routes';
import { useTheme } from '@/theme';

/** "Next · Friday 18:00 / Walk-run intervals · 20 min": opens the session. */
export function NextRow({ session, today }: { session: PlannedSession; today: LocalDate }) {
  const router = useRouter();
  const { colors, motion } = useTheme();
  const day = relativeDayName(sessionLocalDate(session), today);
  const time = formatTime(sessionStart(session));
  const length = formatMinutes(sessionMinutes(session));

  return (
    <PressableScale
      onPress={() => router.push(routes.session(session.id))}
      scaleTo={motion.pressScaleCard}
      accessibilityRole="button"
      accessibilityLabel={`Next: ${session.title}, ${day} ${time}, ${length}`}
      style={[styles.row, { borderTopColor: colors.hairlineOnTint }]}>
      <View style={styles.text}>
        <Text variant="caption" tone="secondary" tabular>
          {`Next · ${day} ${time}`}
        </Text>
        <Text variant="bodyStrong" style={styles.title}>
          {session.title}
          <Text variant="body" tone="secondary" style={styles.title}>
            {` · ${length}`}
          </Text>
        </Text>
      </View>
      <Icon name="chevron-right" size={18} color={colors.textSecondary} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    marginTop: 6,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  text: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: 16, lineHeight: 21 },
});
