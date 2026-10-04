// Mirrors EXERCISES in apps/mobile/src/api/mock/catalog.ts. The app enriches planned gym
// exercises by these IDs, so keep both lists in step when one changes.
export interface LibraryExercise {
  id: string;
  name: string;
  description: string;
  uses_weight: boolean;
  tracking: 'reps' | 'time';
  // What the exercise needs, written for the model to match against the preferences.
  needs: string;
}

export const EXERCISE_LIBRARY: readonly LibraryExercise[] = [
  {
    id: 'brisk_walk',
    name: 'Brisk walk',
    description: 'Walk briskly on the treadmill or around the gym to warm up.',
    uses_weight: false,
    tracking: 'time',
    needs: 'space to walk',
  },
  {
    id: 'march_in_place',
    name: 'March in place',
    description: 'Lift your knees in turn at an easy pace, arms swinging. No jumping.',
    uses_weight: false,
    tracking: 'time',
    needs: 'nothing',
  },
  {
    id: 'goblet_squat',
    name: 'Goblet squat',
    description: 'Hold the weight at your chest. Sit back as if into a chair, then stand.',
    uses_weight: true,
    tracking: 'reps',
    needs: 'dumbbells in available_equipment, or the gym location',
  },
  {
    id: 'chair_squat',
    name: 'Chair squat',
    description: 'Sit down onto a chair slowly, then stand up again without using your hands.',
    uses_weight: false,
    tracking: 'reps',
    needs: 'a chair (home or gym)',
  },
  {
    id: 'wall_push_up',
    name: 'Wall push-up',
    description:
      'Hands on a wall at shoulder height. Lower your chest to the wall, then push back.',
    uses_weight: false,
    tracking: 'reps',
    needs: 'a wall (home or gym)',
  },
  {
    id: 'knee_push_up',
    name: 'Knee push-up',
    description: 'Knees on the floor, hands under your shoulders. Lower your chest, then push up.',
    uses_weight: false,
    tracking: 'reps',
    needs: 'floor space; not allowed with the floor_exercises avoidance',
  },
  {
    id: 'dumbbell_row',
    name: 'Dumbbell row',
    description: 'One hand on a bench, pull the weight up to your hip, then lower it slowly.',
    uses_weight: true,
    tracking: 'reps',
    needs: 'dumbbells and a bench: the gym location, or dumbbells in available_equipment',
  },
  {
    id: 'leg_press',
    name: 'Leg press',
    description: 'Push the platform away with both feet, then let it come back slowly.',
    uses_weight: true,
    tracking: 'reps',
    needs: 'a leg press machine: the gym location only',
  },
  {
    id: 'glute_bridge',
    name: 'Glute bridge',
    description: 'Lie on your back with knees bent. Lift your hips, then lower them slowly.',
    uses_weight: false,
    tracking: 'reps',
    needs: 'floor space; not allowed with the floor_exercises avoidance',
  },
  {
    id: 'band_pull_apart',
    name: 'Band pull-apart',
    description: 'Hold the band at chest height and pull it apart, squeezing your shoulder blades.',
    uses_weight: false,
    tracking: 'reps',
    needs: 'resistance_band in available_equipment',
  },
  {
    id: 'knee_plank',
    name: 'Knee plank',
    description: 'Knees down, body in one line from knees to head. Keep breathing.',
    uses_weight: false,
    tracking: 'time',
    needs: 'floor space',
  },
  {
    id: 'easy_stretch',
    name: 'Easy stretch',
    description: 'Slow standing stretches for your legs, back and shoulders.',
    uses_weight: false,
    tracking: 'time',
    needs: 'nothing',
  },
];

// Planned sets only carry repetitions; timed sets are deferred, so timed exercises stay out
// of generated plans and warm-ups and cool-downs live in the session description.
export const PLANNABLE_EXERCISES = EXERCISE_LIBRARY.filter(
  (exercise) => exercise.tracking === 'reps',
);
