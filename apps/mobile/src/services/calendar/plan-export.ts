/**
 * Planned sessions copied into the app's "Movo" device calendar (opt-in). Each
 * event carries a `movo-activity:<id>` line in its notes, so a later sync finds
 * it again, updates it, or removes it once the session is gone. Events without
 * a marker are never touched. Relative imports only: Node tests compile this file.
 */
import { deviceCalendar } from './device-calendar';
import type { CalendarEvent, CalendarService } from './types';

/** One planned session as it should appear in the calendar. */
export interface ExportSession {
  id: string;
  title: string;
  description: string;
  start: Date;
  end: Date;
  /** IANA zone shown with the event; the device's zone when omitted. */
  timezone?: string;
}

export interface ExportRange {
  /** Half-open [start, end): the sync owns marker events overlapping it. */
  start: Date;
  end: Date;
}

export interface ExportResult {
  created: number;
  updated: number;
  deleted: number;
}

/** What the export needs from the calendar service; tests pass a fake. */
export type ExportCalendar = Pick<
  CalendarService,
  'ensureAppCalendar' | 'getEvents' | 'createEvent' | 'updateEvent' | 'deleteEvent' | 'deleteAppCalendar'
>;

const MARKER_PREFIX = 'movo-activity:';
const MARKER_LINE = /^movo-activity:(\S+)\s*$/m;
const FALLBACK_TITLE = 'Movo session';

/** The marker line for a session id. */
export function exportMarker(sessionId: string): string {
  return `${MARKER_PREFIX}${sessionId}`;
}

/** The session id an event was exported for, or null for any other event. */
export function sessionIdOf(notes: string | null): string | null {
  return notes?.match(MARKER_LINE)?.[1] ?? null;
}

/** The event notes: the session's description, then the marker on its own line. */
export function exportNotes(session: ExportSession): string {
  const description = session.description.trim();
  return description ? `${description}\n\n${exportMarker(session.id)}` : exportMarker(session.id);
}

function exportTitle(session: ExportSession): string {
  return session.title.trim() || FALLBACK_TITLE;
}

function overlaps(session: ExportSession, range: ExportRange): boolean {
  return session.start < range.end && session.end > range.start;
}

function differs(event: CalendarEvent, session: ExportSession): boolean {
  return (
    event.title !== exportTitle(session) ||
    event.startDate.getTime() !== session.start.getTime() ||
    event.endDate.getTime() !== session.end.getTime() ||
    (event.notes ?? '') !== exportNotes(session)
  );
}

/**
 * Makes the Movo calendar match `sessions` within `range`: creates missing
 * events, updates changed ones, and deletes marker events whose session is no
 * longer planned. Creates the calendar on first use. Errors propagate; a
 * second run with the same sessions writes nothing.
 */
export async function syncPlanToCalendar(
  sessions: readonly ExportSession[],
  range: ExportRange,
  calendar: ExportCalendar = deviceCalendar,
): Promise<ExportResult> {
  const result: ExportResult = { created: 0, updated: 0, deleted: 0 };
  const appCalendar = await calendar.ensureAppCalendar();
  const events = await calendar.getEvents({
    startDate: range.start,
    endDate: range.end,
    calendarIds: [appCalendar.id],
  });

  const bySession = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const sessionId = sessionIdOf(event.notes);
    if (!sessionId) continue;
    bySession.set(sessionId, [...(bySession.get(sessionId) ?? []), event]);
  }

  // Only sessions the read can see: one outside the range would be created again on every run.
  const wanted = new Map<string, ExportSession>();
  for (const session of sessions) {
    if (session.end > session.start && overlaps(session, range)) wanted.set(session.id, session);
  }

  for (const session of wanted.values()) {
    const [existing, ...duplicates] = bySession.get(session.id) ?? [];
    for (const duplicate of duplicates) {
      await calendar.deleteEvent(duplicate.id);
      result.deleted += 1;
    }
    if (!existing) {
      await calendar.createEvent({
        calendarId: appCalendar.id,
        title: exportTitle(session),
        startDate: session.start,
        endDate: session.end,
        notes: exportNotes(session),
        timeZone: session.timezone,
      });
      result.created += 1;
    } else if (differs(existing, session)) {
      await calendar.updateEvent(existing.id, {
        title: exportTitle(session),
        startDate: session.start,
        endDate: session.end,
        notes: exportNotes(session),
        timeZone: session.timezone,
      });
      result.updated += 1;
    }
  }

  for (const [sessionId, stale] of bySession) {
    if (wanted.has(sessionId)) continue;
    for (const event of stale) {
      await calendar.deleteEvent(event.id);
      result.deleted += 1;
    }
  }
  return result;
}

/** Removes the Movo calendar with every exported session. False when there was none. */
export function removeAppCalendar(calendar: Pick<ExportCalendar, 'deleteAppCalendar'> = deviceCalendar): Promise<boolean> {
  return calendar.deleteAppCalendar();
}
