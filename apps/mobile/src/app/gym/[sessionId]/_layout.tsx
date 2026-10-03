import { Stack } from 'expo-router';

import { useTheme } from '@/theme';

/** Guided gym (6.3–6.7) and its review (6.8), inside one full-screen modal. */
export default function GymLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: colors.bgApp },
      }}>
      <Stack.Screen name="index" options={{ gestureEnabled: false }} />
    </Stack>
  );
}
