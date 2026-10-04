import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';

import { isMockMode } from '@/api/config';
import { useSession, useUpdatePassword } from '@/api/hooks';
import type { AuthRedirectParams } from '@/api/remote/auth';
import { isApiError } from '@/api/types';
import { Button, Input } from '@/components/ui';
import { Body, Col, H1, useLayout } from '@/components/layout';
import { GateLoading } from '@/navigation/gate-states';

import { AuthFrame, AuthWaiting } from './auth-frame';
import { MIN_PASSWORD_LENGTH } from './auth-routes';
import { LinkProblem } from './link-problem';
import { RequestAlert } from './notes';
import { setRecoveryPending, useRecoveryPending } from './recovery';
import { useAuthRedirect } from './use-auth-redirect';

const SHORT_PASSWORD_ERROR = 'Use at least 8 characters.';
const NO_LINK = 'Open the reset link from your email again, or ask for a new one when you sign in.';

/**
 * /auth/reset: the password reset email opens this. Its code signs the person
 * in for recovery (Supabase reports PASSWORD_RECOVERY); they pick a new
 * password and go on to the app.
 */
export function ResetPasswordScreen({ params }: { params: AuthRedirectParams }) {
  const router = useRouter();
  const [hasLink] = useState(Boolean(params.code || params.error));
  const redirect = useAuthRedirect(params, { enabled: hasLink });
  const recovery = useRecoveryPending();
  const session = useSession();
  const update = useUpdatePassword();
  const [password, setPassword] = useState('');
  const [tooShort, setTooShort] = useState(false);
  const { isDesktop } = useLayout();

  if (isMockMode) return <Redirect href="/" />;
  if (redirect.status === 'working') return isDesktop ? <AuthWaiting title="Checking your link" /> : <GateLoading />;
  if (redirect.status === 'failed') {
    return <LinkProblem title="This link didn't work" error={redirect.error} onRetry={redirect.retry} />;
  }
  if (redirect.status !== 'done' && !recovery) return <LinkProblem title="This link didn't work" message={NO_LINK} />;

  const error = update.error;
  const fieldError =
    tooShort || isApiError(error, 'weak_password')
      ? SHORT_PASSWORD_ERROR
      : isApiError(error, 'validation')
        ? error.message
        : null;
  const requestError = error && !fieldError ? error : null;
  const email = session.data?.user.email;

  /** Return passes the field's own text: fast typing can submit before state catches up. */
  const submit = (typed: string = password) => {
    if (!typed || update.isPending) return;
    if (typed.length < MIN_PASSWORD_LENGTH) {
      setTooShort(true);
      return;
    }
    update.mutate(typed, {
      onSuccess: () => {
        setRecoveryPending(false);
        router.replace('/');
      },
    });
  };

  return (
    <AuthFrame gap={20}>
      <Col gap={8}>
        <H1>Set a new password</H1>
        <Body>{email ? `Pick a new password for ${email}.` : 'Pick a new password for your account.'}</Body>
      </Col>
      <Input
        label="New password"
        secure
        value={password}
        onChangeText={(text) => {
          setPassword(text);
          setTooShort(false);
          if (update.isError) update.reset();
        }}
        hint="At least 8 characters."
        error={fieldError}
        autoComplete="new-password"
        textContentType="newPassword"
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
        returnKeyType="go"
        onSubmitEditing={(event) => submit(event.nativeEvent.text)}
      />
      {requestError ? (
        isApiError(requestError, 'unauthorized') ? (
          <RequestAlert
            error={requestError}
            message="Your reset link has expired. Ask for a new one when you sign in."
            onRetry={() => submit()}
            action={{ label: 'Back to sign in', onPress: () => router.replace('/welcome') }}
          />
        ) : (
          <RequestAlert error={requestError} onRetry={() => submit()} />
        )
      ) : null}
      <Button size="lg" fullWidth disabled={!password} loading={update.isPending} onPress={() => submit()}>
        Save password
      </Button>
    </AuthFrame>
  );
}
