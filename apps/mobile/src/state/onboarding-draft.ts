/**
 * The onboarding answers while they are being given (2–4), and while Profile ›
 * Edit changes one section (9.4). A module store, so every step reads the same
 * draft; the rules from design/README.md › Onboarding preferences are applied
 * on every update.
 */
import { useSyncExternalStore } from 'react';

import type {
  AvoidanceOption,
  DiscoveryPreference,
  EquipmentOption,
  LocationOption,
  ObstacleOption,
  PreferenceSection,
  Preferences,
  StartingComfort,
} from '@/api/types';
import { anyTime, PREFERRED_WINDOW_RANGE, SAMPLE_PREFS } from '@/lib/preference-options';

export interface OnboardingDraft {
  starting_comfort: StartingComfort | null;
  sessions_per_week: number;
  session_minutes: number;
  /** Null means any time. */
  preferred_window: [number, number] | null;
  activity_interests: string[];
  /** What was picked; `effectiveDiscovery` forces explore while no sport is picked. */
  discovery_preference: DiscoveryPreference;
  available_locations: LocationOption[];
  available_equipment: EquipmentOption[];
  avoidances: AvoidanceOption[];
  starting_obstacles: ObstacleOption[];
}

/** The prototype opens every step with the sample answers (onboarding.jsx usePrefs). */
function defaults(): OnboardingDraft {
  return {
    starting_comfort: SAMPLE_PREFS.starting_comfort,
    sessions_per_week: SAMPLE_PREFS.sessions_per_week,
    session_minutes: SAMPLE_PREFS.session_minutes,
    preferred_window: SAMPLE_PREFS.preferred_window,
    activity_interests: [...SAMPLE_PREFS.activity_interests],
    discovery_preference: SAMPLE_PREFS.discovery_preference,
    available_locations: [...SAMPLE_PREFS.available_locations],
    available_equipment: [...SAMPLE_PREFS.available_equipment],
    avoidances: [...SAMPLE_PREFS.avoidances],
    starting_obstacles: [...SAMPLE_PREFS.starting_obstacles],
  };
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Whole hours inside 7–21, at least an hour wide; the whole bar is null. */
export function normalizeWindow(window: [number, number] | null): [number, number] | null {
  if (!window) return null;
  const { min, max } = PREFERRED_WINDOW_RANGE;
  let start = clamp(Math.round(window[0]), min, max - 1);
  let end = clamp(Math.round(window[1]), min + 1, max);
  if (end - start < 1) {
    if (start + 1 <= max) end = start + 1;
    else start = end - 1;
  }
  const normalized: [number, number] = [start, end];
  return anyTime(normalized) ? null : normalized;
}

function normalize(draft: OnboardingDraft): OnboardingDraft {
  return {
    ...draft,
    sessions_per_week: clamp(Math.round(draft.sessions_per_week), 1, 7),
    session_minutes: clamp(Math.round(draft.session_minutes / 5) * 5, 5, 60),
    preferred_window: normalizeWindow(draft.preferred_window),
    activity_interests: [...new Set(draft.activity_interests)],
    available_locations: [...new Set(draft.available_locations)],
    available_equipment: [...new Set(draft.available_equipment)],
    avoidances: [...new Set(draft.avoidances)],
    starting_obstacles: [...new Set(draft.starting_obstacles)],
  };
}

let draft: OnboardingDraft = defaults();
const listeners = new Set<() => void>();

function setDraft(next: OnboardingDraft) {
  draft = normalize(next);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The current draft outside React. */
export function getDraft(): OnboardingDraft {
  return draft;
}

/** Merge a patch into the draft (normalized: window rules, step ranges, no duplicates). */
export function updateDraft(patch: Partial<OnboardingDraft>): void {
  setDraft({ ...draft, ...patch });
}

/** [draft, update]: every onboarding step and Profile › Edit read and write the same draft. */
export function useOnboardingDraft(): [OnboardingDraft, (patch: Partial<OnboardingDraft>) => void] {
  const current = useSyncExternalStore(subscribe, getDraft, getDraft);
  return [current, updateDraft];
}

/** Adds the value if missing, removes it if present. */
export function toggleValue<T>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
}

/** No sport picked: discovery is explore and the other two options are disabled. */
export function discoveryLocked(d: Pick<OnboardingDraft, 'activity_interests'>): boolean {
  return d.activity_interests.length === 0;
}

/** Whether a step's Continue (or Save) is enabled. */
export function stepIsComplete(section: PreferenceSection, d: OnboardingDraft): boolean {
  switch (section) {
    case 'starting':
      return d.starting_comfort !== null;
    case 'places':
      return d.available_locations.length > 0;
    case 'time':
    case 'activities':
    case 'extras':
      return true;
  }
}

/** The device's IANA time zone, or Europe/Warsaw where Intl can't tell. */
export function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Warsaw';
  } catch {
    return 'Europe/Warsaw';
  }
}

/** The answers to save: timezone from the device, discovery forced to explore with no sport. */
export function draftToPreferences(d: OnboardingDraft = draft, base?: Preferences | null): Preferences {
  return {
    timezone: deviceTimezone(),
    starting_comfort: d.starting_comfort ?? 'starting_out',
    sessions_per_week: d.sessions_per_week,
    session_minutes: d.session_minutes,
    preferred_window: normalizeWindow(d.preferred_window),
    activity_interests: [...d.activity_interests],
    discovery_preference: discoveryLocked(d) ? 'explore' : d.discovery_preference,
    available_locations: [...d.available_locations],
    available_equipment: [...d.available_equipment],
    avoidances: [...d.avoidances],
    starting_obstacles: [...d.starting_obstacles],
    excluded_activity_types: base ? [...base.excluded_activity_types] : [],
  };
}

/** Fill the draft from saved answers (Profile › Edit). */
export function loadDraft(prefs: Preferences): void {
  setDraft({
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
  });
}

/** Back to the first-open answers. */
export function resetDraft(): void {
  setDraft(defaults());
}
