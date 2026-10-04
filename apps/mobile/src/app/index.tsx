import { Redirect } from 'expo-router';

import { GateError, GateLoading } from '@/navigation/gate-states';
import { useAccountState } from '@/navigation/use-account-state';

/** Entry gate: Welcome without a session, onboarding without answers, otherwise Today. */
export default function Gate() {
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
      return <Redirect href="/(tabs)" />;
  }
}
