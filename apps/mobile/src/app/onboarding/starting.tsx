import { OnboardingStepScreen } from '@/features/onboarding/step-screen';
import { StartingStep } from '@/features/preferences/steps';
import { stepIsComplete, useOnboardingDraft } from '@/state/onboarding-draft';

/** 2 Starting point. Continue waits for an answer. */
export default function StartingRoute() {
  const [draft, update] = useOnboardingDraft();
  return (
    <OnboardingStepScreen section="starting" canContinue={stepIsComplete('starting', draft)}>
      <StartingStep draft={draft} update={update} mode="onboarding" />
    </OnboardingStepScreen>
  );
}
