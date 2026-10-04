import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme';

/** Calm full-screen wait while the gate or a guarded layout reads the session. */
export function GateLoading() {
  const { colors } = useTheme();
  return (
    <View style={[styles.screen, { backgroundColor: colors.bgApp }]}>
      <ActivityIndicator size="small" color={colors.textTertiary} accessibilityLabel="Loading" />
    </View>
  );
}

/** Full-screen error with Try again, for the gate and guarded layouts. */
export function GateError({ onRetry }: { onRetry: () => void }) {
  const theme = useTheme();
  const { colors } = theme;
  return (
    <View style={[styles.screen, { backgroundColor: colors.bgApp, padding: theme.layout.gutter }]}>
      <View accessibilityRole="alert" style={styles.message}>
        <Text variant="heading" align="center">
          We couldn&apos;t load your account
        </Text>
        <Text variant="bodySm" align="center">
          Check your connection, then try again.
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={onRetry}
        style={({ pressed }) => [
          styles.button,
          { borderColor: colors.borderStrong, backgroundColor: colors.surfaceCard },
          pressed && { transform: [{ scale: theme.motion.pressScale }] },
        ]}>
        <Text variant="label">Try again</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  message: {
    gap: 8,
    maxWidth: 320,
  },
  button: {
    minHeight: 44,
    paddingHorizontal: 20,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
