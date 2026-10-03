import { Redirect, Stack } from 'expo-router';

import { GateError, GateLoading } from '@/navigation/gate-states';
import { useAccountState } from '@/navigation/use-account-state';
import { useTheme } from '@/theme';

/** Onboarding needs a session; the answers themselves are what it collects. */
export default function OnboardingLayout() {
  const { colors } = useTheme();
  const account = useAccountState({ checkPreferences: false });

  if (account.status === 'loading') return <GateLoading />;
  if (account.status === 'error') return <GateError onRetry={account.retry} />;
  if (account.status === 'signed-out') return <Redirect href="/welcome" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: colors.bgApp },
      }}
    />
  );
}
