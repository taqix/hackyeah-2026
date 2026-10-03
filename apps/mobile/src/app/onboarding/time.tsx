import { OnboardingStepScreen } from '@/features/onboarding/step-screen';
import { TimeStep } from '@/features/preferences/steps';
import { stepIsComplete, useOnboardingDraft } from '@/state/onboarding-draft';

/** 3.1 Time. */
export default function TimeRoute() {
  const [draft, update] = useOnboardingDraft();
  return (
    <OnboardingStepScreen section="time" canContinue={stepIsComplete('time', draft)}>
      <TimeStep draft={draft} update={update} mode="onboarding" />
    </OnboardingStepScreen>
  );
}
