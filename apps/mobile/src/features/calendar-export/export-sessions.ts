/**
 * Planned sessions in the shape the calendar export writes. Relative imports
 * only: Node tests compile this file.
 */
import type { LocalDate, PlannedSession } from '../../api/types';
import { addDays, fromLocalDate } from '../../lib/dates';
import type { ExportRange, ExportSession } from '../../services/calendar/plan-export';

/** Today through the last planned day, as local midnights: the days the export owns. */
export function exportRange(today: LocalDate, plannedThrough: LocalDate): ExportRange {
  return { start: fromLocalDate(today), end: fromLocalDate(addDays(plannedThrough, 1)) };
}

/** Planned and done sessions as events; skipped ones stay out of the calendar. */
export function exportSessionsFrom(sessions: readonly PlannedSession[], timezone?: string): ExportSession[] {
  return sessions
    .filter((session) => session.status !== 'skipped')
    .map((session) => {
      const start = new Date(session.time_slot.start);
      return {
        id: session.id,
        title: session.title,
        description: session.description,
        start,
        end: new Date(start.getTime() + session.time_slot.duration * 1000),
        timezone,
      };
    })
    .filter((session) => Number.isFinite(session.start.getTime()) && session.end > session.start);
}
