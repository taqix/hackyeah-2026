import type { PreferenceSection, Preferences } from '@/api/types';
import { PREFERENCE_SECTIONS } from '@/lib/preference-options';
import { normalizeWindow, type OnboardingDraft } from '@/state/onboarding-draft';

/** The `section` route param, if it names one of the five steps. */
export function asPreferenceSection(value: string | string[] | undefined): PreferenceSection | null {
  const section = Array.isArray(value) ? value[0] : value;
  return PREFERENCE_SECTIONS.find((s) => s === section) ?? null;
}

/** Saved answers as an editable draft (Profile › Edit keeps its own copy, not the onboarding store). */
export function draftFromPreferences(prefs: Preferences): OnboardingDraft {
  return {
    starting_comfort: prefs.starting_comfort,
    sessions_per_week: prefs.sessions_per_week,
    session_minutes: prefs.session_minutes,
    preferred_window: prefs.preferred_window,
    activity_interests: [...prefs.activity_interests],
    discovery_preference: prefs.discovery_preference,
    available_locations: [...prefs.available_locations],
    available_equipment: [...prefs.available_equipment],
    avoidances: [...prefs.avoidances],
    starting_obstacles: [...prefs.starting_obstacles],
  };
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const unique = <T>(values: T[]) => [...new Set(values)];

/** Merge a patch with the onboarding store's rules: step ranges, the window rules, no duplicates. */
export function patchDraft(draft: OnboardingDraft, patch: Partial<OnboardingDraft>): OnboardingDraft {
  const next = { ...draft, ...patch };
  return {
    ...next,
    sessions_per_week: clamp(Math.round(next.sessions_per_week), 1, 7),
    session_minutes: clamp(Math.round(next.session_minutes / 5) * 5, 5, 60),
    preferred_window: normalizeWindow(next.preferred_window),
    activity_interests: unique(next.activity_interests),
    available_locations: unique(next.available_locations),
    available_equipment: unique(next.available_equipment),
    avoidances: unique(next.avoidances),
    starting_obstacles: unique(next.starting_obstacles),
  };
}
