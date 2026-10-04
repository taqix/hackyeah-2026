/**
 * The few Google Calendar API v3 calls the app makes, with the person's access
 * token. Reads ask for free/busy only, never the person's own events; event
 * calls touch only the "Movo" calendar the app created. A 401 refreshes the
 * token once; a refused or missing scope reads as "reconnect".
 */
import { GoogleCalendarError, type BusyInterval, type GoogleFetch, type GoogleFetchInit } from './types';

export const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
export const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const TIMEOUT_MS = 15_000;
const PAGE_SIZE = 250;

/** One event in the Movo calendar, as the export reads and writes it. */
export interface GoogleEvent {
  id: string;
  summary: string;
  description: string;
  start: Date;
  end: Date;
  /** `extendedProperties.private.movoActivityId`: the session it was exported for. */
  movoActivityId: string | null;
}

export interface GoogleEventInput {
  summary: string;
  description: string;
  start: Date;
  end: Date;
  /** IANA zone shown with the event. */
  timeZone: string;
  movoActivityId: string;
}

export interface GoogleCalendarSummary {
  id: string;
  summary: string;
  description: string | null;
}

export interface GoogleCalendarApi {
  /** Busy intervals of the primary calendar overlapping [timeMin, timeMax). Rejects when Google reports a calendar error. */
  freeBusy(query: { timeMin: Date; timeMax: Date; timeZone: string }): Promise<BusyInterval[]>;
  /** Calendars the person owns (may be refused for these scopes: then it rejects). */
  listOwnedCalendars(): Promise<GoogleCalendarSummary[]>;
  insertCalendar(input: { summary: string; description: string; timeZone: string }): Promise<{ id: string }>;
  deleteCalendar(calendarId: string): Promise<void>;
  /** Single events overlapping [timeMin, timeMax), every page. */
  listEvents(calendarId: string, range: { timeMin: Date; timeMax: Date }): Promise<GoogleEvent[]>;
  insertEvent(calendarId: string, event: GoogleEventInput): Promise<void>;
  patchEvent(calendarId: string, eventId: string, event: GoogleEventInput): Promise<void>;
  /** A gone event counts as deleted. */
  deleteEvent(calendarId: string, eventId: string): Promise<void>;
}

/** Google's error body: `{error: {code, message, errors: [{reason}], status, details: [{reason}]}}`. */
function errorReason(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const error = (body as { error?: unknown }).error;
  if (typeof error !== 'object' || error === null) return typeof error === 'string' ? error : null;
  const { errors, details, status } = error as { errors?: unknown; details?: unknown; status?: unknown };
  for (const list of [details, errors]) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      const reason = (item as { reason?: unknown } | null)?.reason;
      if (typeof reason === 'string' && reason) return reason;
    }
  }
  return typeof status === 'string' ? status : null;
}

/** Reconnecting gives a token with the calendar scopes again (the person unticked them, or revoked access). */
const SCOPE_REASONS = new Set(['insufficientPermissions', 'ACCESS_TOKEN_SCOPE_INSUFFICIENT', 'authError']);

function parseJson(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** A Google error answer as a GoogleCalendarError; never carries the response text. */
export function googleError(status: number, body: unknown): GoogleCalendarError {
  const reason = errorReason(body);
  if (status === 401) {
    return new GoogleCalendarError('reconnect_required', 'Google no longer accepts this connection.', { status, reason });
  }
  if (status === 403 && reason && SCOPE_REASONS.has(reason)) {
    return new GoogleCalendarError('reconnect_required', 'Google Calendar access was not granted.', { status, reason });
  }
  if (status === 404 || status === 410) {
    return new GoogleCalendarError('not_found', 'That Google calendar is gone.', { status, reason });
  }
  return new GoogleCalendarError('google', 'Google Calendar did not answer as expected.', { status, reason });
}

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

function toDate(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms) : null;
}

/** `start`/`end` of an event: `dateTime`, or an all-day `date` (never written by the app). */
function eventTime(value: unknown): Date | null {
  if (typeof value !== 'object' || value === null) return null;
  const { dateTime, date } = value as { dateTime?: unknown; date?: unknown };
  return toDate(dateTime) ?? (typeof date === 'string' ? toDate(`${date}T00:00:00`) : null);
}

function toEvent(item: unknown): GoogleEvent | null {
  if (typeof item !== 'object' || item === null) return null;
  const raw = item as Record<string, unknown>;
  const start = eventTime(raw.start);
  const end = eventTime(raw.end);
  if (typeof raw.id !== 'string' || !start || !end || raw.status === 'cancelled') return null;
  const properties = raw.extendedProperties as { private?: Record<string, unknown> } | undefined;
  const marker = properties?.private?.movoActivityId;
  return {
    id: raw.id,
    summary: text(raw.summary),
    description: text(raw.description),
    start,
    end,
    movoActivityId: typeof marker === 'string' && marker ? marker : null,
  };
}

function eventBody(event: GoogleEventInput): string {
  return JSON.stringify({
    summary: event.summary,
    description: event.description,
    start: { dateTime: event.start.toISOString(), timeZone: event.timeZone },
    end: { dateTime: event.end.toISOString(), timeZone: event.timeZone },
    extendedProperties: { private: { movoActivityId: event.movoActivityId } },
  });
}

const path = (id: string) => encodeURIComponent(id);

export function createGoogleCalendarApi(options: {
  fetch: GoogleFetch;
  /** The access token; `forceRefresh` after a 401. Rejects with a GoogleCalendarError. */
  accessToken(forceRefresh?: boolean): Promise<string>;
  timeoutMs?: number;
}): GoogleCalendarApi {
  const timeoutMs = options.timeoutMs ?? TIMEOUT_MS;

  async function send(method: GoogleFetchInit['method'], url: string, token: string, body?: string) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const headers: Record<string, string> = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      const response = await options.fetch(url, { method, headers, body, signal: controller.signal });
      return { status: response.status, ok: response.ok, body: parseJson(await response.text()) };
    } catch (error) {
      throw new GoogleCalendarError('offline', "Couldn't reach Google Calendar.", {
        reason: error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'network',
      });
    } finally {
      clearTimeout(timer);
    }
  }

  /** One call: a 401 refreshes the token and resends once. */
  async function request(
    method: GoogleFetchInit['method'],
    route: string,
    query: Record<string, string | undefined> = {},
    body?: unknown,
  ): Promise<unknown> {
    const params = Object.entries(query)
      .filter((entry): entry is [string, string] => entry[1] !== undefined)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');
    const url = `${GOOGLE_CALENDAR_API}${route}${params ? `?${params}` : ''}`;
    const payload = body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body);
    let answer = await send(method, url, await options.accessToken(false), payload);
    if (answer.status === 401) answer = await send(method, url, await options.accessToken(true), payload);
    if (!answer.ok) throw googleError(answer.status, answer.body);
    return answer.body;
  }

  return {
    async freeBusy({ timeMin, timeMax, timeZone }) {
      const body = (await request('POST', '/freeBusy', {}, {
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        timeZone,
        items: [{ id: 'primary' }],
      })) as { calendars?: Record<string, { busy?: unknown; errors?: unknown }> } | null;
      const primary = body?.calendars?.primary;
      if (!primary) throw new GoogleCalendarError('google', 'Google sent no free/busy for the calendar.', { reason: 'no_calendar' });
      if (Array.isArray(primary.errors) && primary.errors.length > 0) {
        const reason = (primary.errors[0] as { reason?: unknown } | null)?.reason;
        throw new GoogleCalendarError('google', 'Google could not read the calendar.', {
          reason: typeof reason === 'string' ? reason : 'calendar_error',
        });
      }
      const busy: BusyInterval[] = [];
      for (const item of Array.isArray(primary.busy) ? primary.busy : []) {
        const startDate = toDate((item as { start?: unknown } | null)?.start);
        const endDate = toDate((item as { end?: unknown } | null)?.end);
        if (!startDate || !endDate || endDate < startDate) {
          throw new GoogleCalendarError('google', 'Google sent an unreadable busy time.', { reason: 'bad_interval' });
        }
        busy.push({ startDate, endDate });
      }
      return busy;
    },

    async listOwnedCalendars() {
      const calendars: GoogleCalendarSummary[] = [];
      let pageToken: string | undefined;
      do {
        const body = (await request('GET', '/users/me/calendarList', {
          minAccessRole: 'owner',
          maxResults: String(PAGE_SIZE),
          pageToken,
        })) as { items?: unknown[]; nextPageToken?: unknown } | null;
        for (const item of body?.items ?? []) {
          const raw = item as Record<string, unknown> | null;
          if (raw && typeof raw.id === 'string') {
            calendars.push({ id: raw.id, summary: text(raw.summary), description: text(raw.description) || null });
          }
        }
        pageToken = typeof body?.nextPageToken === 'string' ? body.nextPageToken : undefined;
      } while (pageToken);
      return calendars;
    },

    async insertCalendar(input) {
      const body = (await request('POST', '/calendars', {}, input)) as { id?: unknown } | null;
      if (typeof body?.id !== 'string') {
        throw new GoogleCalendarError('google', 'Google created no calendar.', { reason: 'no_id' });
      }
      return { id: body.id };
    },

    async deleteCalendar(calendarId) {
      await request('DELETE', `/calendars/${path(calendarId)}`);
    },

    async listEvents(calendarId, { timeMin, timeMax }) {
      const events: GoogleEvent[] = [];
      let pageToken: string | undefined;
      do {
        const body = (await request('GET', `/calendars/${path(calendarId)}/events`, {
          timeMin: timeMin.toISOString(),
          timeMax: timeMax.toISOString(),
          singleEvents: 'true',
          showDeleted: 'false',
          maxResults: String(PAGE_SIZE),
          pageToken,
        })) as { items?: unknown[]; nextPageToken?: unknown } | null;
        for (const item of body?.items ?? []) {
          const event = toEvent(item);
          if (event) events.push(event);
        }
        pageToken = typeof body?.nextPageToken === 'string' ? body.nextPageToken : undefined;
      } while (pageToken);
      return events;
    },

    async insertEvent(calendarId, event) {
      await request('POST', `/calendars/${path(calendarId)}/events`, {}, eventBody(event));
    },

    async patchEvent(calendarId, eventId, event) {
      await request('PATCH', `/calendars/${path(calendarId)}/events/${path(eventId)}`, {}, eventBody(event));
    },

    async deleteEvent(calendarId, eventId) {
      try {
        await request('DELETE', `/calendars/${path(calendarId)}/events/${path(eventId)}`);
      } catch (error) {
        if (error instanceof GoogleCalendarError && error.code === 'not_found') return;
        throw error;
      }
    },
  };
}

/**
 * Asks Google to revoke a token (and the grant behind it). Best effort: the
 * token goes in the form body, never in the URL. Resolves false when Google
 * could not be told.
 */
export async function revokeGoogleToken(fetch: GoogleFetch, token: string): Promise<boolean> {
  try {
    const response = await fetch(GOOGLE_REVOKE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `token=${encodeURIComponent(token)}`,
    });
    // 400 invalid_token: already revoked or expired, which is what we wanted.
    return response.ok || response.status === 400;
  } catch {
    return false;
  }
}
