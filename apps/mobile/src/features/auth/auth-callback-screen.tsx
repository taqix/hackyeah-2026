import { Redirect } from 'expo-router';

import type { AuthRedirectParams } from '@/api/remote/auth';
import { GateLoading } from '@/navigation/gate-states';

import { LinkProblem } from './link-problem';
import { useAuthRedirect } from './use-auth-redirect';

/**
 * /auth/callback: where Google and the email confirmation link return. Trades
 * the link's code for a session, then hands over to the gate.
 */
export function AuthCallbackScreen({ params }: { params: AuthRedirectParams }) {
  const redirect = useAuthRedirect(params);
  switch (redirect.status) {
    case 'skipped':
    case 'done':
      return <Redirect href="/" />;
    case 'cancelled':
      return <Redirect href="/welcome" />;
    case 'working':
      return <GateLoading />;
    case 'failed':
      return <LinkProblem title="We couldn't sign you in" error={redirect.error} onRetry={redirect.retry} />;
  }
}
