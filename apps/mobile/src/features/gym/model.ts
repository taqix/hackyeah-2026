/**
 * The guided gym session (6.3–6.7) as a pure state machine over exercises ×
 * sets. Times come in on the actions (`at`, ms from `now()`), so the reducer
 * stays pure and timers survive re-renders: a countdown is an end moment, not
 * a ticking number.
 */
import type { ExerciseTracking, GymSession, LoggedSet, SportDefinition } from '@/api/types';

import { formatSeconds } from './format';

/** One exercise of the session with the catalog's tracking details filled in. */
export type GymStep = {
  name: string;
  exerciseId: string | null;
  description: string;
  tracking: ExerciseTracking;
  perSide: boolean;
  usesWeight: boolean;
  weightStep: number;
  restSeconds: number;
  /** Planned sets (rounds for time tracking). */
  sets: number;
  /** Planned reps per set. */
  reps: number;
  /** Seconds per round for time tracking. */
  holdSeconds: number;
};

const DEFAULT_REST_SECONDS = 60;
const DEFAULT_HOLD_SECONDS = 30;

/** The session's exercises in plan order, with tracking, steps and rest from the catalog. */
export function buildSteps(session: GymSession, sport: SportDefinition | null | undefined): GymStep[] {
  const defs = sport && sport.is_gym === 1 ? (sport.exercises ?? []) : [];
  return session.exercises.map((exercise) => {
    const def = defs.find((d) =>
      exercise.exercise_id ? d.id === exercise.exercise_id : d.name.toLowerCase() === exercise.name.toLowerCase(),
    );
    const tracking = def?.tracking ?? (exercise.hold_seconds ? 'time' : 'reps');
    return {
      name: exercise.name,
      exerciseId: exercise.exercise_id ?? def?.id ?? null,
      description: exercise.description || def?.description || '',
      tracking,
      perSide: def?.per_side ?? false,
      usesWeight: tracking === 'reps' && (def?.uses_weight ?? false),
      weightStep: def?.weight_step_kg ?? 1,
      restSeconds: def?.rest_seconds ?? DEFAULT_REST_SECONDS,
      sets: Math.max(1, exercise.sets),
      reps: Math.max(1, exercise.repetitions),
      holdSeconds: exercise.hold_seconds ?? DEFAULT_HOLD_SECONDS,
    };
  });
}

/** The plan's own wording for an exercise: '3 × 10', '2 × 8 each side', '3 × 20 s', '5 min'. */
export function plannedLabel(step: GymStep): string {
  if (step.tracking === 'time') {
    return step.sets > 1 ? `${step.sets} × ${formatSeconds(step.holdSeconds)}` : formatSeconds(step.holdSeconds);
  }
  return `${step.sets} × ${step.reps}${step.perSide ? ' each side' : ''}`;
}

export type SetEntry = {
  reps: number;
  /** undefined: not chosen yet, so it shows last time's weight. null: no weight. */
  weight: number | null | undefined;
  /** Real seconds of a done round. */
  seconds: number | null;
  done: boolean;
  /** The order sets were done in, across exercises. */
  seq: number;
};

export type RoundClock =
  | { status: 'ready' }
  | { status: 'running'; endsAt: number }
  | { status: 'paused'; remainingMs: number };

export type Rest = {
  endsAt: number;
  totalMs: number;
  /** The set that was just saved. */
  exercise: number;
  set: number;
};

export type GymSheet = 'plan' | 'end' | null;

export type GymState = {
  steps: GymStep[];
  entries: SetEntry[][];
  /** The exercise on screen. */
  current: number;
  /** A done or upcoming set opened to fix a number; null shows the current set open. */
  editing: number | null;
  round: RoundClock;
  rest: Rest | null;
  sheet: GymSheet;
  seq: number;
};

export type GymAction =
  /** `fallbackWeight` is last time's weight, used while the set has none of its own. */
  | { type: 'log-set'; at: number; fallbackWeight: number | null }
  | { type: 'start-round'; at: number }
  | { type: 'pause-round'; at: number }
  | { type: 'resume-round'; at: number }
  | { type: 'finish-round'; at: number }
  | { type: 'rest-extend'; ms: number }
  | { type: 'rest-end' }
  | { type: 'edit-saved' }
  | { type: 'edit-set'; set: number | null }
  | { type: 'set-reps'; set: number; value: number }
  | { type: 'set-weight'; set: number; value: number | null }
  | { type: 'add-set' }
  | { type: 'go-to'; exercise: number }
  | { type: 'next-exercise' }
  | { type: 'sheet'; sheet: GymSheet };

function freshEntry(step: GymStep): SetEntry {
  return { reps: step.reps, weight: step.usesWeight ? undefined : null, seconds: null, done: false, seq: 0 };
}

export function initGymState(steps: GymStep[]): GymState {
  return {
    steps,
    entries: steps.map((step) => Array.from({ length: step.sets }, () => freshEntry(step))),
    current: 0,
    editing: null,
    round: { status: 'ready' },
    rest: null,
    sheet: null,
    seq: 0,
  };
}

/** Index of the first set still to do, or -1. */
export function firstOpen(sets: SetEntry[]): number {
  return sets.findIndex((s) => !s.done);
}

export function isExerciseDone(sets: SetEntry[]): boolean {
  return sets.every((s) => s.done);
}

export function isSessionDone(state: GymState): boolean {
  return state.entries.every(isExerciseDone);
}

/** The next exercise with sets left after `from`, wrapping round; -1 when everything is done. */
export function nextOpenExercise(entries: SetEntry[][], from: number): number {
  for (let i = 1; i <= entries.length; i += 1) {
    const index = (from + i) % entries.length;
    if (!isExerciseDone(entries[index])) return index;
  }
  return -1;
}

/** Remaining time of the current round. */
export function roundRemainingMs(state: GymState, at: number): number {
  const hold = state.steps[state.current].holdSeconds * 1000;
  switch (state.round.status) {
    case 'running':
      return Math.max(0, Math.min(hold, state.round.endsAt - at));
    case 'paused':
      return state.round.remainingMs;
    default:
      return hold;
  }
}

/** Real seconds of the current round so far, 0 when it hasn't started. */
export function roundElapsedSeconds(state: GymState, at: number): number {
  if (state.round.status === 'ready') return 0;
  const step = state.steps[state.current];
  return Math.round((step.holdSeconds * 1000 - roundRemainingMs(state, at)) / 1000);
}

function replaceSet(entries: SetEntry[][], exercise: number, set: number, patch: Partial<SetEntry>): SetEntry[][] {
  return entries.map((sets, e) => (e === exercise ? sets.map((s, i) => (i === set ? { ...s, ...patch } : s)) : sets));
}

/** After a set is done: stay on the exercise or move to the next one, and start the rest. */
function afterDone(state: GymState, entries: SetEntry[][], set: number, at: number): GymState {
  const exercise = state.current;
  const step = state.steps[exercise];
  const base = { ...state, entries, editing: null, round: { status: 'ready' } as const, seq: state.seq + 1 };
  let current = exercise;
  if (isExerciseDone(entries[exercise])) {
    const next = nextOpenExercise(entries, exercise);
    if (next === -1) return { ...base, rest: null };
    current = next;
  }
  const restMs = step.restSeconds * 1000;
  return { ...base, current, rest: restMs > 0 ? { endsAt: at + restMs, totalMs: restMs, exercise, set } : null };
}

export function gymReducer(state: GymState, action: GymAction): GymState {
  const step = state.steps[state.current];
  const sets = state.entries[state.current];
  switch (action.type) {
    case 'log-set': {
      const set = firstOpen(sets);
      if (set === -1) return state;
      const entry = sets[set];
      const weight = entry.weight === undefined ? action.fallbackWeight : entry.weight;
      // Later sets carry this set's weight unless the person already set their own.
      const entries = state.entries.map((exerciseSets, e) =>
        e !== state.current
          ? exerciseSets
          : exerciseSets.map((s, i) => {
              if (i === set) return { ...s, weight, done: true, seq: state.seq + 1 };
              if (i > set && !s.done && s.weight === undefined) return { ...s, weight };
              return s;
            }),
      );
      return afterDone(state, entries, set, action.at);
    }
    case 'finish-round': {
      const set = firstOpen(sets);
      if (set === -1) return state;
      const real = state.round.status === 'ready' ? step.holdSeconds : roundElapsedSeconds(state, action.at);
      const seconds = Math.max(1, Math.min(step.holdSeconds, real));
      const entries = replaceSet(state.entries, state.current, set, { seconds, done: true, seq: state.seq + 1 });
      return afterDone(state, entries, set, action.at);
    }
    case 'start-round':
      return { ...state, round: { status: 'running', endsAt: action.at + step.holdSeconds * 1000 } };
    case 'pause-round':
      return state.round.status === 'running'
        ? { ...state, round: { status: 'paused', remainingMs: Math.max(0, state.round.endsAt - action.at) } }
        : state;
    case 'resume-round':
      return state.round.status === 'paused'
        ? { ...state, round: { status: 'running', endsAt: action.at + state.round.remainingMs } }
        : state;
    case 'rest-extend':
      return state.rest
        ? { ...state, rest: { ...state.rest, endsAt: state.rest.endsAt + action.ms, totalMs: state.rest.totalMs + action.ms } }
        : state;
    case 'rest-end':
      return { ...state, rest: null };
    case 'edit-saved':
      return state.rest
        ? { ...state, rest: null, current: state.rest.exercise, editing: state.rest.set, round: { status: 'ready' } }
        : state;
    case 'edit-set':
      return { ...state, editing: action.set === firstOpen(sets) ? null : action.set };
    case 'set-reps':
      return { ...state, entries: replaceSet(state.entries, state.current, action.set, { reps: Math.max(0, action.value) }) };
    case 'set-weight':
      return { ...state, entries: replaceSet(state.entries, state.current, action.set, { weight: action.value }) };
    case 'add-set': {
      const last = sets[sets.length - 1];
      const entry: SetEntry = { ...freshEntry(step), reps: last?.reps ?? step.reps, weight: last ? last.weight : undefined };
      return {
        ...state,
        editing: null,
        entries: state.entries.map((s, e) => (e === state.current ? [...s, entry] : s)),
      };
    }
    case 'go-to':
      return { ...state, current: action.exercise, editing: null, round: { status: 'ready' }, sheet: null };
    case 'next-exercise': {
      const next = nextOpenExercise(state.entries, state.current);
      return next === -1 ? state : { ...state, current: next, editing: null, round: { status: 'ready' } };
    }
    case 'sheet':
      return { ...state, sheet: action.sheet };
  }
}

/**
 * The sets to save, in the order done. A round in progress counts with its
 * real seconds, so ending early keeps it.
 */
export function loggedSets(state: GymState, at: number): LoggedSet[] {
  const done: { seq: number; set: LoggedSet }[] = [];
  state.entries.forEach((sets, e) => {
    const step = state.steps[e];
    sets.forEach((s, i) => {
      if (!s.done) return;
      done.push({
        seq: s.seq,
        set: {
          exercise_id: step.exerciseId,
          exercise_name: step.name,
          set_index: i,
          reps: step.tracking === 'reps' ? s.reps : null,
          weight_kg: step.tracking === 'reps' ? (s.weight ?? null) : null,
          seconds: step.tracking === 'time' ? s.seconds : null,
        },
      });
    });
  });
  const step = state.steps[state.current];
  const partial = roundElapsedSeconds(state, at);
  const open = firstOpen(state.entries[state.current]);
  if (step.tracking === 'time' && partial >= 1 && open !== -1) {
    done.push({
      seq: Number.MAX_SAFE_INTEGER,
      set: {
        exercise_id: step.exerciseId,
        exercise_name: step.name,
        set_index: open,
        reps: null,
        weight_kg: null,
        seconds: partial,
      },
    });
  }
  return done.sort((a, b) => a.seq - b.seq).map((d) => d.set);
}

/** Logged sets of one exercise, matched by catalog ID or name. */
export function setsFor(step: Pick<GymStep, 'exerciseId' | 'name'>, sets: LoggedSet[]): LoggedSet[] {
  return sets
    .filter((s) =>
      step.exerciseId && s.exercise_id ? s.exercise_id === step.exerciseId : s.exercise_name.toLowerCase() === step.name.toLowerCase(),
    )
    .sort((a, b) => a.set_index - b.set_index);
}
