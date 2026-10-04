import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ReactNode } from 'react';

import type { PreferenceSection } from '@/api/types';
import { Button } from '@/components/ui';
import { BackButton, BottomBar, Content, Kicker, Screen, TopBar, useLayout } from '@/components/layout';

import { nextOnboardingRoute, ONBOARDING_ORDER } from './order';
import type { WizardSkip } from './wizard/actions';
import { DesktopStepScreen } from './wizard/desktop-step-screen';

export { nextOnboardingRoute, ONBOARDING_ORDER, onboardingRoute } from './order';

export type OnboardingStepScreenProps = {
  section: PreferenceSection;
  children: ReactNode;
  /** Continue stays disabled until the step's answers are complete. */
  canContinue: boolean;
  /** Defaults to the next step, or back to Review when the step was opened from there (?from=review). */
  onContinue?: () => void;
  /** Skip, e.g. on Good to know (3.4): in place of the "N of 5" kicker on a phone, beside Continue on the desktop. */
  skip?: WizardSkip;
};

/**
 * Onboarding chrome. Phones (prototype StepTop + Next): back, "N of 5", the
 * questions, Continue in the bottom bar. The desktop web shows the wizard card.
 */
export function OnboardingStepScreen(props: OnboardingStepScreenProps) {
  const { isDesktop } = useLayout();
  return isDesktop ? <DesktopStepScreen {...props} /> : <PhoneStepScreen {...props} />;
}

function PhoneStepScreen({ section, children, canContinue, onContinue, skip }: OnboardingStepScreenProps) {
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const step = ONBOARDING_ORDER.indexOf(section) + 1;
  const advance = () => {
    if (from === 'review' && router.canGoBack()) router.back();
    else router.push(nextOnboardingRoute(section));
  };
  return (
    <Screen>
      <TopBar
        left={router.canGoBack() ? <BackButton /> : null}
        right={
          skip ? (
            <Button
              variant="ghost"
              size="sm"
              onPress={skip.onPress}
              accessibilityHint={skip.hint}
              style={{ marginRight: -8 }}>
              Skip
            </Button>
          ) : (
            <Kicker>{`${step} of ${ONBOARDING_ORDER.length}`}</Kicker>
          )
        }
      />
      <Content bottomInset="bottomBar">{children}</Content>
      <BottomBar>
        <Button
          size="lg"
          fullWidth
          iconRight="arrow-right"
          disabled={!canContinue}
          onPress={onContinue ?? advance}>
          Continue
        </Button>
      </BottomBar>
    </Screen>
  );
}
