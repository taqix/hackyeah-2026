import { Redirect, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { useSession, useSignInAsGuest } from '@/api/hooks';
import { isGuestModeUnavailable } from '@/api/remote/auth';
import { Body, Col, H1 } from '@/components/layout';
import { Button } from '@/components/ui';

import { AuthFrame, AuthWaiting } from './auth-frame';
import { GUEST_PROMISE, guestErrorMessage } from './auth-routes';

/** Guest mode didn't start: the reason, Try again when it can help, and the way to sign in. */
function GuestProblem({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const router = useRouter();
  return (
    <AuthFrame gap={20}>
      <Col gap={8} accessibilityRole="alert">
        <H1>Guest mode didn&apos;t start</H1>
        <Body>{guestErrorMessage(error)}</Body>
      </Col>
      <Col gap={8}>
        {onRetry ? (
          <Button size="lg" fullWidth icon="refresh-cw" onPress={onRetry}>
            Try again
          </Button>
        ) : null}
        <Button
          size="lg"
          fullWidth
          variant={onRetry ? 'secondary' : 'primary'}
          onPress={() => router.replace('/welcome')}>
          Sign in instead
        </Button>
      </Col>
    </AuthFrame>
  );
}

function WebGuest() {
  const session = useSession();
  const guest = useSignInAsGuest();
  const { mutate } = guest;
  const started = useRef(false);
  const signedOut = session.isSuccess && !session.data;

  // Once, as soon as the page knows nobody is signed in.
  useEffect(() => {
    if (!signedOut || started.current) return;
    started.current = true;
    mutate();
  }, [signedOut, mutate]);

  // Signed in already, or the guest just made: the gate starts onboarding or opens Today.
  if (session.data) return <Redirect href="/" />;
  if (guest.isError) {
    return (
      <GuestProblem error={guest.error} onRetry={isGuestModeUnavailable(guest.error) ? undefined : () => mutate()} />
    );
  }
  if (session.isError) return <GuestProblem error={session.error} onRetry={() => void session.refetch()} />;
  return <AuthWaiting title="Setting up your guest account" detail={GUEST_PROMISE} />;
}

/**
 * /guest, where the landing page's link leads (web only): makes a guest
 * account straight away and hands over to the gate, which starts onboarding.
 * Someone already signed in goes straight in. The mobile app has no guest
 * entry, so there this route opens Welcome.
 */
export function GuestScreen() {
  if (Platform.OS !== 'web') return <Redirect href="/welcome" />;
  return <WebGuest />;
}
