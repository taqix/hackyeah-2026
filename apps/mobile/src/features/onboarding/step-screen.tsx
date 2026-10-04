import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import type { ReactNode } from 'react';

import type { PreferenceSection } from '@/api/types';
import { Button } from '@/components/ui';
import { BackButton, BottomBar, Content, Kicker, Screen, TopBar } from '@/components/layout';

/** The questions in order; Review (4) follows and is not counted in "N of 5". */
export const ONBOARDING_ORDER: PreferenceSection[] = ['starting', 'time', 'activities', 'places', 'extras'];

export const onboardingRoute = (section: PreferenceSection): Href => `/onboarding/${section}`;

/** Where Continue goes from a step: the next question, or Review after the last one. */
export function nextOnboardingRoute(section: PreferenceSection): Href {
  const next = ONBOARDING_ORDER[ONBOARDING_ORDER.indexOf(section) + 1];
  return next ? onboardingRoute(next) : '/onboarding/review';
}

export type OnboardingStepScreenProps = {
  section: PreferenceSection;
  children: ReactNode;
  /** Continue stays disabled until the step's answers are complete. */
  canContinue: boolean;
  /** Defaults to the next step, or back to Review when the step was opened from there (?from=review). */
  onContinue?: () => void;
  /** Replaces the "N of 5" kicker, e.g. Skip on Good to know (3.4). */
  right?: ReactNode;
};

/** Onboarding chrome (prototype StepTop + Next): back, "N of 5", the questions, Continue. */
export function OnboardingStepScreen({ section, children, canContinue, onContinue, right }: OnboardingStepScreenProps) {
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
        right={right ?? <Kicker>{`${step} of ${ONBOARDING_ORDER.length}`}</Kicker>}
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
