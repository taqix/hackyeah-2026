/**
 * What the app knows about sports and gym exercises on its own, whatever the
 * backend: the slug IDs onboarding, icons and tips are keyed by, the copy the
 * catalog does not carry (description, suggested), and the gym exercise
 * library with the proposal fields the gym screens need (tracking, per side,
 * weight step, rest). The mock catalog is built from it, and the Supabase
 * adapter matches catalog rows to it by name. Pure: imported by Node tests.
 */
import type { ExerciseDefinition } from '../api/types';

export interface LibrarySport {
  /** The app's sport ID, e.g. `walking`. */
  slug: string;
  /** Matches the Supabase catalog `name`, case-insensitively. */
  name: string;
  description: string;
  /** Preview sports are listed but cannot be planned yet. */
  availability: 'working' | 'preview';
  /** One of the six suggested tags in onboarding. */
  suggested: boolean;
  is_gym: boolean;
  /** Preparation and wrap-up allowance, each side, seconds. Unset means the default (300). */
  buffer_seconds?: number;
}

const working = (slug: string, name: string, description: string, suggested: boolean, isGym = false): LibrarySport => ({
  slug,
  name,
  description,
  availability: 'working',
  suggested,
  is_gym: isGym,
});

const preview = (slug: string, name: string, description: string): LibrarySport => ({
  slug,
  name,
  description,
  availability: 'preview',
  suggested: false,
  is_gym: false,
});

/** Working sports first, in onboarding order, then the previews. */
export const SPORT_LIBRARY: readonly LibrarySport[] = [
  working('walking', 'Walking', 'Walks at your own pace, outdoors or on a treadmill.', true),
  working(
    'strength',
    'Strength',
    'Short guided strength sessions at home or at the gym, one exercise at a time.',
    true,
    true,
  ),
  working('running', 'Running', 'Walk-run intervals and easy runs at a pace where you can still talk.', true),
  working('cycling', 'Cycling', 'Easy rides outdoors or on a stationary bike.', true),
  working('swimming', 'Swimming', 'Easy lengths at your own pace, resting whenever you like.', true),
  working('mobility', 'Mobility', 'Gentle stretching, mostly standing, at home or anywhere.', true),
  working('football', 'Football', 'A kickabout or a game with friends.', false),
  preview('tennis', 'Tennis', 'Singles or doubles on a court.'),
  preview('table_tennis', 'Table tennis', 'Rallies across a table, indoors.'),
  preview('badminton', 'Badminton', 'Rallies with a shuttlecock, indoors.'),
  preview('padel', 'Padel', 'Doubles on a small walled court.'),
  preview('basketball', 'Basketball', 'Shooting hoops or a game with friends.'),
  preview('volleyball', 'Volleyball', 'A game on a court or on sand.'),
  preview('yoga', 'Yoga', 'Slow poses and breathing, at home or in a class.'),
  preview('pilates', 'Pilates', 'Slow, controlled moves for core strength.'),
  preview('dancing', 'Dancing', 'Moving to music, alone or in a class.'),
  preview('hiking', 'Hiking', 'Longer walks on trails and hills.'),
  preview('nordic_walking', 'Nordic walking', 'Walking with poles.'),
  preview('rowing', 'Rowing', 'On a rowing machine or on the water.'),
  preview('climbing', 'Climbing', 'Bouldering or roped climbing indoors.'),
  preview('ice_skating', 'Ice skating', 'Laps on an ice rink.'),
  preview('boxing', 'Boxing', 'Pad work and bag work, no sparring.'),
];

/** The gym exercise library. Plans name these IDs, so the app can show how each one is done. */
export const EXERCISES: ExerciseDefinition[] = [
  {
    id: 'brisk_walk',
    name: 'Brisk walk',
    description: 'Walk briskly on the treadmill or around the gym to warm up.',
    tracking: 'time',
    rest_seconds: 30,
  },
  {
    id: 'march_in_place',
    name: 'March in place',
    description: 'Lift your knees in turn at an easy pace, arms swinging. No jumping.',
    tracking: 'time',
    rest_seconds: 30,
  },
  {
    id: 'goblet_squat',
    name: 'Goblet squat',
    description: 'Hold the weight at your chest. Sit back as if into a chair, then stand.',
    tracking: 'reps',
    uses_weight: true,
    weight_step_kg: 2,
    rest_seconds: 60,
  },
  {
    id: 'chair_squat',
    name: 'Chair squat',
    description: 'Sit down onto a chair slowly, then stand up again without using your hands.',
    tracking: 'reps',
    rest_seconds: 60,
  },
  {
    id: 'wall_push_up',
    name: 'Wall push-up',
    description: 'Hands on a wall at shoulder height. Lower your chest to the wall, then push back.',
    tracking: 'reps',
    rest_seconds: 60,
  },
  {
    id: 'knee_push_up',
    name: 'Knee push-up',
    description: 'Knees on the floor, hands under your shoulders. Lower your chest, then push up.',
    tracking: 'reps',
    rest_seconds: 60,
  },
  {
    id: 'dumbbell_row',
    name: 'Dumbbell row',
    description: 'One hand on a bench, pull the weight up to your hip, then lower it slowly.',
    tracking: 'reps',
    per_side: true,
    uses_weight: true,
    weight_step_kg: 2,
    rest_seconds: 60,
  },
  {
    id: 'leg_press',
    name: 'Leg press',
    description: 'Push the platform away with both feet, then let it come back slowly.',
    tracking: 'reps',
    uses_weight: true,
    weight_step_kg: 5,
    rest_seconds: 90,
  },
  {
    id: 'glute_bridge',
    name: 'Glute bridge',
    description: 'Lie on your back with knees bent. Lift your hips, then lower them slowly.',
    tracking: 'reps',
    rest_seconds: 45,
  },
  {
    id: 'band_pull_apart',
    name: 'Band pull-apart',
    description: 'Hold the band at chest height and pull it apart, squeezing your shoulder blades.',
    tracking: 'reps',
    rest_seconds: 45,
  },
  {
    id: 'knee_plank',
    name: 'Knee plank',
    description: 'Knees down, body in one line from knees to head. Keep breathing.',
    tracking: 'time',
    rest_seconds: 45,
  },
  {
    id: 'easy_stretch',
    name: 'Easy stretch',
    description: 'Slow standing stretches for your legs, back and shoulders.',
    tracking: 'time',
    rest_seconds: 0,
  },
];

const normalizeName = (name: string) => name.trim().toLowerCase();

/** The library slug for a catalog sport name ("  running " → `running`), or null for a sport the app does not know. */
export function slugForSportName(name: string): string | null {
  const wanted = normalizeName(name);
  return SPORT_LIBRARY.find((sport) => normalizeName(sport.name) === wanted)?.slug ?? null;
}

export function librarySport(slug: string): LibrarySport | undefined {
  return SPORT_LIBRARY.find((sport) => sport.slug === slug);
}

export function libraryExercise(id: string): ExerciseDefinition | undefined {
  return EXERCISES.find((exercise) => exercise.id === id);
}
