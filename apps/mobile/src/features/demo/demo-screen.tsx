import { useRouter } from 'expo-router';
import { useState } from 'react';

// The one screen allowed to reach into the mock: it drives the mock itself.
import { DEMO_EMAIL, DEMO_PASSWORD, useDemoSettings, WRONG_PASSWORD } from '@/api/mock';
import { BackButton, Col, Content, Row, Screen, Section, TopBar } from '@/components/layout';
import { Button, Card, Icon, ListRow, Segmented, type SegmentedOption, Text } from '@/components/ui';
import { ConfirmSheet } from '@/features/settings/confirm-sheet';
import { now, useNow } from '@/lib/clock';
import { formatLongDate, formatTime } from '@/lib/dates';
import { useTheme } from '@/theme';

import { SwitchRow } from './switch-row';
import { TIME_TRAVEL } from './time-travel';

const LATENCY: SegmentedOption<number>[] = [
  { value: 0, label: '0', unit: 'ms' },
  { value: 450, label: '450', unit: 'ms' },
  { value: 1500, label: '1500', unit: 'ms' },
];

/** Demo controls (mock build only): how the mocked backend behaves, time travel and a full reset. */
export function DemoScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const demo = useDemoSettings();
  const current = useNow(15_000);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetFailed, setResetFailed] = useState(false);

  const closeReset = () => {
    setConfirmingReset(false);
    setResetFailed(false);
  };

  const reset = async () => {
    setResetting(true);
    setResetFailed(false);
    try {
      await demo.resetEverything();
      setConfirmingReset(false);
      // Signed out now: drop every screen and let the gate start at Welcome.
      if (router.canDismiss()) router.dismissAll();
      router.replace('/');
    } catch {
      setResetFailed(true);
    } finally {
      setResetting(false);
    }
  };

  return (
    <Screen>
      <TopBar left={<BackButton />} title="Demo controls" />
      <Content gap={28}>
        <Card variant="sunken" padding={16}>
          <Row gap={12} style={{ alignItems: 'flex-start' }}>
            <Icon name="info" size={18} color={colors.textSecondary} />
            <Text variant="bodySm" style={{ flex: 1 }}>
              This build runs on mocked data kept on this phone. Nothing reaches a server. Use these controls to show
              any state of the app.
            </Text>
          </Row>
        </Card>

        <Col gap={0}>
          <Section>Demo account</Section>
          <ListRow
            icon="user-round"
            discSize={36}
            title={DEMO_EMAIL}
            detail={`Any password of 8 or more characters, such as ${DEMO_PASSWORD}. Three weeks of history.`}
          />
          <ListRow
            icon="circle-alert"
            discTone="quiet"
            discSize={36}
            title={WRONG_PASSWORD}
            detail="As the password, shows the wrong password message"
            divider
          />
          <ListRow
            icon="user-round"
            discTone="quiet"
            discSize={36}
            title="Continue with Google"
            detail="Signs in Sam, a new account that starts onboarding"
            divider
          />
        </Col>

        <Col gap={12}>
          <Section>Network</Section>
          <Text variant="label" tone="secondary">
            Response time
          </Text>
          <Segmented label="Response time" options={LATENCY} value={demo.latencyMs} onChange={demo.setLatencyMs} />
          <SwitchRow
            icon="wifi-off"
            title="Offline"
            detail="Every request fails as if there's no connection"
            value={demo.offline}
            onValueChange={demo.setOffline}
          />
        </Col>

        <Col gap={0}>
          <Section>Failures</Section>
          <Text variant="caption" style={{ marginTop: 4 }}>
            Each one turns itself off after one use.
          </Text>
          <SwitchRow
            icon="calendar-x"
            title="Fail the next plan build"
            detail="Shows the build error with Try again"
            value={demo.failNextBuild}
            onValueChange={demo.setFailNextBuild}
          />
          <SwitchRow
            icon="message-circle"
            title="Fail the next chat change"
            detail="The assistant can't make the change"
            value={demo.failNextChat}
            onValueChange={demo.setFailNextChat}
            divider
          />
          <SwitchRow
            icon="history"
            title="Make the next chat change stale"
            detail="The plan changed somewhere else first"
            value={demo.staleNextChat}
            onValueChange={demo.setStaleNextChat}
            divider
          />
        </Col>

        <Col gap={12}>
          <Section>Time</Section>
          <Card variant="sunken" padding={16}>
            <Col gap={4}>
              <Text variant="caption">{demo.nowOverride ? 'Demo time' : 'Real time'}</Text>
              <Text variant="bodyStrong" tabular>
                {`${formatLongDate(current)}, ${formatTime(current)}`}
              </Text>
            </Col>
          </Card>
          <Row gap={8} style={{ flexWrap: 'wrap' }}>
            {TIME_TRAVEL.map((option) => (
              <Button
                key={option.label}
                variant="secondary"
                size="sm"
                disabled={option.label === 'Real time' && !demo.nowOverride}
                onPress={() => demo.setNow(option.target(now()))}>
                {option.label}
              </Button>
            ))}
          </Row>
          <Text variant="caption">Time keeps running from the moment you pick, and every screen reloads for it.</Text>
        </Col>

        <Col gap={12}>
          <Section>Start over</Section>
          <Text variant="bodySm">
            Puts back Ana&apos;s history and Sam&apos;s new account, and signs you out. Response time, offline and time stay as they are.
          </Text>
          <Button
            variant="secondary"
            icon="rotate-ccw"
            onPress={() => setConfirmingReset(true)}
            style={{ alignSelf: 'flex-start' }}>
            Reset everything
          </Button>
        </Col>
      </Content>

      <ConfirmSheet
        visible={confirmingReset}
        onClose={closeReset}
        title="Reset everything?"
        description="Every change to the demo accounts goes, including logs, answers and chat. You'll start again at Welcome."
        confirmLabel="Reset everything"
        onConfirm={() => void reset()}
        busy={resetting}
        error={resetFailed ? "We couldn't reset the demo. Try again." : null}
      />
    </Screen>
  );
}
