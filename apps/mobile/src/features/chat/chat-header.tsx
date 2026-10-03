import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { BackButton, TopBar } from '@/components/layout';
import { Text } from '@/components/ui';

/** "Coach" over the plan's sport and week. Back returns to the tab chat opened over. */
export function ChatHeader({ sub }: { sub: string | null }) {
  const router = useRouter();
  return (
    <TopBar
      left={
        <BackButton
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/(tabs)');
          }}
        />
      }
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

const styles = StyleSheet.create({
  title: { flexShrink: 1, alignItems: 'center', gap: 2 },
});
