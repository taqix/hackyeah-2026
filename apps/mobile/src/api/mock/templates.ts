/**
 * Session templates in the design's voice: titles, descriptions that never
 * claim progress, ordered parts for non-gym sports, and gym exercises with sets
 * and repetitions (never a weight). Shared by the planner and the coach.
 */
import { capitalize, numberWord } from '../../lib/dates';
import type { GymExercise, PlannedSession, Preferences, WorkoutDetails } from '../types';
import { findExercise } from './catalog';

export type TemplateKey =
  | 'brisk_walk'
  | 'easy_walk'
  | 'hill_walk'
  | 'short_walk'
  | 'walk_run'
  | 'easy_run'
  | 'bike_ride'
  | 'indoor_ride'
  | 'easy_swim'
  | 'stretching'
  | 'kickabout'
  | 'gym_basics'
  | 'home_strength';

export interface Workout {
  sport_id: string;
  title: string;
  description: string;
  details: WorkoutDetails;
}

interface TemplateMeta {
  sport_id: string;
  title: string;
  /** For week summaries: "a walk-run", "walk-runs". */
  one: string;
  many: string;
}

export const TEMPLATES: Record<TemplateKey, TemplateMeta> = {
  brisk_walk: { sport_id: 'walking', title: 'Brisk walk', one: 'a brisk walk', many: 'brisk walks' },
  easy_walk: { sport_id: 'walking', title: 'Easy walk', one: 'an easy walk', many: 'easy walks' },
  hill_walk: { sport_id: 'walking', title: 'Hill walk', one: 'a hill walk', many: 'hill walks' },
  short_walk: { sport_id: 'walking', title: 'Short walk', one: 'a short walk', many: 'short walks' },
  walk_run: { sport_id: 'running', title: 'Walk-run intervals', one: 'a walk-run', many: 'walk-runs' },
  easy_run: { sport_id: 'running', title: 'Easy run', one: 'an easy run', many: 'easy runs' },
  bike_ride: { sport_id: 'cycling', title: 'Easy bike ride', one: 'a bike ride', many: 'bike rides' },
  indoor_ride: { sport_id: 'cycling', title: 'Easy indoor ride', one: 'an indoor ride', many: 'indoor rides' },
  easy_swim: { sport_id: 'swimming', title: 'Easy swim', one: 'a swim', many: 'swims' },
  stretching: { sport_id: 'mobility', title: 'Gentle stretching', one: 'a stretch', many: 'stretches' },
  kickabout: { sport_id: 'football', title: 'Kickabout', one: 'a kickabout', many: 'kickabouts' },
  gym_basics: { sport_id: 'strength', title: 'Gym basics, slowly', one: 'a gym session', many: 'gym sessions' },
  home_strength: { sport_id: 'strength', title: 'Strength at home', one: 'a strength session', many: 'strength sessions' },
};

/** The template a session was made from, by its title. */
export function templateOf(session: Pick<PlannedSession, 'title' | 'sport_id'>): TemplateKey | null {
  const key = (Object.keys(TEMPLATES) as TemplateKey[]).find((k) => TEMPLATES[k].title === session.title);
  return key ?? null;
}

/** "a walk-run" / "walk-runs" for any session. */
export function nounOf(session: Pick<PlannedSession, 'title' | 'sport_id'>): { one: string; many: string } {
  const key = templateOf(session);
  if (key) return TEMPLATES[key];
  const lower = session.title.toLowerCase();
  return { one: `a ${lower}`, many: `${lower}s` };
}

const has = <T>(list: readonly T[], value: T) => list.includes(value);

/** Whether the person can do this sport with their places and equipment (the planner's check). */
export function canDo(sportId: string, prefs: Preferences): boolean {
  const loc = prefs.available_locations;
  const eq = prefs.available_equipment;
  switch (sportId) {
    case 'walking':
    case 'running':
      return has(loc, 'outdoors') || has(loc, 'gym');
    case 'cycling':
      return (has(loc, 'outdoors') && has(eq, 'bicycle')) || has(eq, 'stationary_bike');
    case 'swimming':
      return has(loc, 'pool');
    case 'mobility':
      return true;
    case 'strength':
      return has(loc, 'home') || has(loc, 'gym');
    case 'football':
      return has(loc, 'outdoors');
    default:
      return false;
  }
}

/** The template for the n-th session of a sport, so weeks vary. */
export function templateForSport(sportId: string, prefs: Preferences, n = 0): TemplateKey {
  switch (sportId) {
    case 'walking':
      return n % 2 === 0 ? 'brisk_walk' : 'easy_walk';
    case 'running':
      return prefs.starting_comfort === 'some_routine' && n % 2 === 1 ? 'easy_run' : 'walk_run';
    case 'cycling':
      return has(prefs.available_locations, 'outdoors') && has(prefs.available_equipment, 'bicycle')
        ? 'bike_ride'
        : 'indoor_ride';
    case 'swimming':
      return 'easy_swim';
    case 'football':
      return 'kickabout';
    case 'strength':
      return has(prefs.available_locations, 'gym') ? 'gym_basics' : 'home_strength';
    default:
      return 'stretching';
  }
}

const part = (description: string) => ({ description });

/** Warm-up and cool-down minutes for a session of this length. */
function ends(minutes: number): number {
  if (minutes >= 20) return 4;
  if (minutes >= 10) return 2;
  return 1;
}

function walkRun(minutes: number, prefs: Preferences): { description: string; parts: { description: string }[]; runs: number } {
  const runMin = prefs.starting_comfort === 'occasionally_active' || minutes > 40 ? 2 : 1;
  const warm = ends(minutes);
  const block = runMin + 1;
  const runs = Math.max(1, Math.min(12, Math.floor((minutes - 2 * warm) / block)));
  const cool = Math.max(1, minutes - warm - runs * block);
  const length = runMin === 1 ? 'one-minute' : 'two-minute';
  const description =
    runs === 1
      ? `One ${length} run with easy walks either side. Slow enough to talk.`
      : `${capitalize(numberWord(runs))} ${length} runs with easy walks between. Slow enough to talk.`;
  return {
    description,
    runs,
    parts: [
      part(`Warm-up: brisk walk, ${warm} min.`),
      part(
        runs === 1
          ? `Run ${runMin} min, then walk 1 min (${block} min).`
          : `${capitalize(numberWord(runs))} times: run ${runMin} min, then walk 1 min (${runs * block} min).`,
      ),
      part(`Cool-down: slow walk, ${cool} min.`),
    ],
  };
}

/** How many runs a walk-run of this length has: "Three runs instead of six." */
export function walkRunCount(minutes: number, prefs: Preferences): number {
  return walkRun(minutes, prefs).runs;
}

function threeParts(minutes: number, warmUp: string, main: string, coolDown: string) {
  const warm = ends(minutes);
  const mainMin = Math.max(1, minutes - 2 * warm);
  return [part(`Warm-up: ${warmUp}, ${warm} min.`), part(`${main}, ${mainMin} min.`), part(`Cool-down: ${coolDown}, ${warm} min.`)];
}

function gymExercise(id: string, sets: number, repetitions: number, holdSeconds?: number): GymExercise {
  const def = findExercise(id);
  return {
    name: def?.name ?? id,
    exercise_id: id,
    sets,
    repetitions,
    description: def?.description ?? '',
    ...(holdSeconds ? { hold_seconds: holdSeconds } : {}),
  };
}

function gymExercises(key: 'gym_basics' | 'home_strength', minutes: number, prefs: Preferences): GymExercise[] {
  const noFloor = has(prefs.avoidances, 'floor_exercises');
  const atGym = key === 'gym_basics';
  const dumbbells = atGym || has(prefs.available_equipment, 'dumbbells');
  const warmMin = minutes >= 20 ? 5 : minutes >= 10 ? 3 : 2;
  const sets = minutes >= 30 ? 3 : 2;
  const main: GymExercise[] = [
    dumbbells ? gymExercise('goblet_squat', minutes >= 20 ? 3 : sets, 10) : gymExercise('chair_squat', sets, 8),
    noFloor || atGym ? gymExercise('wall_push_up', 2, 8) : gymExercise('knee_push_up', 2, 8),
  ];
  if (dumbbells) main.push(gymExercise('dumbbell_row', 2, 8));
  else if (!noFloor) main.push(gymExercise('glute_bridge', 2, 10));
  if (has(prefs.available_equipment, 'resistance_band')) main.push(gymExercise('band_pull_apart', 2, 10));
  if (!noFloor) main.push(gymExercise('knee_plank', 3, 1, 20));
  if (atGym && minutes >= 30) main.push(gymExercise('leg_press', 3, 10));
  const count = minutes <= 5 ? 1 : minutes <= 10 ? 2 : minutes <= 20 ? 4 : main.length;
  return [
    gymExercise(atGym ? 'brisk_walk' : 'march_in_place', 1, 1, warmMin * 60),
    ...main.slice(0, count),
    gymExercise('easy_stretch', 1, 1, (minutes >= 10 ? 2 : 1) * 60),
  ];
}

/** A whole workout from a template, sized to `minutes`. */
export function workoutFor(key: TemplateKey, minutes: number, prefs: Preferences): Workout {
  const meta = TEMPLATES[key];
  const metrics = { duration: minutes * 60 };
  const outdoors = has(prefs.available_locations, 'outdoors');
  const make = (description: string, parts: { description: string }[]): Workout => ({
    sport_id: meta.sport_id,
    title: meta.title,
    description,
    details: { metrics, parts },
  });
  switch (key) {
    case 'brisk_walk':
      return make(
        outdoors
          ? 'A brisk walk outdoors, at a pace where you can still talk.'
          : 'A brisk walk on the treadmill, at a pace where you can still talk.',
        threeParts(minutes, 'easy walk', 'Brisk walk', 'slow walk'),
      );
    case 'easy_walk':
      return make(
        outdoors ? 'An easy walk outdoors, at your own pace.' : 'An easy walk on the treadmill, at your own pace.',
        threeParts(minutes, 'slow walk', 'Easy walk at your own pace', 'slow walk'),
      );
    case 'short_walk':
      return make('A short walk at your own pace. It still counts.', [part(`Easy walk at your own pace, ${minutes} min.`)]);
    case 'hill_walk':
      return make(
        'A walk with a gentle hill in it. Take the slope as slowly as you like.',
        threeParts(minutes, 'easy walk on the flat', 'Walk up a gentle hill and back down', 'slow walk'),
      );
    case 'walk_run': {
      const w = walkRun(minutes, prefs);
      return make(w.description, w.parts);
    }
    case 'easy_run':
      return make(
        'An easy run at a pace where you can still talk. Walk whenever you need to.',
        threeParts(minutes, 'brisk walk', 'Easy run', 'slow walk'),
      );
    case 'bike_ride':
      return make(
        'An easy ride at a pace where you can still talk.',
        threeParts(minutes, 'easy pedalling', 'Steady ride', 'easy pedalling'),
      );
    case 'indoor_ride':
      return make(
        'An easy ride on the stationary bike, at a pace where you can still talk.',
        threeParts(minutes, 'easy pedalling', 'Steady pedalling', 'easy pedalling'),
      );
    case 'easy_swim':
      return make(
        'Easy lengths at your own pace, resting at the wall whenever you like.',
        threeParts(minutes, 'easy lengths', 'Two lengths at a time, resting 30 s between', 'slow lengths'),
      );
    case 'stretching': {
      const a = Math.max(1, Math.round(minutes * 0.4));
      const b = Math.max(1, Math.round(minutes * 0.4));
      const c = Math.max(1, minutes - a - b);
      const floor = has(prefs.available_equipment, 'mat') && !has(prefs.avoidances, 'floor_exercises');
      return make(floor ? 'Easy stretches on your mat at home.' : 'Easy standing stretches at home.', [
        part(`Neck and shoulders, ${a} min.`),
        part(`Hips and legs, ${b} min.`),
        part(`Slow breathing, ${c} min.`),
      ]);
    }
    case 'kickabout':
      return make(
        'Passing and easy jogging with a ball, with friends or on your own. Stop whenever you like.',
        threeParts(minutes, 'easy jog and passes', 'Kickabout at an easy pace', 'walk and stretch'),
      );
    case 'gym_basics':
      return {
        sport_id: meta.sport_id,
        title: meta.title,
        description: 'Short exercises we walk you through step by step. Stop whenever you need to.',
        details: { exercises: gymExercises(key, minutes, prefs) },
      };
    case 'home_strength':
      return {
        sport_id: meta.sport_id,
        title: meta.title,
        description: 'A few exercises at home, one at a time, with rests between.',
        details: { exercises: gymExercises(key, minutes, prefs) },
      };
  }
}

/** An optional new activity reads as one: "Something new to try: … Skip it if you like." */
export function asNewIdea(workout: Workout): Workout {
  const d = workout.description;
  const firstSentence = d.split('. ')[0].replace(/\.$/, '');
  return {
    ...workout,
    description: `Something new to try: ${firstSentence.charAt(0).toLowerCase()}${firstSentence.slice(1)}. Skip it if you like.`,
  };
}

/** The session with new workout details, title and description; the other fields stay. */
export function withWorkout(session: PlannedSession, workout: Workout): PlannedSession {
  return {
    id: session.id,
    sport_id: workout.sport_id,
    title: workout.title,
    time_slot: session.time_slot,
    description: workout.description,
    status: session.status,
    editable: session.editable,
    plan_version: session.plan_version,
    optional: session.optional,
    changed_in_version: session.changed_in_version,
    log_id: session.log_id,
    ...workout.details,
  };
}
