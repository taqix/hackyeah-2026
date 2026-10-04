/**
 * Copy for the activity screen: the coach tip per sport, gym exercise lines
 * ("3 × 10", "3 × 20 s"), and what a saved log holds ("20 min", "8, 6 reps").
 */
import type {
  ExerciseDefinition,
  Felt,
  GymExercise,
  LoggedSet,
  MetricValue,
  SportDefinition,
  SportMetric,
} from '@/api/types';
import type { IconName } from '@/components/ui';
import { formatMinutes } from '@/lib/dates';

type Tip = { title: string; body: string };

const TIPS: Record<string, Tip> = {
  running: { title: 'Talk-pace is the pace.', body: 'Slow enough to say a sentence. Stopping early still counts.' },
  walking: { title: 'Your pace is the right pace.', body: 'Brisk enough to warm up, easy enough to talk. Stopping early still counts.' },
  cycling: { title: 'Easy gears, easy legs.', body: 'Light enough that you could chat. Stopping early still counts.' },
  swimming: { title: 'Rest at the wall whenever you like.', body: 'Short rests are part of the swim. Stopping early still counts.' },
  mobility: { title: 'A gentle pull, never pain.', body: 'Breathe slowly through each stretch. Stopping early still counts.' },
  football: { title: 'Play at your own pace.', body: 'Walk whenever you need to. Stopping early still counts.' },
  strength: { title: 'Stop a few reps short of hard.', body: 'Slow, steady reps beat heavy ones. Stopping early still counts.' },
};

const DEFAULT_TIP: Tip = { title: 'Go at your own pace.', body: 'Easy enough to talk the whole way. Stopping early still counts.' };

/** The dusk Coach tip card on Activity (6). */
export function coachTip(sportId: string): Tip {
  return TIPS[sportId] ?? DEFAULT_TIP;
}

/** '20 s', '5 min', '1 min 30 s'. */
export function formatSeconds(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s} s`;
  const rest = s % 60;
  return rest ? `${Math.floor(s / 60)} min ${rest} s` : `${s / 60} min`;
}

function definitionOf(exercise: GymExercise, sport: SportDefinition | null): ExerciseDefinition | undefined {
  if (!sport || sport.is_gym !== 1) return undefined;
  return sport.exercises?.find((e) => e.id === exercise.exercise_id);
}

/** Holds and warm-up walks are timed; everything else is counted in reps. */
export function isTimed(exercise: GymExercise, sport: SportDefinition | null): boolean {
  return !!exercise.hold_seconds || definitionOf(exercise, sport)?.tracking === 'time';
}

export function exerciseIcon(exercise: GymExercise, sport: SportDefinition | null): IconName {
  return isTimed(exercise, sport) ? 'timer' : 'dumbbell';
}

/** '3 × 10', '2 × 8 each side', '3 × 20 s', '5 min'. The plan never sets a weight. */
export function exerciseDetail(exercise: GymExercise, sport: SportDefinition | null): string {
  if (exercise.hold_seconds) {
    const each = formatSeconds(exercise.hold_seconds);
    return exercise.sets > 1 ? `${exercise.sets} × ${each}` : each;
  }
  const reps = `${exercise.sets} × ${exercise.repetitions}`;
  return definitionOf(exercise, sport)?.per_side ? `${reps} each side` : reps;
}

/** One line per exercise done, in the order done: '3 × 10 · 8 kg', '8, 6 reps', '20 s, 20 s, 14 s'. */
export function loggedExercises(sets: LoggedSet[]): { key: string; name: string; detail: string; timed: boolean }[] {
  const groups = new Map<string, LoggedSet[]>();
  for (const set of sets) {
    const key = set.exercise_id ?? set.exercise_name;
    groups.set(key, [...(groups.get(key) ?? []), set]);
  }
  return [...groups.entries()].map(([key, group]) => {
    const name = group[0].exercise_name;
    const timed = group.every((s) => s.seconds !== null);
    if (timed) {
      const each = group.map((s) => formatSeconds(s.seconds ?? 0));
      const same = each.every((v) => v === each[0]);
      return { key, name, timed, detail: same && group.length > 1 ? `${group.length} × ${each[0]}` : each.join(', ') };
    }
    const first = group[0];
    const same = group.every((s) => s.reps === first.reps && s.weight_kg === first.weight_kg);
    if (same) {
      const weight = first.weight_kg ? ` · ${first.weight_kg} kg` : '';
      return { key, name, timed, detail: `${group.length} × ${first.reps ?? 0}${weight}` };
    }
    const anyWeight = group.some((s) => s.weight_kg);
    const detail = anyWeight
      ? group.map((s) => (s.weight_kg ? `${s.reps ?? 0} × ${s.weight_kg} kg` : `${s.reps ?? 0}`)).join(', ')
      : `${group.map((s) => s.reps ?? 0).join(', ')} reps`;
    return { key, name, timed, detail };
  });
}

/** A saved metric as read back: the session length in minutes, units after numbers. */
export function metricText(metric: SportMetric, value: MetricValue): string {
  if (metric.represents_session_duration && typeof value === 'number') return formatMinutes(value / 60);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return metric.unit ? `${value} ${metric.unit}` : String(value);
  return value;
}

export const FELT_LABEL: Record<Felt, string> = {
  easy: 'Easy',
  just_right: 'Just right',
  hard: 'Hard',
  too_much: 'Too much',
};
