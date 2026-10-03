import { OnboardingStepScreen } from '@/features/onboarding/step-screen';
import { ActivitiesStep } from '@/features/preferences/steps';
import { stepIsComplete, useOnboardingDraft } from '@/state/onboarding-draft';

/** 3.2 Activities. No sport picked is a full answer: the plan helps explore. */
export default function ActivitiesRoute() {
  const [draft, update] = useOnboardingDraft();
  return (
    <OnboardingStepScreen section="activities" canContinue={stepIsComplete('activities', draft)}>
      <ActivitiesStep draft={draft} update={update} mode="onboarding" />
    </OnboardingStepScreen>
  );
}
