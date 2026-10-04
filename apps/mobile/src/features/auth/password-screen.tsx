import { useRouter } from 'expo-router';
import { useState } from 'react';

import { useSendPasswordReset, useSignInWithEmail, useSignUpWithEmail } from '@/api/hooks';
import { isApiError } from '@/api/types';
import { Button, Icon, Input, Text } from '@/components/ui';
import { BackButton, Body, Col, Content, H1, Row, Screen, TopBar } from '@/components/layout';
import { useTheme } from '@/theme';

import { type AuthMode, EMAIL_FORMAT_ERROR, MIN_PASSWORD_LENGTH, passwordRoute } from './auth-routes';
import { KeyboardFrame } from './keyboard-frame';
import { Legal } from './legal';
import { RequestAlert, SentNote } from './notes';

const WRONG_PASSWORD_ERROR = "Wrong password, or there's no account with this email yet.";
const SHORT_PASSWORD_ERROR = 'Use at least 8 characters.';

/** The email being used, with Change to go back and edit it. */
function EmailChip({ email, onChange }: { email: string; onChange: () => void }) {
  const { colors, radius, fontFamily } = useTheme();
  return (
    <Row
      gap={12}
      style={{
        paddingVertical: 8,
        paddingRight: 8,
        paddingLeft: 14,
        borderRadius: radius.md,
        backgroundColor: colors.surfaceSunken,
      }}>
      <Icon name="mail" size={18} color={colors.textSecondary} />
      <Text
        numberOfLines={1}
        ellipsizeMode="middle"
        style={{ flex: 1, minWidth: 0, fontFamily: fontFamily.bodyMedium }}>
        {email}
      </Text>
      <Button variant="ghost" size="sm" accessibilityLabel="Change email" onPress={onChange} style={{ height: 44 }}>
        Change
      </Button>
    </Row>
  );
}

export type PasswordScreenProps = {
  email: string;
  mode: AuthMode;
};

/**
 * The password step after an email: 1.1 signs in, 1.2 creates an account, 1.3 is a
 * wrong password said in the field. The server never says whether an email has an
 * account, so sign-in also offers "Create an account". Success goes to the gate,
 * which routes a new account to onboarding and a set-up one to Today. When the email
 * must be confirmed first, sign-up ends with a note instead.
 */
export function PasswordScreen({ email, mode }: PasswordScreenProps) {
  const router = useRouter();
  const signingIn = mode === 'sign-in';
  const signIn = useSignInWithEmail();
  const signUp = useSignUpWithEmail();
  const reset = useSendPasswordReset();
  const account = signingIn ? signIn : signUp;
  const [password, setPassword] = useState('');
  const [tooShort, setTooShort] = useState(false);

  const error = account.error;
  const fieldError =
    tooShort || isApiError(error, 'weak_password')
      ? SHORT_PASSWORD_ERROR
      : isApiError(error, 'invalid_credentials')
        ? WRONG_PASSWORD_ERROR
        : null;
  const awaitingConfirmation = !signingIn && isApiError(error, 'confirmation_required');
  const requestError = error && !fieldError && !awaitingConfirmation ? error : null;

  const changeEmail = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/welcome');
  };

  /** Return passes the field's own text: fast typing can submit before state catches up. */
  const submit = (typed: string = password) => {
    if (!typed || account.isPending) return;
    if (!signingIn && typed.length < MIN_PASSWORD_LENGTH) {
      setTooShort(true);
      return;
    }
    account.mutate({ email, password: typed }, { onSuccess: () => router.replace('/') });
  };

  const sendReset = () => reset.mutate(email);
  const switchMode = (next: AuthMode) => router.replace(passwordRoute(email, next));

  return (
    <Screen>
      <TopBar left={<BackButton />} />
      <KeyboardFrame>
        <Content gap={20} automaticallyAdjustKeyboardInsets={false}>
          <Col gap={8}>
            <H1>{signingIn ? 'Sign in' : 'Create your account'}</H1>
            <Body>{signingIn ? 'Enter the password for this email.' : 'Pick a password to set up your account.'}</Body>
          </Col>
          <EmailChip email={email} onChange={changeEmail} />
          <Input
            label={signingIn ? 'Password' : 'New password'}
            secure
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              setTooShort(false);
              if (account.isError) account.reset();
            }}
            hint={signingIn ? undefined : 'At least 8 characters.'}
            error={fieldError}
            autoComplete={signingIn ? 'current-password' : 'new-password'}
            textContentType={signingIn ? 'password' : 'newPassword'}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            returnKeyType="go"
            onSubmitEditing={(event) => submit(event.nativeEvent.text)}
          />
          {requestError ? (
            isApiError(requestError, 'email_taken') ? (
              <RequestAlert
                error={requestError}
                message="An account already uses this email."
                onRetry={() => submit()}
                action={{ label: 'Sign in instead', onPress: () => switchMode('sign-in') }}
              />
            ) : isApiError(requestError, 'confirmation_required') ? (
              <RequestAlert error={requestError} message={requestError.message} onRetry={() => submit()} />
            ) : isApiError(requestError, 'validation') ? (
              <RequestAlert
                error={requestError}
                message={EMAIL_FORMAT_ERROR}
                onRetry={() => submit()}
                action={{ label: 'Change email', onPress: changeEmail }}
              />
            ) : (
              <RequestAlert error={requestError} onRetry={() => submit()} />
            )
          ) : null}
          <Col gap={4}>
            <Button size="lg" fullWidth disabled={!password} loading={account.isPending} onPress={() => submit()}>
              {signingIn ? 'Sign in' : 'Create account'}
            </Button>
            {signingIn ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  loading={reset.isPending}
                  onPress={sendReset}
                  style={{ height: 44, alignSelf: 'center' }}>
                  Forgot password?
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onPress={() => switchMode('sign-up')}
                  style={{ height: 44, alignSelf: 'center' }}>
                  New here? Create an account
                </Button>
              </>
            ) : null}
          </Col>
          {awaitingConfirmation ? (
            <Col gap={12}>
              <SentNote>Check your inbox to confirm, then sign in.</SentNote>
              <Button
                variant="secondary"
                size="sm"
                onPress={() => switchMode('sign-in')}
                style={{ alignSelf: 'flex-start' }}>
                Sign in
              </Button>
            </Col>
          ) : null}
          {reset.isSuccess ? <SentNote>{`We've sent a reset link to ${email}.`}</SentNote> : null}
          {reset.isError ? <RequestAlert error={reset.error} onRetry={sendReset} /> : null}
          {signingIn ? null : <Legal lead="By creating an account" />}
        </Content>
      </KeyboardFrame>
    </Screen>
  );
}
