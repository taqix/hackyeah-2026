import { useGlobalSearchParams, useSegments } from 'expo-router';
import { useState } from 'react';

import { asWizardStep, WIZARD_STEPS, type WizardStep } from '@/features/onboarding/order';

export type WizardPosition = {
  /** The step on screen; null while the route is not one of them. */
  current: WizardStep | null;
  /** Index (in WIZARD_STEPS) of the furthest step reached since onboarding opened. */
  furthest: number;
  /** The step was opened from Review (?from=review), so it returns there. */
  fromReview: boolean;
};

/** Where the person is in the desktop wizard, read from the route. */
export function useWizardPosition(): WizardPosition {
  const segments = useSegments();
  const { from } = useGlobalSearchParams<{ from?: string }>();
  const current = asWizardStep(segments[segments.length - 1]);
  const index = current ? WIZARD_STEPS.indexOf(current) : -1;
  const [furthest, setFurthest] = useState(index);
  // Adjusted while rendering, so the rail never trails the step on screen.
  if (index > furthest) setFurthest(index);
  return { current, furthest: Math.max(furthest, index), fromReview: from === 'review' };
}
