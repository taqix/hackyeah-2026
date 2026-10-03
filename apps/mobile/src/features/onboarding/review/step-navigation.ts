import { type Href, useLocalSearchParams, useRouter } from 'expo-router';

import type { PreferenceSection } from '@/api/types';
import { nextOnboardingRoute } from '@/features/onboarding/step-screen';

/** A step opened from a Review row; `from=review` lets that step come straight back. */
export function reviewStepRoute(section: PreferenceSection): Href {
  return { pathname: `/onboarding/${section}`, params: { from: 'review' } };
}

/**
 * Where a step goes next: back to Review when it was opened from there,
 * otherwise on to the next question (or Review after the last one).
 */
export function useStepAdvance(section: PreferenceSection): () => void {
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  return () => {
    if (from === 'review' && router.canGoBack()) router.back();
    else router.push(nextOnboardingRoute(section));
  };
}
