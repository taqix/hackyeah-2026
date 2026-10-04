import { useLocalSearchParams } from 'expo-router';
import type { ReactNode } from 'react';

import type { PreferenceSection } from '@/api/types';
import { Col } from '@/components/layout';
import { useStepAdvance } from '@/features/onboarding/review/step-navigation';

import { type WizardSkip, WizardActions } from './actions';
import { StepAside } from './aside';
import { useWizardBack } from './navigation';
import { WizardStage } from './stage';
import { useEnterToContinue } from './use-enter-to-continue';

export type DesktopStepScreenProps = {
  section: PreferenceSection;
  children: ReactNode;
  canContinue: boolean;
  onContinue?: () => void;
  skip?: WizardSkip;
};

/**
 * A question step on the desktop web: the questions in a card with Back and
 * Continue at its end (Enter continues), "why we ask" beside it.
 */
export function DesktopStepScreen({ section, children, canContinue, onContinue, skip }: DesktopStepScreenProps) {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const advance = useStepAdvance(section);
  const proceed = onContinue ?? advance;
  const back = useWizardBack(section, from === 'review');
  useEnterToContinue(canContinue, proceed);

  return (
    <WizardStage step={section} aside={<StepAside section={section} />}>
      <Col gap={32}>{children}</Col>
      <WizardActions
        onBack={back}
        skip={skip}
        primaryLabel="Continue"
        onPrimary={proceed}
        disabled={!canContinue}
      />
    </WizardStage>
  );
}
