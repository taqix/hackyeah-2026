import type { Felt, LocalDate, PlannedSession } from '@/api/types';
import { formatDayLong } from '@/lib/dates';

/** "You said it felt just right." */
export const FELT_WORDS: Record<Felt, string> = {
  easy: 'easy',
  just_right: 'just right',
  hard: 'hard',
  too_much: 'too much',
};

export const OUTSIDE_WINDOW = 'Outside your preferred times.';

export const WHY_IT_MATTERS = 'Moving a little most weeks is good for your mood, your sleep and your heart.';

/** "Walk-run intervals." — a headline ends with a full stop unless it already has one. */
export function headline(title: string): string {
  return /[.?!]$/.test(title) ? title : `${title}.`;
}

/** "walk-run intervals", for use mid-sentence. */
export function inSentence(title: string): string {
  return title.charAt(0).toLowerCase() + title.slice(1);
}

/** "Today" on today, else the weekday. */
export function dayWord(date: LocalDate, today: LocalDate): string {
  return date === today ? 'Today' : formatDayLong(date);
}

/** The plan's description, plus the app's line when the start falls outside the preferred window. */
export function heroBody(session: PlannedSession, outside: boolean): string {
  const description = session.description.trim();
  if (!outside) return description;
  return description ? `${description} ${OUTSIDE_WINDOW}` : OUTSIDE_WINDOW;
}

/** "1,240" without relying on Intl. */
export function formatCount(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
