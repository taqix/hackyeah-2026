import type { ActivityLog, ChooseAgain, Felt, LocalDate } from '@/api/types';
import { formatDayDate, formatDayLong, formatMinutes, relativeWeekLabel, type DateLike } from '@/lib/dates';

export const FELT_QUESTION = 'How did it feel?';
export const CHOOSE_AGAIN_QUESTION = 'Would you choose this again?';

export const FELT_OPTIONS: readonly { value: Felt; label: string; description: string }[] = [
  { value: 'easy', label: 'Easy', description: 'Could have kept going' },
  { value: 'just_right', label: 'Just right', description: 'Tired, but good' },
  { value: 'hard', label: 'Hard', description: 'Needed every walk break' },
  { value: 'too_much', label: 'Too much', description: 'Had to stop early' },
];

export const CHOOSE_AGAIN_OPTIONS: readonly { value: ChooseAgain; label: string }[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'no', label: 'Not for now' },
];

/** Calm, never hype: an early stop still counts, an extra is history beside the plan. */
export function feedbackHeading(log: Pick<ActivityLog, 'ended_early' | 'extra'>): string {
  if (log.ended_early) return 'Every bit counts.';
  if (log.extra) return 'Saved to your week.';
  return 'Nice and steady.';
}

/** 'this week', 'last week', or 'that week' for anything older. */
export function weekWord(weekStart: LocalDate, today: DateLike): string {
  return relativeWeekLabel(weekStart, today) ?? 'that week';
}

/**
 * "Wednesday · 20 min · 2 of 3 this week". Older weeks name the date; an extra
 * says it sits outside the plan instead of a count.
 */
export function feedbackKicker({
  log,
  weekStart,
  today,
  progress,
}: {
  log: Pick<ActivityLog, 'started_at' | 'duration_seconds' | 'extra'>;
  weekStart: LocalDate;
  today: DateLike;
  progress: { done: number; total: number } | null;
}): string {
  const thisWeek = relativeWeekLabel(weekStart, today) === 'this week';
  const parts = [
    thisWeek ? formatDayLong(log.started_at) : formatDayDate(log.started_at),
    formatMinutes(log.duration_seconds / 60),
  ];
  if (log.extra) parts.push("Extra, doesn't count toward the plan");
  else if (progress && progress.total > 0) parts.push(`${progress.done} of ${progress.total} ${weekWord(weekStart, today)}`);
  return parts.join(' · ');
}
