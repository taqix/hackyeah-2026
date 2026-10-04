import type { Href } from 'expo-router';

import type { PreferenceSection } from '@/api/types';

/** The questions in order; Review (4) follows and is not counted in "N of 5". */
export const ONBOARDING_ORDER: PreferenceSection[] = ['starting', 'time', 'activities', 'places', 'extras'];

export const onboardingRoute = (section: PreferenceSection): Href => `/onboarding/${section}`;

/** Where Continue goes from a step: the next question, or Review after the last one. */
export function nextOnboardingRoute(section: PreferenceSection): Href {
  const next = ONBOARDING_ORDER[ONBOARDING_ORDER.indexOf(section) + 1];
  return next ? onboardingRoute(next) : '/onboarding/review';
}

/** A step of the desktop wizard: the five questions, then Review. */
export type WizardStep = PreferenceSection | 'review';

export const WIZARD_STEPS: readonly WizardStep[] = [...ONBOARDING_ORDER, 'review'];

export const wizardRoute = (step: WizardStep): Href =>
  step === 'review' ? '/onboarding/review' : onboardingRoute(step);

/** A route segment as a wizard step, or null for anything else. */
export function asWizardStep(segment: string | undefined): WizardStep | null {
  return WIZARD_STEPS.find((step) => step === segment) ?? null;
}
