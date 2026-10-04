/**
 * The You page's history at a glance (desktop web): the weeks since the first
 * plan, each with Home's "2 of 3 done", what's done in all and the latest
 * session. Plain counts only: no streaks, scores or percentages. Pure.
 */
import type { ActivityLog, LocalDate, PlannedSession } from '@/api/types';
import { addDays, diffDays, startOfWeek } from '@/lib/dates';
import { sessionLocalDate, sessionStart, weekProgress } from '@/lib/sessions';

export type JourneyWeek = {
  /** Monday. */
  weekStart: LocalDate;
  /** 1 for the first planned week. */
  number: number;
  /** Home's "2 of 3 done": plan sessions only. */
  done: number;
  total: number;
  /** New ideas (optional sessions) done that week, which Home's count leaves out. */
  ideas: number;
  current: boolean;
};

export type Journey = {
  /** Monday of the first planned week. */
  since: LocalDate;
  /** The latest weeks up to this one, oldest first. */
  weeks: JourneyWeek[];
  /** Plan sessions done in all, new ideas included. */
  done: number;
  /** Workouts added outside the plan. */
  extras: number;
  /** The latest done plan session. */
  last: PlannedSession | null;
};

/** Weeks listed on the card; older ones stay in Calendar. */
const SHOWN_WEEKS = 5;

/** Sessions and extras from the first planned Monday to this week's Sunday. */
export function journeyRange(firstWeekStart: LocalDate, today: LocalDate): { from: LocalDate; to: LocalDate } {
  return { from: firstWeekStart, to: addDays(startOfWeek(today), 6) };
}

export function buildJourney(
  firstWeekStart: LocalDate,
  today: LocalDate,
  sessions: PlannedSession[],
  extras: ActivityLog[],
): Journey {
  const thisWeek = startOfWeek(today);
  const count = Math.max(1, Math.floor(diffDays(firstWeekStart, thisWeek) / 7) + 1);
  const weeks = Array.from({ length: count }, (_, i): JourneyWeek => {
    const weekStart = addDays(firstWeekStart, i * 7);
    const weekEnd = addDays(weekStart, 6);
    const inWeek = sessions.filter((s) => {
      const day = sessionLocalDate(s);
      return day >= weekStart && day <= weekEnd;
    });
    const ideas = inWeek.filter((s) => s.optional && s.status === 'completed').length;
    return { weekStart, number: i + 1, ...weekProgress({ sessions: inWeek }), ideas, current: weekStart === thisWeek };
  });
  const done = sessions.filter((s) => s.status === 'completed');
  const last = done.reduce<PlannedSession | null>(
    (latest, s) => (!latest || sessionStart(s) > sessionStart(latest) ? s : latest),
    null,
  );
  return { since: firstWeekStart, weeks: weeks.slice(-SHOWN_WEEKS), done: done.length, extras: extras.length, last };
}
