import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Button, Icon, Text } from '@/components/ui';
import { BackButton, Body, BottomBar, Col, Content, H1, Row, Screen, TopBar } from '@/components/layout';
import { ONBOARDING_ORDER } from '@/features/onboarding/step-screen';
import { deviceTimezone, stepIsComplete, useOnboardingDraft } from '@/state/onboarding-draft';
import { useTheme } from '@/theme';

import { useBottomBarInset } from './bottom-bar-inset';
import { useCalendarAccess } from './calendar-access';
import { CalendarRow } from './calendar-row';
import { ReviewRows } from './review-rows';
import { useBuildFirstPlan } from './use-build-first-plan';

/** Room for the one-line failure message above Try again. */
const FAILURE_LINE = 52;

/** 4 Review (and 4.1, calendar access off): every answer once, calendar access, Build plan. */
export function ReviewScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [draft] = useOnboardingDraft();
  const calendar = useCalendarAccess();
  const build = useBuildFirstPlan();
  const complete = ONBOARDING_ORDER.every((section) => stepIsComplete(section, draft));
  const failedInset = useBottomBarInset(FAILURE_LINE);

  return (
    <Screen>
      <TopBar left={router.canGoBack() ? <BackButton /> : null} />
      <Content gap={20} bottomInset={build.failed ? failedInset : 'bottomBar'}>
        <Col gap={8}>
          <H1>Looks right?</H1>
          <Body>We&apos;ll build your first week from this. Tap anything to change it.</Body>
        </Col>
        <View>
          <ReviewRows draft={draft} />
          <CalendarRow
            access={calendar.access}
            canAskAgain={calendar.canAskAgain}
            requesting={calendar.requesting}
            onConnect={() => void calendar.connect()}
            onOpenSettings={calendar.openSettings}
          />
        </View>
        <Row gap={8}>
          <Icon name="globe" size={16} color={colors.textTertiary} />
          <Text variant="caption" style={{ flex: 1 }}>
            Times use your phone&apos;s time zone, {deviceTimezone()}.
          </Text>
        </Row>
      </Content>
      <BottomBar>
        <Col gap={10} style={{ flex: 1 }}>
          {build.failed ? (
            <Text variant="bodySm" tone="danger" align="center" accessibilityRole="alert">
              We couldn&apos;t build your plan. Check your connection, then try again.
            </Text>
          ) : null}
          <Button
            size="lg"
            fullWidth
            iconRight="arrow-right"
            disabled={!complete}
            loading={build.working}
            onPress={() => void build.start()}>
            {build.failed ? 'Try again' : 'Build plan'}
          </Button>
        </Col>
      </BottomBar>
    </Screen>
  );
}
