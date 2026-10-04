import { useRouter } from 'expo-router';
import { useState } from 'react';

import { isMockMode } from '@/api/config';
import { useAuthProviders, useLookupEmail, useSignInWithGoogle } from '@/api/hooks';
import { isApiError } from '@/api/types';
import { Button, Divider, Input, SuggestionCard, Text } from '@/components/ui';
import { Col, Content, Row, Screen } from '@/components/layout';
import { useTheme } from '@/theme';

import { EMAIL_FORMAT_ERROR, looksLikeEmail, normalizeEmail, passwordRoute } from './auth-routes';
import { GoogleButton } from './google-button';
import { KeyboardFrame } from './keyboard-frame';
import { Legal } from './legal';
import { RequestAlert } from './notes';

function Brand() {
  const { fontFamily } = useTheme();
  return (
    <Text
      accessibilityRole="header"
      style={{
        fontFamily: fontFamily.displaySemibold,
        fontSize: 22,
        lineHeight: 26,
        letterSpacing: -0.55,
        paddingTop: 10,
        paddingBottom: 2,
      }}>
      Movo
    </Text>
  );
}

function OrDivider() {
  return (
    <Row gap={12} aria-hidden>
      <Divider style={{ flex: 1 }} />
      <Text variant="caption" tone="secondary">
        or
      </Text>
      <Divider style={{ flex: 1 }} />
    </Row>
  );
}

/**
 * Welcome (1): Continue with Google, or one email field for everyone. The lookup
 * decides whether the next step asks for the account's password (1.1) or a new one (1.2).
 * Google shows only while the server has it switched on. No guest entry on mobile.
 */
export function WelcomeScreen() {
  const router = useRouter();
  const lookup = useLookupEmail();
  const google = useSignInWithGoogle();
  const providers = useAuthProviders();
  // Hidden until the server says it's on; if it can't be asked, offer it anyway.
  const offerGoogle = providers.data?.google ?? providers.isError;
  const [email, setEmail] = useState('');
  const [checkFormat, setCheckFormat] = useState(false);

  const valid = looksLikeEmail(email);
  const emailError =
    (checkFormat && !valid) || isApiError(lookup.error, 'validation') ? EMAIL_FORMAT_ERROR : null;
  const lookupFailed = lookup.isError && !isApiError(lookup.error, 'validation');

  /** Return passes the field's own text: fast typing can submit before state catches up. */
  const continueWithEmail = (typed: string = email) => {
    if (!looksLikeEmail(typed)) {
      setCheckFormat(true);
      return;
    }
    if (lookup.isPending || google.isPending) return;
    lookup.mutate(normalizeEmail(typed), {
      onSuccess: (result) => router.push(passwordRoute(result.email, result.exists ? 'sign-in' : 'sign-up')),
    });
  };

  const continueWithGoogle = () => {
    // Null: the person closed Google without signing in, so stay here quietly.
    google.mutate(undefined, {
      onSuccess: (session) => {
        if (session) router.replace('/');
      },
    });
  };

  return (
    <Screen>
      <KeyboardFrame>
        <Content gap={16} automaticallyAdjustKeyboardInsets={false}>
          <Brand />
          <SuggestionCard
            tone="dawn"
            style={{ minHeight: 216 }}
            kicker="Welcome"
            title="Find a way to move you'll keep."
            body="A few questions, then a gentle first week. Everyone starts somewhere."
          />
          {offerGoogle ? (
            <>
              <GoogleButton onPress={continueWithGoogle} loading={google.isPending} disabled={lookup.isPending} />
              {google.isError ? <RequestAlert error={google.error} onRetry={continueWithGoogle} /> : null}
              <OrDivider />
            </>
          ) : null}
          <Col gap={12}>
            <Input
              label="Email"
              placeholder="you@example.com"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (lookup.isError) lookup.reset();
              }}
              onBlur={() => {
                if (email.trim()) setCheckFormat(true);
              }}
              error={emailError}
              keyboardType="email-address"
              inputMode="email"
              autoComplete="email"
              textContentType="emailAddress"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="go"
              onSubmitEditing={(event) => continueWithEmail(event.nativeEvent.text)}
            />
            <Button
              size="lg"
              fullWidth
              iconRight="arrow-right"
              disabled={!valid || google.isPending}
              loading={lookup.isPending}
              onPress={() => continueWithEmail()}>
              Continue with email
            </Button>
            {lookupFailed ? <RequestAlert error={lookup.error} onRetry={() => continueWithEmail()} /> : null}
          </Col>
          <Legal lead="We'll sign you in, or set up your account if you're new. By continuing" />
          {__DEV__ && isMockMode ? (
            <Text variant="caption" align="center">
              Demo: ana@example.com, any 8+ character password
            </Text>
          ) : null}
        </Content>
      </KeyboardFrame>
    </Screen>
  );
}
