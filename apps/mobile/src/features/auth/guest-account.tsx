import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { AccessibilityInfo, type TextInput } from 'react-native';

import { useSignOut, useUpgradeGuest } from '@/api/hooks';
import { isApiError, isGuest, type User } from '@/api/types';
import { Col, Row } from '@/components/layout';
import { Button, Card, Disc, Input, Sheet, Text } from '@/components/ui';
import { useTheme } from '@/theme';

import { EMAIL_FORMAT_ERROR, looksLikeEmail, MIN_PASSWORD_LENGTH, normalizeEmail } from './auth-routes';
import { RequestAlert, SentNote } from './notes';

const SHORT_PASSWORD_ERROR = 'Use at least 8 characters.';
const EMAIL_TAKEN_ERROR = 'An account already uses this email. Use another one, or leave guest mode and sign in.';

type SheetControl = { visible: boolean; onClose: () => void };

/**
 * Save your progress: an email and password on the guest's own account, so
 * its plan, history and chat stay. Ends with "Saved", or with "Check your
 * inbox" when the email has to be confirmed first (the account stays a guest
 * until the link is opened).
 */
export function SaveProgressSheet({ visible, onClose }: SheetControl) {
  const upgrade = useUpgradeGuest();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [problem, setProblem] = useState<{ field: 'email' | 'password'; message: string } | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);
  // Each opening starts from an empty form.
  const [openedFor, setOpenedFor] = useState(visible);
  if (visible !== openedFor) {
    setOpenedFor(visible);
    if (visible) {
      setEmail('');
      setPassword('');
      setProblem(null);
      setSaved(null);
    }
  }

  const close = () => {
    onClose();
    upgrade.reset();
  };

  /** Return passes the field's own text: fast typing can submit before state catches up. */
  const save = (typed: string = password) => {
    if (upgrade.isPending) return;
    if (!looksLikeEmail(email)) {
      setProblem({ field: 'email', message: EMAIL_FORMAT_ERROR });
      return;
    }
    if (typed.length < MIN_PASSWORD_LENGTH) {
      setProblem({ field: 'password', message: SHORT_PASSWORD_ERROR });
      return;
    }
    upgrade.mutate(
      { email: normalizeEmail(email), password: typed },
      {
        onSuccess: (session) => {
          setSaved(session.user.email);
          AccessibilityInfo.announceForAccessibility('Your account is saved');
        },
      },
    );
  };

  const error = upgrade.error;
  const emailError =
    problem?.field === 'email'
      ? problem.message
      : isApiError(error, 'email_taken')
        ? EMAIL_TAKEN_ERROR
        : isApiError(error, 'validation')
          ? error.message
          : null;
  const passwordError =
    problem?.field === 'password' ? problem.message : isApiError(error, 'weak_password') ? SHORT_PASSWORD_ERROR : null;
  const confirmFirst = isApiError(error, 'confirmation_required') ? error.message : null;
  const requestError = error && !emailError && !passwordError && !confirmFirst ? error : null;

  if (saved || confirmFirst) {
    return (
      <Sheet
        visible={visible}
        onClose={close}
        title={saved ? 'Saved' : 'Check your inbox'}
        description={saved ? undefined : (confirmFirst ?? undefined)}>
        {saved ? (
          <SentNote>{`Your plan and history are kept. Sign in with ${saved} from now on.`}</SentNote>
        ) : (
          <Text variant="bodySm" style={{ paddingHorizontal: 4 }}>
            Until then you&apos;re still a guest in this browser.
          </Text>
        )}
        <Button onPress={close} fullWidth>
          Done
        </Button>
      </Sheet>
    );
  }

  return (
    <Sheet
      visible={visible}
      onClose={close}
      title="Save your progress"
      description="Add an email and password. Your plan, history and chat stay as they are.">
      <Input
        label="Email"
        placeholder="you@example.com"
        value={email}
        onChangeText={(text) => {
          setEmail(text);
          if (problem?.field === 'email') setProblem(null);
          if (upgrade.isError) upgrade.reset();
        }}
        error={emailError}
        keyboardType="email-address"
        inputMode="email"
        autoComplete="email"
        textContentType="emailAddress"
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <Input
        ref={passwordRef}
        label="Password"
        secure
        value={password}
        onChangeText={(text) => {
          setPassword(text);
          if (problem?.field === 'password') setProblem(null);
          if (upgrade.isError) upgrade.reset();
        }}
        hint="At least 8 characters."
        error={passwordError}
        autoComplete="new-password"
        textContentType="newPassword"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="go"
        onSubmitEditing={(event) => save(event.nativeEvent.text)}
      />
      {requestError ? <RequestAlert error={requestError} onRetry={() => save()} /> : null}
      <Col gap={8}>
        <Button onPress={() => save()} loading={upgrade.isPending} disabled={!email || !password} fullWidth>
          Save
        </Button>
        <Button variant="ghost" onPress={close} fullWidth>
          Cancel
        </Button>
      </Col>
    </Sheet>
  );
}

/**
 * Leave guest mode: signs the guest out after saying what it costs. A guest
 * account has no way to sign in again, so its plan can't be reopened.
 */
export function LeaveGuestSheet({ visible, onClose }: SheetControl) {
  const router = useRouter();
  const signOut = useSignOut();

  const close = () => {
    onClose();
    signOut.reset();
  };

  const leave = () => {
    signOut.mutate(undefined, {
      onSuccess: () => {
        onClose();
        // Drop the signed-in screens underneath, then start again at Welcome.
        if (router.canDismiss()) router.dismissAll();
        router.replace('/welcome');
      },
    });
  };

  return (
    <Sheet
      visible={visible}
      onClose={close}
      title="Leave guest mode?"
      description="Your guest plan and history can't be opened again after you leave. Save your progress first to keep them.">
      {signOut.isError ? (
        <Text variant="bodySm" tone="danger" accessibilityRole="alert" style={{ paddingHorizontal: 4 }}>
          We couldn&apos;t sign you out. Check your connection, then try again.
        </Text>
      ) : null}
      <Col gap={8}>
        <Button onPress={leave} loading={signOut.isPending} fullWidth>
          Leave guest mode
        </Button>
        <Button variant="ghost" onPress={close} fullWidth>
          Cancel
        </Button>
      </Col>
    </Sheet>
  );
}

/**
 * Settings › Account for a web guest: what a guest account is, Save your
 * progress and Leave guest mode. Other accounts see nothing, except a save
 * sheet still open to say it worked.
 */
export function GuestAccount({ user }: { user: Pick<User, 'provider'> }) {
  const { colors } = useTheme();
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false);

  return (
    <>
      {isGuest(user) ? (
        <Card variant="accent" style={{ gap: 16, marginTop: 8, marginBottom: 4 }}>
          <Row gap={12} style={{ alignItems: 'flex-start' }}>
            <Disc icon="user-round" size={40} style={{ backgroundColor: colors.surfaceCard }} />
            <Col gap={4} style={{ flex: 1 }}>
              <Text variant="subheading">Save your progress</Text>
              <Text variant="bodySm">
                You&apos;re using a guest account kept in this browser. Add an email and password to keep your plan
                and history.
              </Text>
            </Col>
          </Row>
          <Row gap={8} style={{ flexWrap: 'wrap' }}>
            <Button icon="mail" onPress={() => setSaving(true)}>
              Add email
            </Button>
            <Button variant="ghost" icon="log-out" onPress={() => setLeaving(true)}>
              Leave guest mode
            </Button>
          </Row>
        </Card>
      ) : null}
      <SaveProgressSheet visible={saving} onClose={() => setSaving(false)} />
      <LeaveGuestSheet visible={leaving} onClose={() => setLeaving(false)} />
    </>
  );
}
