import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking } from 'react-native';

import { useSignOut } from '@/api/hooks';
import { BackButton, Col, Content, Screen, Section, TopBar } from '@/components/layout';
import { Button, ListRow, Segmented, type SegmentedOption } from '@/components/ui';
import { type Appearance, useAppearance } from '@/theme';

import { AccountRows } from './account-rows';
import { ConfirmSheet } from './confirm-sheet';

const APPEARANCE_OPTIONS: SegmentedOption<Appearance>[] = [
  { value: 'system', label: 'Phone' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

/** Placeholders until the real documents are published. */
const TERMS_URL = 'https://example.com/terms';
const PRIVACY_POLICY_URL = 'https://example.com/privacy';

function openExternal(url: string) {
  Linking.openURL(url).catch(() => undefined);
}

/**
 * 9.6 — Settings, behind the You tab's gear: how the app looks and the account,
 * kept apart from what shapes the plan. Appearance follows the phone unless picked.
 */
export function SettingsScreen() {
  const router = useRouter();
  const [appearance, setAppearance] = useAppearance();
  const signOut = useSignOut();
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);

  const closeSignOut = () => {
    setConfirmingSignOut(false);
    signOut.reset();
  };

  const confirmSignOut = () => {
    signOut.mutate(undefined, {
      onSuccess: () => {
        setConfirmingSignOut(false);
        // Drop the signed-in screens underneath, then start again at Welcome.
        if (router.canDismiss()) router.dismissAll();
        router.replace('/welcome');
      },
    });
  };

  return (
    <Screen>
      <TopBar left={<BackButton />} title="Settings" />
      <Content gap={24}>
        <Col gap={12}>
          <Section>Appearance</Section>
          <Segmented label="Appearance" options={APPEARANCE_OPTIONS} value={appearance} onChange={setAppearance} />
        </Col>

        <Col gap={0}>
          <Section>Account</Section>
          <AccountRows />
        </Col>

        <Col gap={0}>
          <Section>Privacy</Section>
          <ListRow
            icon="shield-check"
            discTone="quiet"
            discSize={36}
            title="Data and privacy"
            detail="Connections and what our assistant sees"
            onPress={() => router.push('/settings/privacy')}
          />
        </Col>

        <Col gap={0}>
          <Section>About</Section>
          <ListRow
            icon="file-text"
            discTone="quiet"
            discSize={36}
            title="Terms"
            accessibilityHint="Opens in your browser"
            onPress={() => openExternal(TERMS_URL)}
          />
          <ListRow
            icon="lock"
            discTone="quiet"
            discSize={36}
            title="Privacy policy"
            accessibilityHint="Opens in your browser"
            onPress={() => openExternal(PRIVACY_POLICY_URL)}
            divider
          />
        </Col>

        <Col gap={0}>
          <Section>Demo</Section>
          <ListRow
            icon="sliders-horizontal"
            discTone="quiet"
            discSize={36}
            title="Demo controls"
            detail="Mocked data, failures and time travel"
            onPress={() => router.push('/settings/demo')}
          />
        </Col>

        <Button
          variant="ghost"
          icon="log-out"
          onPress={() => setConfirmingSignOut(true)}
          style={{ alignSelf: 'flex-start', marginLeft: -12 }}>
          Sign out
        </Button>
      </Content>

      <ConfirmSheet
        visible={confirmingSignOut}
        onClose={closeSignOut}
        title="Sign out?"
        description="Your plan, answers and history stay with your account. Sign in again to pick up where you left off."
        confirmLabel="Sign out"
        onConfirm={confirmSignOut}
        busy={signOut.isPending}
        error={signOut.isError ? "We couldn't sign you out. Check your connection, then try again." : null}
      />
    </Screen>
  );
}
