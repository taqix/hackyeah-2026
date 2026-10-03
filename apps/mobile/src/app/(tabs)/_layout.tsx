import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';

import { useStepCounterTracking } from '@/hooks/use-step-counter';
import { useChatPlacement } from '@/navigation/chat-placement';
import { FloatingTabBar } from '@/navigation/floating-tab-bar';
import { GateError, GateLoading } from '@/navigation/gate-states';
import { useAccountState } from '@/navigation/use-account-state';
import { useTheme } from '@/theme';

/** Tabs need a session and saved answers. */
export default function TabsLayout() {
  const account = useAccountState();
  switch (account.status) {
    case 'loading':
      return <GateLoading />;
    case 'error':
      return <GateError onRetry={account.retry} />;
    case 'signed-out':
      return <Redirect href="/welcome" />;
    case 'needs-onboarding':
      return <Redirect href="/onboarding/starting" />;
    case 'ready':
      return <TabsNavigator />;
  }
}

function TabsNavigator() {
  // Steps are read only once the person reaches the app, not during sign-in or onboarding.
  useStepCounterTracking();
  const { colors } = useTheme();
  const [placement] = useChatPlacement();

  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bgApp } }}>
      <Tabs.Screen name="index" options={{ title: 'Today' }} />
      <Tabs.Screen name="calendar" options={{ title: 'Calendar' }} />
      {/* Button placement opens chat as /coach; the tab route stays for deep links. */}
      <Tabs.Screen name="chat" options={placement === 'button' ? { title: 'Chat', href: null } : { title: 'Chat' }} />
      <Tabs.Screen name="you" options={{ title: 'You' }} />
    </Tabs>
  );
}
