import { useStepAdvance } from '@/features/onboarding/review/step-navigation';
import { OnboardingStepScreen } from '@/features/onboarding/step-screen';
import { ExtrasStep } from '@/features/preferences/steps';
import { stepIsComplete, useOnboardingDraft } from '@/state/onboarding-draft';

/** 3.4 Good to know: both questions are optional; Skip saves [] for both and moves on. */
export default function ExtrasRoute() {
  const [draft, update] = useOnboardingDraft();
  const advance = useStepAdvance('extras');
  const skip = () => {
    update({ avoidances: [], starting_obstacles: [] });
    advance();
  };
  return (
    <OnboardingStepScreen
      section="extras"
      canContinue={stepIsComplete('extras', draft)}
      onContinue={advance}
      skip={{ onPress: skip, hint: 'Leaves both questions unanswered' }}>
      <ExtrasStep draft={draft} update={update} mode="onboarding" />
    </OnboardingStepScreen>
  );
}
