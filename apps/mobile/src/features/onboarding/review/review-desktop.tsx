import { View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { Col, Row } from '@/components/layout';
import { ONBOARDING_ORDER } from '@/features/onboarding/order';
import { WizardActions } from '@/features/onboarding/wizard/actions';
import { AsideNote, AsidePanel } from '@/features/onboarding/wizard/aside';
import { WizardHeading } from '@/features/onboarding/wizard/heading';
import { useWizardBack } from '@/features/onboarding/wizard/navigation';
import { WizardStage } from '@/features/onboarding/wizard/stage';
import { useEnterToContinue } from '@/features/onboarding/wizard/use-enter-to-continue';
import { deviceTimezone, stepIsComplete, useOnboardingDraft } from '@/state/onboarding-draft';
import { useTheme } from '@/theme';

import { AnswerCards } from './answer-cards';
import { ReviewCalendarRows } from './calendar-rows';
import { useBuildFirstPlan } from './use-build-first-plan';

/** What Build plan leads to, beside the Review card. */
function ReviewAside() {
  return (
    <AsidePanel>
      <Text variant="section">What happens next</Text>
      <AsideNote icon="calendar-days" title="Your first week">
        We build it from these answers. It takes about a minute, and Today shows it as soon as it&apos;s ready.
      </AsideNote>
      <AsideNote icon="calendar-clock" title="Around your time">
        Sessions go into free time in your calendar when one is connected, otherwise into your preferred times.
      </AsideNote>
      <AsideNote icon="message-circle" title="Easy to change">
        Change your answers in You any time, or ask your coach to adjust the plan.
      </AsideNote>
    </AsidePanel>
  );
}

/**
 * 4 Review on the desktop web: the answers as cards (each opens its step),
 * the calendars (the phone's, and Google Calendar where Google sign-in is on),
 * then Back and Build plan, which Enter also starts. Neither calendar is
 * required to build the plan; Build plan hands over to Today's building state.
 */
export function DesktopReview() {
  const { colors } = useTheme();
  const [draft] = useOnboardingDraft();
  const build = useBuildFirstPlan();
  const complete = ONBOARDING_ORDER.every((section) => stepIsComplete(section, draft));
  const back = useWizardBack('review', false);
  const start = () => void build.start();
  useEnterToContinue(complete && !build.working, start);

  return (
    <WizardStage step="review" aside={<ReviewAside />}>
      <Col gap={32}>
        <WizardHeading
          icon="list-checks"
          kicker="Last step"
          title="Looks right?"
          body="We'll build your first week from this. Click anything to change it."
        />
        <AnswerCards draft={draft} />
        <Col gap={4}>
          <View>
            <ReviewCalendarRows />
          </View>
          <Row gap={8} style={{ paddingTop: 8 }}>
            <Icon name="globe" size={16} color={colors.textTertiary} />
            <Text variant="caption" style={{ flex: 1 }}>
              Times use your time zone, {deviceTimezone()}.
            </Text>
          </Row>
        </Col>
      </Col>
      <WizardActions
        onBack={back}
        primaryLabel={build.failed ? 'Try again' : 'Build plan'}
        onPrimary={start}
        disabled={!complete}
        loading={build.working}
        note={
          build.failed ? (
            <Text variant="bodySm" tone="danger" accessibilityRole="alert">
              We couldn&apos;t build your plan. Check your connection, then try again.
            </Text>
          ) : null
        }
      />
    </WizardStage>
  );
}
