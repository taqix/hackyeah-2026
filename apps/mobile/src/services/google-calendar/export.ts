/**
 * Planned sessions copied into a secondary "Movo" calendar in the person's
 * Google Calendar (opt-in). The app creates that calendar itself (the
 * calendar.app.created scope lets it manage nothing else) and remembers its ID
 * per user. Each event carries `extendedProperties.private.movoActivityId`, so
 * a later sync finds it again, updates it, or deletes it once the session is
 * gone. Events without that property are never touched.
 */
import type { ExportRange, ExportResult, ExportSession } from '../calendar/plan-export';
import type { GoogleCalendarApi, GoogleEvent, GoogleEventInput } from './api';
import { GOOGLE_MOVO_CALENDAR_TITLE, GoogleCalendarError } from './types';

/** Marks the calendar as the app's own when it is found again after a reinstall. */
export const GOOGLE_MOVO_CALENDAR_DESCRIPTION = 'Planned sessions from Movo. Movo updates this calendar.';
const FALLBACK_TITLE = 'Movo session';

/** Where the Movo calendar's Google ID is remembered for this account. */
export interface MovoCalendarRef {
  get(): Promise<string | null>;
  set(calendarId: string | null): Promise<void>;
}

export interface GoogleExportTarget {
  api: GoogleCalendarApi;
  calendar: MovoCalendarRef;
  /** The zone events are shown in: each session's own, else this one. */
  timeZone: string;
}

const isNotFound = (error: unknown) => error instanceof GoogleCalendarError && error.code === 'not_found';

/**
 * The Movo calendar: the remembered one, else one found among the person's
 * calendars by title and description (after a reinstall), else a new one.
 * Finding is best effort: these scopes may not allow listing calendars.
 */
async function ensureMovoCalendar(target: GoogleExportTarget, options: { forgetRemembered?: boolean } = {}) {
  const remembered = options.forgetRemembered ? null : await target.calendar.get();
  if (remembered) return remembered;
  let found: string | null = null;
  try {
    const owned = await target.api.listOwnedCalendars();
    found =
      owned.find(
        (item) => item.summary === GOOGLE_MOVO_CALENDAR_TITLE && item.description === GOOGLE_MOVO_CALENDAR_DESCRIPTION,
      )?.id ?? null;
  } catch (error) {
    // Listing may be refused for these scopes (403) or fail: create one instead. Offline or a refused token still stop here.
    const canCreate =
      error instanceof GoogleCalendarError &&
      (error.status === 403 || error.code === 'google' || error.code === 'not_found');
    if (!canCreate) throw error;
  }
  const id =
    found ??
    (
      await target.api.insertCalendar({
        summary: GOOGLE_MOVO_CALENDAR_TITLE,
        description: GOOGLE_MOVO_CALENDAR_DESCRIPTION,
        timeZone: target.timeZone,
      })
    ).id;
  await target.calendar.set(id);
  return id;
}

function title(session: ExportSession): string {
  return session.title.trim() || FALLBACK_TITLE;
}

function input(session: ExportSession, timeZone: string): GoogleEventInput {
  return {
    summary: title(session),
    description: session.description.trim(),
    start: session.start,
    end: session.end,
    timeZone: session.timezone ?? timeZone,
    movoActivityId: session.id,
  };
}

function differs(event: GoogleEvent, session: ExportSession): boolean {
  return (
    event.summary !== title(session) ||
    event.description !== session.description.trim() ||
    event.start.getTime() !== session.start.getTime() ||
    event.end.getTime() !== session.end.getTime()
  );
}

const overlaps = (session: ExportSession, range: ExportRange) => session.start < range.end && session.end > range.start;

/**
 * Makes the Google Movo calendar match `sessions` within `range`: creates
 * missing events, updates changed ones, and deletes marked events whose
 * session is no longer planned (and duplicates of one session). Creates the
 * calendar on first use, and again if the person deleted it in Google.
 * Errors propagate; a second run with the same sessions writes nothing.
 */
export async function syncPlanToGoogleCalendar(
  sessions: readonly ExportSession[],
  range: ExportRange,
  target: GoogleExportTarget,
): Promise<ExportResult> {
  const result: ExportResult = { created: 0, updated: 0, deleted: 0 };
  let calendarId = await ensureMovoCalendar(target);
  let events: GoogleEvent[];
  try {
    events = await target.api.listEvents(calendarId, { timeMin: range.start, timeMax: range.end });
  } catch (error) {
    if (!isNotFound(error)) throw error;
    // Deleted in Google meanwhile: start a new one.
    calendarId = await ensureMovoCalendar(target, { forgetRemembered: true });
    events = [];
  }

  const bySession = new Map<string, GoogleEvent[]>();
  for (const event of events) {
    if (!event.movoActivityId) continue;
    bySession.set(event.movoActivityId, [...(bySession.get(event.movoActivityId) ?? []), event]);
  }

  // Only sessions the read can see: one outside the range would be created again on every run.
  const wanted = new Map<string, ExportSession>();
  for (const session of sessions) {
    if (session.end > session.start && overlaps(session, range)) wanted.set(session.id, session);
  }

  for (const session of wanted.values()) {
    const [existing, ...duplicates] = bySession.get(session.id) ?? [];
    for (const duplicate of duplicates) {
      await target.api.deleteEvent(calendarId, duplicate.id);
      result.deleted += 1;
    }
    if (!existing) {
      await target.api.insertEvent(calendarId, input(session, target.timeZone));
      result.created += 1;
    } else if (differs(existing, session)) {
      await target.api.patchEvent(calendarId, existing.id, input(session, target.timeZone));
      result.updated += 1;
    }
  }

  for (const [sessionId, stale] of bySession) {
    if (wanted.has(sessionId)) continue;
    for (const event of stale) {
      await target.api.deleteEvent(calendarId, event.id);
      result.deleted += 1;
    }
  }
  return result;
}

/** Deletes the Movo calendar from Google with every exported session. False when there was none to delete. */
export async function removeGoogleMovoCalendar(target: Pick<GoogleExportTarget, 'api' | 'calendar'>): Promise<boolean> {
  const calendarId = await target.calendar.get();
  if (!calendarId) return false;
  try {
    await target.api.deleteCalendar(calendarId);
  } catch (error) {
    if (!isNotFound(error)) throw error;
    await target.calendar.set(null);
    return false;
  }
  await target.calendar.set(null);
  return true;
}
