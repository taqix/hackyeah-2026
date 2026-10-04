import { Redirect, useRouter } from 'expo-router';
import { useEffect } from 'react';

import type { AuthRedirectParams } from '@/api/remote/auth';
import { getRemoteRuntime } from '@/api/remote/default';
import { connectErrorMessage } from '@/api/remote/google-calendar';
import { GateLoading } from '@/navigation/gate-states';

import { LinkProblem } from './link-problem';
import { useAuthRedirect } from './use-auth-redirect';
import { useCalendarReturn } from './use-calendar-return';

/** Where a Google Calendar connect goes back to when this page has no screen under it (the web). */
const CONNECT_SCREENS = { privacy: '/settings/privacy', review: '/onboarding/review' } as const;

/**
 * /auth/callback: where Google and the email confirmation link return. Trades
 * the link's code for a session, then hands over to the gate. A Google
 * Calendar connect goes back to the screen it started on (Data and privacy or
 * onboarding Review) instead, with any problem shown on that screen.
 */
export function AuthCallbackScreen({ params }: { params: AuthRedirectParams }) {
  const router = useRouter();
  const redirect = useAuthRedirect(params);
  const calendar = useCalendarReturn();
  const settled = redirect.status !== 'working';
  const origin = calendar === 'privacy' || calendar === 'review' ? calendar : null;
  const toCalendar = origin !== null && settled;

  useEffect(() => {
    if (!toCalendar || !origin) return;
    if (redirect.status === 'failed') {
      getRemoteRuntime().googleCalendar.setNotice(connectErrorMessage(redirect.error, params.error));
    }
    // Android pushed this screen over the connect's screen; the web page starts here.
    if (router.canGoBack()) router.back();
    else router.replace(CONNECT_SCREENS[origin]);
  }, [toCalendar, origin, redirect, params.error, router]);

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
