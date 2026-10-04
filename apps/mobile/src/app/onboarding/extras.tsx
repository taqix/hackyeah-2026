import { Button } from '@/components/ui';
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
      right={
        <Button
          variant="ghost"
          size="sm"
          onPress={skip}
          accessibilityHint="Leaves both questions unanswered"
          style={{ marginRight: -8 }}>
          Skip
        </Button>
      }>
      <ExtrasStep draft={draft} update={update} mode="onboarding" />
    </OnboardingStepScreen>
  );
}
