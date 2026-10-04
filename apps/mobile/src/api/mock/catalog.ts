/**
 * The mock sport catalog, in the contract's shape (codex/gemini-plan-contract ›
 * Sport catalog). Names, copy, IDs and the gym exercises come from
 * `lib/sport-library` (IDs match onboarding's PREF_OPTIONS); the metrics are
 * the mock's own. Working sports can be planned; preview sports are listed but
 * not planned yet. `strength` is the guided gym sport (is_gym 1).
 */
import { EXERCISES, librarySport } from '../../lib/sport-library';
import type { ExerciseDefinition, SportDefinition, SportMetric } from '../types';

export { EXERCISES };

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

type SportDetails = { is_gym: 0; metrics: SportMetric[] } | { is_gym: 1; exercises?: ExerciseDefinition[] };

/** A library sport with the mock's metrics or exercises. */
function sport(slug: string, details: SportDetails): SportDefinition {
  const known = librarySport(slug);
  if (!known) throw new Error(`The sport library has no ${slug}.`);
  return {
    id: known.slug,
    name: known.name,
    description: known.description,
    availability: known.availability,
    ...(known.suggested ? { suggested: true } : {}),
    ...details,
  };
}

const metrics = (...extra: SportMetric[]): SportDetails => ({ is_gym: 0, metrics: [duration(), ...extra] });

export const SPORTS: SportDefinition[] = [
  sport('walking', metrics(distanceKm())),
  sport('strength', { is_gym: 1, exercises: EXERCISES }),
  sport('running', metrics(distanceKm())),
  sport(
    'cycling',
    metrics(distanceKm(), {
      key: 'indoor',
      description: 'On a stationary bike',
      required: false,
      value_schema: { type: 'boolean' },
    }),
  ),
  sport('swimming', {
    is_gym: 0,
    metrics: [
      duration('Time in the water'),
      { key: 'distance', description: 'Distance', required: false, unit: 'm', value_schema: { type: 'integer', minimum: 0 } },
    ],
  }),
  sport('mobility', metrics()),
  sport('football', metrics()),
  sport(
    'tennis',
    metrics({
      key: 'format',
      description: 'Played',
      required: false,
      value_schema: { type: 'string', enum: ['Singles', 'Doubles'] },
    }),
  ),
  sport('table_tennis', metrics()),
  sport('badminton', metrics()),
  sport('padel', metrics()),
  sport('basketball', metrics()),
  sport('volleyball', metrics()),
  sport('yoga', metrics()),
  sport('pilates', metrics()),
  sport('dancing', metrics()),
  sport('hiking', metrics(distanceKm())),
  sport('nordic_walking', metrics(distanceKm())),
  sport('rowing', metrics(distanceKm())),
  sport('climbing', metrics()),
  sport('ice_skating', metrics()),
  sport('boxing', metrics()),
];

export function findSport(id: string, catalog: SportDefinition[] = SPORTS): SportDefinition | undefined {
  return catalog.find((s) => s.id === id);
}

export function findExercise(id: string): ExerciseDefinition | undefined {
  return EXERCISES.find((e) => e.id === id);
}
