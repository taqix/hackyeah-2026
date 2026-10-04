import type { OnboardingDraft } from '@/state/onboarding-draft';

/**
 * One onboarding step's questions, shared by onboarding (2–3.4) and Profile ›
 * Edit (9.4). The body renders only the questions; the screen around it owns
 * the top bar and the Continue or Save button.
 */
export type StepBodyProps = {
  draft: OnboardingDraft;
  update: (patch: Partial<OnboardingDraft>) => void;
  /** onboarding shows the step heading; edit sits under the Edit screen's own title. */
  mode: 'onboarding' | 'edit';
};
