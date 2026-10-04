/** Copy for gym numbers: clocks, holds, weights and what was done. */
import type { LoggedSet } from '@/api/types';

const pad = (n: number) => String(n).padStart(2, '0');

/** Session clock in the top bar: '08:12', or '1:08:12' past an hour. */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** A countdown: '0:45', '5:00'. Rounds up so it reads 0:01 until the last moment. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${pad(total % 60)}`;
}

/** A hold or a round: '20 s', '5 min', '1 min 30 s'. */
export function formatSeconds(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return rest ? `${m} min ${rest} s` : `${m} min`;
}

/** '8', '12.5' */
export function formatKg(kg: number): string {
  return String(Math.round(kg * 10) / 10);
}

type Tracked = { tracking: 'reps' | 'time'; perSide: boolean };

/**
 * What was done, never plan versus actual: '3 × 10 · 8 kg', '8, 6 reps',
 * '1 set · 10 reps · 8 kg', '5 min', '20 s, 20 s, 14 s'.
 */
export function doneSummary(step: Tracked, sets: LoggedSet[]): string {
  if (!sets.length) return 'Not today';
  if (step.tracking === 'time') {
    return sets.map((s) => formatSeconds(s.seconds ?? 0)).join(', ');
  }
  const side = step.perSide ? ' each side' : '';
  const reps = sets.map((s) => s.reps ?? 0);
  const weights = sets.map((s) => s.weight_kg);
  const sameWeight = weights.every((w) => w === weights[0]);
  const kg = sameWeight && weights[0] != null ? ` · ${formatKg(weights[0])} kg` : '';
  if (sets.length === 1) return `1 set · ${reps[0]} reps${side}${kg}`;
  if (!sameWeight) {
    return sets.map((s) => (s.weight_kg != null ? `${s.reps ?? 0} × ${formatKg(s.weight_kg)} kg` : `${s.reps ?? 0}`)).join(', ');
  }
  if (reps.every((r) => r === reps[0])) return `${sets.length} × ${reps[0]}${side}${kg}`;
  return `${reps.join(', ')} reps${side}${kg}`;
}
