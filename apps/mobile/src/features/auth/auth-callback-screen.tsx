import { Redirect, useRouter } from 'expo-router';
import { useEffect } from 'react';

import type { AuthRedirectParams } from '@/api/remote/auth';
import { getRemoteRuntime } from '@/api/remote/default';
import { connectErrorMessage } from '@/api/remote/google-calendar';
import { GateLoading } from '@/navigation/gate-states';

import { LinkProblem } from './link-problem';
import { useAuthRedirect } from './use-auth-redirect';
import { useCalendarReturn } from './use-calendar-return';

/**
 * /auth/callback: where Google and the email confirmation link return. Trades
 * the link's code for a session, then hands over to the gate. A Google
 * Calendar connect from Data and privacy goes back there instead, with any
 * problem shown on that screen.
 */
export function AuthCallbackScreen({ params }: { params: AuthRedirectParams }) {
  const router = useRouter();
  const redirect = useAuthRedirect(params);
  const calendar = useCalendarReturn();
  const settled = redirect.status !== 'working';
  const toCalendar = calendar === 'calendar' && settled;

  useEffect(() => {
    if (!toCalendar) return;
    if (redirect.status === 'failed') {
      getRemoteRuntime().googleCalendar.setNotice(connectErrorMessage(redirect.error, params.error));
    }
    // Android pushed this screen over Data and privacy; the web page starts here.
    if (router.canGoBack()) router.back();
    else router.replace('/settings/privacy');
  }, [toCalendar, redirect, params.error, router]);

  if (toCalendar || (calendar === 'checking' && redirect.status !== 'skipped')) return <GateLoading />;
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
