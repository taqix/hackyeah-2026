import { useRouter } from 'expo-router';

import { onboardingRoute, WIZARD_STEPS, type WizardStep, wizardRoute } from '@/features/onboarding/order';
import { reviewStepRoute } from '@/features/onboarding/review/step-navigation';

import type { WizardPosition } from './position';

/**
 * A jump from the rail. Once Review is in the stack, a step opens above it
 * (like Review's own rows) so its Continue comes straight back; before that,
 * an earlier step is popped back to and a later one is pushed.
 */
export function useWizardJump({ current, fromReview }: WizardPosition): (target: WizardStep) => void {
  const router = useRouter();
  return (target) => {
    if (!current || target === current) return;
    if (target === 'review') {
      // A step opened from Review sits right above it.
      if (fromReview && router.canGoBack()) router.back();
      else router.push(wizardRoute('review'));
      return;
    }
    if (current === 'review') router.push(reviewStepRoute(target));
    else if (fromReview) router.replace(reviewStepRoute(target));
    else if (WIZARD_STEPS.indexOf(target) < WIZARD_STEPS.indexOf(current)) router.dismissTo(onboardingRoute(target));
    else router.push(onboardingRoute(target));
  };
}

/**
 * The desktop card's Back: Review for a step opened from there, otherwise the
 * previous step (popped back to, or put in place of this one after a jump).
 * None on the first step.
 */
export function useWizardBack(step: WizardStep, fromReview: boolean): (() => void) | undefined {
  const router = useRouter();
  if (fromReview) {
    return () => {
      if (router.canGoBack()) router.back();
      else router.replace(wizardRoute('review'));
    };
  }
  const previous = WIZARD_STEPS[WIZARD_STEPS.indexOf(step) - 1];
  if (!previous) return undefined;
  return () => router.dismissTo(wizardRoute(previous));
}
