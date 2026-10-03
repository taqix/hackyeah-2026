/**
 * The mock sport catalog, in the contract's shape (codex/gemini-plan-contract ›
 * Sport catalog). IDs match onboarding's PREF_OPTIONS. Working sports can be
 * planned; preview sports are listed but not planned yet. `strength` is the
 * guided gym sport (is_gym 1); its exercises carry the proposal fields the
 * gym screens need (tracking, per side, weight step, rest).
 */
import type { ExerciseDefinition, SportDefinition, SportMetric } from '../types';

const duration = (description = 'Time'): SportMetric => ({
  key: 'duration',
  description,
  required: true,
  unit: 'min',
  represents_session_duration: true,
  value_schema: { type: 'integer', minimum: 1 },
});

const distanceKm = (): SportMetric => ({
  key: 'distance',
  description: 'Distance',
  required: false,
  unit: 'km',
  value_schema: { type: 'number', minimum: 0 },
});

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

const preview = (id: string, name: string, description: string, extra: SportMetric[] = []): SportDefinition => ({
  id,
  name,
  description,
  availability: 'preview',
  is_gym: 0,
  metrics: [duration(), ...extra],
});

export const SPORTS: SportDefinition[] = [
  {
    id: 'walking',
    name: 'Walking',
    description: 'Walks at your own pace, outdoors or on a treadmill.',
    availability: 'working',
    suggested: true,
    is_gym: 0,
    metrics: [duration(), distanceKm()],
  },
  {
    id: 'strength',
    name: 'Strength',
    description: 'Short guided strength sessions at home or at the gym, one exercise at a time.',
    availability: 'working',
    suggested: true,
    is_gym: 1,
    exercises: EXERCISES,
  },
  {
    id: 'running',
    name: 'Running',
    description: 'Walk-run intervals and easy runs at a pace where you can still talk.',
    availability: 'working',
    suggested: true,
    is_gym: 0,
    metrics: [duration(), distanceKm()],
  },
  {
    id: 'cycling',
    name: 'Cycling',
    description: 'Easy rides outdoors or on a stationary bike.',
    availability: 'working',
    suggested: true,
    is_gym: 0,
    metrics: [
      duration(),
      distanceKm(),
      { key: 'indoor', description: 'On a stationary bike', required: false, value_schema: { type: 'boolean' } },
    ],
  },
  {
    id: 'swimming',
    name: 'Swimming',
    description: 'Easy lengths at your own pace, resting whenever you like.',
    availability: 'working',
    suggested: true,
    is_gym: 0,
    metrics: [
      duration('Time in the water'),
      { key: 'distance', description: 'Distance', required: false, unit: 'm', value_schema: { type: 'integer', minimum: 0 } },
    ],
  },
  {
    id: 'mobility',
    name: 'Mobility',
    description: 'Gentle stretching, mostly standing, at home or anywhere.',
    availability: 'working',
    suggested: true,
    is_gym: 0,
    metrics: [duration()],
  },
  {
    id: 'football',
    name: 'Football',
    description: 'A kickabout or a game with friends.',
    availability: 'working',
    is_gym: 0,
    metrics: [duration()],
  },
  preview('tennis', 'Tennis', 'Singles or doubles on a court.', [
    {
      key: 'format',
      description: 'Played',
      required: false,
      value_schema: { type: 'string', enum: ['Singles', 'Doubles'] },
    },
  ]),
  preview('table_tennis', 'Table tennis', 'Rallies across a table, indoors.'),
  preview('badminton', 'Badminton', 'Rallies with a shuttlecock, indoors.'),
  preview('padel', 'Padel', 'Doubles on a small walled court.'),
  preview('basketball', 'Basketball', 'Shooting hoops or a game with friends.'),
  preview('volleyball', 'Volleyball', 'A game on a court or on sand.'),
  preview('yoga', 'Yoga', 'Slow poses and breathing, at home or in a class.'),
  preview('pilates', 'Pilates', 'Slow, controlled moves for core strength.'),
  preview('dancing', 'Dancing', 'Moving to music, alone or in a class.'),
  preview('hiking', 'Hiking', 'Longer walks on trails and hills.', [distanceKm()]),
  preview('nordic_walking', 'Nordic walking', 'Walking with poles.', [distanceKm()]),
  preview('rowing', 'Rowing', 'On a rowing machine or on the water.', [distanceKm()]),
  preview('climbing', 'Climbing', 'Bouldering or roped climbing indoors.'),
  preview('ice_skating', 'Ice skating', 'Laps on an ice rink.'),
  preview('boxing', 'Boxing', 'Pad work and bag work, no sparring.'),
];

export function findSport(id: string, catalog: SportDefinition[] = SPORTS): SportDefinition | undefined {
  return catalog.find((s) => s.id === id);
}

export function findExercise(id: string): ExerciseDefinition | undefined {
  return EXERCISES.find((e) => e.id === id);
}
