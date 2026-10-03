import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { BackButton, Screen, TopBar } from '@/components/layout';
import { Button, Spinner, Text } from '@/components/ui';
import { isApiError } from '@/api/types';
import { useTheme } from '@/theme';

/** Calm wait while a workout screen reads its session. */
export function WorkoutLoading() {
  const { colors } = useTheme();
  return (
    <Screen>
      <TopBar left={<BackButton />} />
      <View style={styles.center}>
        <Spinner color={colors.textTertiary} />
      </View>
    </Screen>
  );
}

/**
 * A failed read: "not found" sends the person back to Today; anything else
 * offers Try again.
 */
export function WorkoutError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const router = useRouter();
  const { layout } = useTheme();
  const gone = isApiError(error, 'not_found');
  return (
    <Screen>
      <TopBar left={<BackButton />} />
      <View style={[styles.center, { paddingHorizontal: layout.gutter }]}>
        <View accessibilityRole="alert" style={styles.message}>
          <Text variant="heading" align="center">
            {gone ? 'This session is no longer in your plan' : "We couldn't load this session"}
          </Text>
          <Text variant="bodySm" align="center">
            {gone ? 'Your plan may have changed since you opened it.' : 'Check your connection, then try again.'}
          </Text>
        </View>
        {gone ? (
          <Button variant="secondary" onPress={() => router.replace('/(tabs)')}>
            Back to today
          </Button>
        ) : (
          <Button variant="secondary" icon="refresh-cw" onPress={onRetry}>
            Try again
          </Button>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, paddingBottom: 56 },
  message: { gap: 8, maxWidth: 320 },
});
