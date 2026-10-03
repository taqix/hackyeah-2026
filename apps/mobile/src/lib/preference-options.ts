/**
 * Onboarding options and the one-line summaries of the answers
 * (design/prototype/onboarding.jsx PREF_OPTIONS, PREF_SLIDERS, prefSummary).
 * The app saves only option values; labels are copy. Pure: the mock backend
 * uses the same wording.
 */
import type {
  AvoidanceOption,
  DiscoveryPreference,
  EquipmentOption,
  LocationOption,
  ObstacleOption,
  PreferenceSection,
  Preferences,
  SportDefinition,
  StartingComfort,
} from '../api/types';
import { joinAnd, numberWord } from './dates';

/** Icon names used by the options; all exist in the kit's Icon set. */
export type PreferenceIcon =
  | 'footprints'
  | 'dumbbell'
  | 'wind'
  | 'bike'
  | 'waves'
  | 'person-standing'
  | 'house'
  | 'tree-pine'
  | 'building-2'
  | 'calendar-days'
  | 'timer'
  | 'clock'
  | 'sprout'
  | 'calendar-clock'
  | 'map-pin'
  | 'feather';

export interface PreferenceOption<V extends string> {
  value: V;
  label: string;
  description?: string;
  icon?: PreferenceIcon;
}

export interface ActivityOption extends PreferenceOption<string> {
  suggested?: boolean;
}

export const PREF_OPTIONS = {
  starting_comfort: [
    { value: 'starting_out', label: 'Starting from scratch', description: 'Little or no exercise lately' },
    { value: 'occasionally_active', label: 'Occasionally active', description: 'Some movement now and then' },
    { value: 'some_routine', label: 'Already have some routine', description: 'Moving most weeks' },
  ] satisfies PreferenceOption<StartingComfort>[],
  /** A sample of the catalog; the catalog itself comes from `useSports()`. */
  activity_interests: [
    { value: 'walking', label: 'Walk', icon: 'footprints', suggested: true },
    { value: 'strength', label: 'Strength (home or gym)', icon: 'dumbbell', suggested: true },
    { value: 'running', label: 'Run', icon: 'wind', suggested: true },
    { value: 'cycling', label: 'Bike', icon: 'bike', suggested: true },
    { value: 'swimming', label: 'Swim', icon: 'waves', suggested: true },
    { value: 'mobility', label: 'Mobility / stretching', icon: 'person-standing', suggested: true },
    { value: 'football', label: 'Football' },
    { value: 'tennis', label: 'Tennis' },
    { value: 'table_tennis', label: 'Table tennis' },
    { value: 'badminton', label: 'Badminton' },
    { value: 'padel', label: 'Padel' },
    { value: 'basketball', label: 'Basketball' },
    { value: 'volleyball', label: 'Volleyball' },
    { value: 'yoga', label: 'Yoga' },
    { value: 'pilates', label: 'Pilates' },
    { value: 'dancing', label: 'Dancing' },
    { value: 'hiking', label: 'Hiking' },
    { value: 'nordic_walking', label: 'Nordic walking' },
    { value: 'rowing', label: 'Rowing' },
    { value: 'climbing', label: 'Climbing' },
    { value: 'ice_skating', label: 'Ice skating' },
    { value: 'boxing', label: 'Boxing' },
  ] satisfies ActivityOption[] as ActivityOption[],
  discovery_preference: [
    { value: 'selected_only', label: 'Stick to my choices' },
    { value: 'occasional', label: 'Occasionally try something new' },
    { value: 'explore', label: 'Help me explore' },
  ] satisfies PreferenceOption<DiscoveryPreference>[],
  available_locations: [
    { value: 'home', label: 'Home', icon: 'house' },
    { value: 'outdoors', label: 'Outdoors', icon: 'tree-pine' },
    { value: 'gym', label: 'Gym', icon: 'building-2' },
    { value: 'pool', label: 'Swimming pool', icon: 'waves' },
  ] satisfies PreferenceOption<LocationOption>[],
  available_equipment: [
    { value: 'mat', label: 'Mat' },
    { value: 'resistance_band', label: 'Resistance band' },
    { value: 'dumbbells', label: 'Dumbbells' },
    { value: 'bicycle', label: 'Bicycle' },
    { value: 'stationary_bike', label: 'Stationary bike' },
  ] satisfies PreferenceOption<EquipmentOption>[],
  avoidances: [
    { value: 'jumping', label: 'Jumping' },
    { value: 'floor_exercises', label: 'Floor exercises' },
    { value: 'noisy_activities', label: 'Noisy activities' },
  ] satisfies PreferenceOption<AvoidanceOption>[],
  starting_obstacles: [
    { value: 'time', label: 'Finding time' },
    { value: 'low_energy', label: 'Low energy' },
    { value: 'boredom', label: 'Boredom' },
    { value: 'uncertainty', label: 'Not knowing what to do' },
    { value: 'discomfort', label: 'Feeling uncomfortable' },
  ] satisfies PreferenceOption<ObstacleOption>[],
};

/** The chip that saves `[]` for equipment. */
export const NO_EQUIPMENT_LABEL = 'No equipment';

/** Whole hours the planner uses, 7:00–21:00. */
export const PREFERRED_WINDOW_RANGE = { min: 7, max: 21, step: 1 } as const;

export interface SliderSpec<T> {
  label: string;
  icon: PreferenceIcon;
  range: { min: number; max: number; step: number };
  /** Ticks with a number under them; every step gets a short tick. */
  marks?: number[];
  format: (value: T) => string;
}

export const hourText = (h: number) => `${h}:00`;

/** True for null or the whole 7–21 bar. */
export function anyTime(window: [number, number] | null | undefined): boolean {
  return !window || (window[0] <= PREFERRED_WINDOW_RANGE.min && window[1] >= PREFERRED_WINDOW_RANGE.max);
}

/** '7:00–11:00', or 'Any time' for the whole range (saved as null). */
export function windowText(window: [number, number] | null | undefined): string {
  return anyTime(window) || !window ? 'Any time' : `${hourText(window[0])}–${hourText(window[1])}`;
}

export const PREF_SLIDERS = {
  sessions_per_week: {
    label: 'Sessions a week',
    icon: 'calendar-days',
    range: { min: 1, max: 7, step: 1 },
    format: (n: number) => `${n}${n === 1 ? ' day' : ' days'} a week`,
  } satisfies SliderSpec<number>,
  session_minutes: {
    label: 'Minutes a session',
    icon: 'timer',
    range: { min: 5, max: 60, step: 5 },
    marks: [5, 10, 20, 30, 40, 50, 60],
    format: (m: number) => `${m} min`,
  } satisfies SliderSpec<number>,
  preferred_window: {
    label: 'Time of day',
    icon: 'clock',
    range: { ...PREFERRED_WINDOW_RANGE },
    marks: [7, 9, 11, 13, 15, 17, 19, 21],
    format: (w: [number, number] | null) => windowText(w),
  } satisfies SliderSpec<[number, number] | null>,
};

type OptionField = Exclude<keyof typeof PREF_OPTIONS, 'activity_interests'>;

/** The label of one option value. */
export function optionLabel(field: OptionField, value: string): string {
  const options: PreferenceOption<string>[] = PREF_OPTIONS[field];
  return options.find((o) => o.value === value)?.label ?? value;
}

/** A sport's name: the catalog's when given, else the onboarding label. */
export function activityLabel(id: string, sports?: SportDefinition[] | null): string {
  return (
    PREF_OPTIONS.activity_interests.find((o) => o.value === id)?.label ??
    sports?.find((s) => s.id === id)?.name ??
    id
  );
}

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** Joined labels in sentence case: "Outdoors, home"; `allLower` lowercases the first too. */
function listOf(labels: string[], allLower = false): string {
  return labels.map((l, i) => (i || allLower ? lower(l) : l)).join(', ');
}

/** No sport picked means "explore", whatever was chosen before. */
export function effectiveDiscovery(prefs: Pick<Preferences, 'activity_interests' | 'discovery_preference'>) {
  return prefs.activity_interests.length ? prefs.discovery_preference : 'explore';
}

/** The answer fields the summaries read; a draft or saved preferences both fit. */
export type PreferenceAnswers = Pick<
  Preferences,
  | 'sessions_per_week'
  | 'session_minutes'
  | 'preferred_window'
  | 'activity_interests'
  | 'discovery_preference'
  | 'available_locations'
  | 'available_equipment'
  | 'avoidances'
  | 'starting_obstacles'
> & { starting_comfort: StartingComfort | null };

export interface SectionSummary {
  value: string;
  detail: string | null;
}

/** One row of the Review (4), per step: "3 days a week · 20 min" over "7:00–11:00". */
export function sectionSummary(
  section: PreferenceSection,
  prefs: PreferenceAnswers,
  sports?: SportDefinition[] | null,
): SectionSummary {
  switch (section) {
    case 'starting':
      return {
        value: prefs.starting_comfort ? optionLabel('starting_comfort', prefs.starting_comfort) : 'Not answered yet',
        detail: null,
      };
    case 'time': {
      const n = prefs.sessions_per_week;
      return {
        value: `${n}${n === 1 ? ' day' : ' days'} a week · ${prefs.session_minutes} min`,
        detail: windowText(prefs.preferred_window),
      };
    }
    case 'activities':
      return {
        value: prefs.activity_interests.length
          ? listOf(prefs.activity_interests.map((id) => activityLabel(id, sports)))
          : 'Not sure yet',
        detail: optionLabel('discovery_preference', effectiveDiscovery(prefs)),
      };
    case 'places':
      return {
        value: listOf(prefs.available_locations.map((v) => optionLabel('available_locations', v))),
        detail: prefs.available_equipment.length
          ? listOf(prefs.available_equipment.map((v) => optionLabel('available_equipment', v)))
          : NO_EQUIPMENT_LABEL,
      };
    case 'extras': {
      const avoid = prefs.avoidances;
      const hard = prefs.starting_obstacles;
      return {
        value: avoid.length
          ? `Avoid ${listOf(avoid.map((v) => optionLabel('avoidances', v)), true)}`
          : 'Nothing to avoid',
        detail: hard.length ? `Hardest: ${listOf(hard.map((v) => optionLabel('starting_obstacles', v)), true)}` : null,
      };
    }
  }
}

const DISCOVERY_SHORT: Record<DiscoveryPreference, string> = {
  selected_only: 'only these',
  occasional: 'new ideas now and then',
  explore: 'help me explore',
};

/** The You tab's one line per step (9): "Walk, run · new ideas now and then". */
export function sectionLine(
  section: PreferenceSection,
  prefs: PreferenceAnswers,
  sports?: SportDefinition[] | null,
): string {
  const s = sectionSummary(section, prefs, sports);
  switch (section) {
    case 'starting':
      return s.value;
    case 'time':
      return `${s.value} · ${s.detail === 'Any time' ? 'any time' : s.detail}`;
    case 'activities': {
      const names = prefs.activity_interests.length
        ? listOf(prefs.activity_interests.map((id) => activityLabel(id, sports).split(' (')[0]))
        : 'Not sure yet';
      return `${names} · ${DISCOVERY_SHORT[effectiveDiscovery(prefs)]}`;
    }
    case 'places':
      return `${s.value} · ${lower(s.detail ?? NO_EQUIPMENT_LABEL)}`;
    case 'extras':
      return s.detail ? `${s.value} · ${lower(s.detail)}` : s.value;
  }
}

/** Short lowercase sport names for a sentence: "walk and run". */
const SENTENCE_NAME: Record<string, string> = {
  walking: 'walk',
  running: 'run',
  cycling: 'bike',
  swimming: 'swim',
  strength: 'strength',
  mobility: 'stretching',
};

/** 'walk and run, three days a week, 20 minutes, between 7:00 and 11:00'. */
export function answersSentence(prefs: PreferenceAnswers, sports?: SportDefinition[] | null): string {
  const what = prefs.activity_interests.length
    ? joinAnd(prefs.activity_interests.map((id) => SENTENCE_NAME[id] ?? lower(activityLabel(id, sports))))
    : 'something new to explore';
  const n = prefs.sessions_per_week;
  const days = `${numberWord(n)} ${n === 1 ? 'day' : 'days'} a week`;
  const when =
    anyTime(prefs.preferred_window) || !prefs.preferred_window
      ? 'any time of day'
      : `between ${hourText(prefs.preferred_window[0])} and ${hourText(prefs.preferred_window[1])}`;
  return `${what}, ${days}, ${prefs.session_minutes} minutes, ${when}`;
}

/** Review and You rows: icon and label per step. */
export const SECTION_META: Record<PreferenceSection, { label: string; icon: PreferenceIcon }> = {
  starting: { label: 'Starting point', icon: 'sprout' },
  time: { label: 'Time', icon: 'calendar-clock' },
  activities: { label: 'Activities', icon: 'footprints' },
  places: { label: 'Places', icon: 'map-pin' },
  extras: { label: 'Good to know', icon: 'feather' },
};

export const PREFERENCE_SECTIONS: PreferenceSection[] = ['starting', 'time', 'activities', 'places', 'extras'];

/** Ana's answers (design/prototype/onboarding.jsx SAMPLE_PREFS). */
export const SAMPLE_PREFS: Preferences = {
  timezone: 'Europe/Warsaw',
  starting_comfort: 'starting_out',
  sessions_per_week: 3,
  session_minutes: 20,
  activity_interests: ['walking', 'running'],
  available_locations: ['outdoors', 'home'],
  available_equipment: [],
  preferred_window: [7, 11],
  discovery_preference: 'occasional',
  avoidances: ['jumping'],
  starting_obstacles: ['time'],
  excluded_activity_types: [],
};
