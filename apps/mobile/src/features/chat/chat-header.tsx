import { StyleSheet, View } from 'react-native';

import { BackButton, TopBar } from '@/components/layout';
import { Icon, IconButton, Text } from '@/components/ui';
import { useTheme } from '@/theme';

/** "Coach" over the plan's sport and week. Back returns to the tab chat opened over. */
export function ChatHeader({ sub, onBack, divided = false }: { sub: string | null; onBack: () => void; divided?: boolean }) {
  const { colors } = useTheme();
  return (
    <TopBar
      style={divided ? [styles.divided, { borderBottomColor: colors.borderSubtle }] : undefined}
      left={<BackButton onPress={onBack} />}
      title={
        <View style={styles.title}>
          <Text variant="subheading" accessibilityRole="header" numberOfLines={1}>
            Coach
          </Text>
          {sub ? (
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              {sub}
            </Text>
          ) : null}
        </View>
      }
    />
  );
}

/**
 * The dock's header (desktop web): the coach's mark as on the chat button,
 * "Coach" over the plan's sport and week, and close (Esc closes it too).
 */
export function DockHeader({ sub, onClose }: { sub: string | null; onClose: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.dock, { borderBottomColor: colors.borderSubtle }]}>
      <View aria-hidden style={[styles.mark, { backgroundColor: colors.surfaceInverse }]}>
        <Icon name="message-circle" size={18} strokeWidth={2} color={colors.textInverse} />
      </View>
      <View style={styles.dockTitle}>
        <Text variant="subheading" accessibilityRole="header" numberOfLines={1}>
          Coach
        </Text>
        {sub ? (
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>
      <IconButton icon="x" size="sm" accessibilityLabel="Close chat" onPress={onClose} />
    </View>
  );
}

const styles = StyleSheet.create({
  title: { flexShrink: 1, alignItems: 'center', gap: 2 },
  divided: { borderBottomWidth: 1 },
  dock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 68,
    paddingVertical: 12,
    paddingLeft: 20,
    paddingRight: 14,
    borderBottomWidth: 1,
  },
  mark: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  dockTitle: { flex: 1, minWidth: 0, gap: 1 },
});
