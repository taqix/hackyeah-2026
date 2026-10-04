import { useStepAdvance } from '@/features/onboarding/review/step-navigation';
import { OnboardingStepScreen } from '@/features/onboarding/step-screen';
import { PlacesStep } from '@/features/preferences/steps';
import { stepIsComplete, useOnboardingDraft } from '@/state/onboarding-draft';

/** 3.3 Places. */
export default function PlacesRoute() {
  const [draft, update] = useOnboardingDraft();
  const advance = useStepAdvance('places');
  return (
    <OnboardingStepScreen section="places" canContinue={stepIsComplete('places', draft)} onContinue={advance}>
      <PlacesStep draft={draft} update={update} mode="onboarding" />
    </OnboardingStepScreen>
  );
}
