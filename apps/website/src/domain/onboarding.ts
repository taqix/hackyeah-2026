/* The app's onboarding as the landing page shows it: how many questions it asks, and the
   answers to the first one. The hero card and the onboarding mockup both read it, so they
   cannot drift apart. It mirrors apps/mobile (features/onboarding/step-screen.tsx and
   lib/preference-options.ts); change them together. */

export type ComfortValue = "scratch" | "occasional" | "routine";

/** One answer to "How does starting feel?". */
export interface ComfortOption {
  value: ComfortValue;
  label: string;
  description: string;
  icon: string;
}

/** The questions before Review, as the app counts them in "1 of 5". */
export const ONBOARDING_QUESTIONS = 5;

export const COMFORT_OPTIONS: ComfortOption[] = [
  { value: "scratch", label: "Starting from scratch", description: "Little or no exercise lately", icon: "armchair" },
  { value: "occasional", label: "Occasionally active", description: "Some movement now and then", icon: "footprints" },
  { value: "routine", label: "Already have some routine", description: "Moving most weeks", icon: "calendar-check" },
];
