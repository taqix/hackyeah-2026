import type { ChatMessage, LocalDate, PlannedSession, SessionRef } from '@/api/types';
import {
  diffDays,
  formatDayLong,
  formatDayShort,
  formatLongDate,
  fromLocalDate,
  toLocalDate,
  type DateLike,
} from '@/lib/dates';
import { sessionLocalDate } from '@/lib/sessions';

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

function nearDay(date: LocalDate, today: LocalDate): 'Today' | 'Tomorrow' | 'Yesterday' | null {
  const days = diffDays(today, date);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  return null;
}

/** The About chip: "Today · Walk-run intervals", "Fri 9 · Walk-run intervals". */
export function aboutLabel(session: PlannedSession, today: DateLike): string {
  const date = sessionLocalDate(session);
  const day = nearDay(date, toLocalDate(today)) ?? `${formatDayShort(date)} ${fromLocalDate(date).getDate()}`;
  return `${day} · ${session.title}`;
}

/** 8.1: "What would you like to change about today's walk-run intervals?" */
export function sessionQuestion(session: PlannedSession, today: DateLike): string {
  const date = sessionLocalDate(session);
  const day = nearDay(date, toLocalDate(today)) ?? formatDayLong(date);
  return `What would you like to change about ${lowerFirst(day)}'s ${lowerFirst(session.title)}?`;
}

/** The attached session as a message's `about`, for the bubble shown before the reply. */
export function sessionRef(session: PlannedSession): SessionRef {
  return {
    session_id: session.id,
    date: sessionLocalDate(session),
    title: session.title,
    sport_id: session.sport_id,
  };
}

/** A day separator: "Today", "Yesterday", "Wednesday 7 October". */
export function dayBreakLabel(date: LocalDate, today: DateLike): string {
  const near = nearDay(date, toLocalDate(today));
  return near === 'Today' || near === 'Yesterday' ? near : formatLongDate(date);
}

export const messageDay = (message: ChatMessage): LocalDate => toLocalDate(message.created_at);
