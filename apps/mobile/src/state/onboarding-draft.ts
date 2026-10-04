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
import { anyTime, PREF_OPTIONS, PREFERRED_WINDOW_RANGE } from '@/lib/preference-options';

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
/**
 * A new person starts blank where the answer is personal (starting point, sports,
 * places, good to know) and from the planner's usual values where a slider needs a
 * position: three 20-minute sessions a week, any time of day.
 */
function defaults(): OnboardingDraft {
  return {
    starting_comfort: null,
    sessions_per_week: 3,
    session_minutes: 20,
    preferred_window: null,
    activity_interests: [],
    discovery_preference: 'occasional',
    available_locations: [],
    available_equipment: [],
    avoidances: [],
    starting_obstacles: [],
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

/* ------------------------------------------- Kept across a web redirect */

/**
 * On the web, connecting Google Calendar from Review sends the whole page to
 * Google, and this in-memory draft would be lost. Review keeps it in the
 * tab's sessionStorage just before the page leaves; the draft starts from it
 * when the page loads again (taken once, within 30 minutes). Phones keep the
 * app running, so there is nothing to keep there.
 */
const STASH_KEY = 'movo.onboarding-draft.v1';
const STASH_TTL_MS = 30 * 60_000;

/** The tab's sessionStorage on the web; null in React Native, the static render, or where it is blocked. */
function tabStorage(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isStringList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

/** Only values the options still offer survive, so an older stash can't put unknown answers in the draft. */
function known<V extends string>(options: readonly { value: V }[], values: unknown): V[] {
  if (!isStringList(values)) return [];
  return options.map((option) => option.value).filter((value) => values.includes(value));
}

/** A stashed draft, checked field by field; null when it isn't one. */
function parseStash(raw: string, now: number): OnboardingDraft | null {
  try {
    const stash = JSON.parse(raw) as { saved_at?: unknown; draft?: Record<string, unknown> };
    const value = stash.draft;
    if (!isNumber(stash.saved_at) || now - stash.saved_at > STASH_TTL_MS || !value || typeof value !== 'object') {
      return null;
    }
    const window = value.preferred_window;
    const base = defaults();
    return {
      starting_comfort: known(PREF_OPTIONS.starting_comfort, [value.starting_comfort])[0] ?? null,
      sessions_per_week: isNumber(value.sessions_per_week) ? value.sessions_per_week : base.sessions_per_week,
      session_minutes: isNumber(value.session_minutes) ? value.session_minutes : base.session_minutes,
      preferred_window:
        Array.isArray(window) && window.length === 2 && isNumber(window[0]) && isNumber(window[1])
          ? [window[0], window[1]]
          : null,
      // Catalog sports are open-ended slugs (`sport-42`): kept as strings.
      activity_interests: isStringList(value.activity_interests) ? value.activity_interests : [],
      discovery_preference:
        known(PREF_OPTIONS.discovery_preference, [value.discovery_preference])[0] ?? base.discovery_preference,
      available_locations: known(PREF_OPTIONS.available_locations, value.available_locations),
      available_equipment: known(PREF_OPTIONS.available_equipment, value.available_equipment),
      avoidances: known(PREF_OPTIONS.avoidances, value.avoidances),
      starting_obstacles: known(PREF_OPTIONS.starting_obstacles, value.starting_obstacles),
    };
  } catch {
    return null;
  }
}

/** The stashed draft, taken once: the stash is removed whether or not it was usable. */
function takeStash(): OnboardingDraft | null {
  const storage = tabStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(STASH_KEY);
    if (raw === null) return null;
    storage.removeItem(STASH_KEY);
    return parseStash(raw, Date.now());
  } catch {
    return null;
  }
}

let draft: OnboardingDraft = normalize(takeStash() ?? defaults());
const listeners = new Set<() => void>();

/** Review on the web, just before the page goes to Google: keep the draft for the page that loads next. */
export function stashDraftForRedirect(): void {
  try {
    tabStorage()?.setItem(STASH_KEY, JSON.stringify({ saved_at: Date.now(), draft }));
  } catch {
    // Storage full or blocked: the answers can be given again.
  }
}

/** The page didn't leave after all (the connect failed or was refused): forget the stash. */
export function dropStashedDraft(): void {
  try {
    tabStorage()?.removeItem(STASH_KEY);
  } catch {
    // Nothing to forget.
  }
}

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
