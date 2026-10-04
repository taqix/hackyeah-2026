/**
 * Google Calendar API v3 in memory, behind a GoogleFetch: free/busy for the
 * primary calendar, calendars the app creates, and their events. Answers in
 * Google's shapes, including its error bodies, and records every call.
 */
import type { GoogleFetch, GoogleFetchInit } from '../src/services/google-calendar/types';

interface StoredEvent {
  id: string;
  summary: string;
  description: string;
  start: { dateTime: string; timeZone?: string };
  end: { dateTime: string; timeZone?: string };
  extendedProperties?: { private?: Record<string, string> };
  status?: string;
}

interface StoredCalendar {
  id: string;
  summary: string;
  description: string;
  timeZone?: string;
}

export interface GoogleCall {
  method: GoogleFetchInit['method'];
  path: string;
  query: Record<string, string>;
  body: unknown;
  token: string | null;
}

type Reply = { status: number; body?: unknown };

const API = 'https://www.googleapis.com/calendar/v3';

export function googleErrorBody(status: number, reason: string, message = 'Google says no.') {
  return { error: { code: status, message, errors: [{ domain: 'global', reason, message }] } };
}

export function fakeGoogleCalendar() {
  const state = {
    /** Access tokens Google accepts. */
    validTokens: new Set(['google-access-1']),
    /** Busy times of the primary calendar, as RFC 3339 strings. */
    busy: [] as { start: string; end: string }[],
    calendars: new Map<string, StoredCalendar>(),
    events: new Map<string, Map<string, StoredEvent>>(),
    /** The status calendarList.list answers with (403: not allowed for these scopes). */
    calendarListStatus: 200,
    /** Answers the next calls with these replies instead (one each), whatever the route. */
    failures: [] as (Reply | Error)[],
    nextId: 1,
  };
  const calls: GoogleCall[] = [];

  const reply = (status: number, body?: unknown) => ({
    status,
    ok: status >= 200 && status < 300,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  });
  const notFound = () => reply(404, googleErrorBody(404, 'notFound', 'Not Found'));

  function route(call: GoogleCall): Reply {
    const parts = call.path.split('/').filter(Boolean).map(decodeURIComponent);
    // POST /freeBusy
    if (call.method === 'POST' && parts[0] === 'freeBusy') {
      const body = call.body as { items: { id: string }[]; timeMin: string; timeMax: string };
      const min = Date.parse(body.timeMin);
      const max = Date.parse(body.timeMax);
      const calendars: Record<string, unknown> = {};
      for (const item of body.items) {
        calendars[item.id] =
          item.id === 'primary'
            ? { busy: state.busy.filter((b) => Date.parse(b.start) < max && Date.parse(b.end) > min) }
            : { busy: [], errors: [{ domain: 'global', reason: 'notFound' }] };
      }
      return { status: 200, body: { kind: 'calendar#freeBusy', timeMin: body.timeMin, timeMax: body.timeMax, calendars } };
    }
    // GET /users/me/calendarList
    if (call.method === 'GET' && parts.join('/') === 'users/me/calendarList') {
      if (state.calendarListStatus !== 200) {
        return { status: state.calendarListStatus, body: googleErrorBody(state.calendarListStatus, 'insufficientPermissions') };
      }
      return {
        status: 200,
        body: { items: [...state.calendars.values()].map((c) => ({ ...c, accessRole: 'owner' })) },
      };
    }
    if (parts[0] !== 'calendars') return { status: 404, body: googleErrorBody(404, 'notFound') };
    // POST /calendars
    if (parts.length === 1 && call.method === 'POST') {
      const body = call.body as Omit<StoredCalendar, 'id'>;
      const id = `movo-${state.nextId++}@group.calendar.google.com`;
      state.calendars.set(id, { id, ...body });
      state.events.set(id, new Map());
      return { status: 200, body: { kind: 'calendar#calendar', id, ...body } };
    }
    const calendarId = parts[1]!;
    const calendar = state.calendars.get(calendarId);
    const events = state.events.get(calendarId);
    if (!calendar || !events) return { status: 404, body: googleErrorBody(404, 'notFound') };
    // DELETE /calendars/{id}
    if (parts.length === 2 && call.method === 'DELETE') {
      state.calendars.delete(calendarId);
      state.events.delete(calendarId);
      return { status: 204 };
    }
    if (parts[2] !== 'events') return { status: 404, body: googleErrorBody(404, 'notFound') };
    // GET /calendars/{id}/events
    if (parts.length === 3 && call.method === 'GET') {
      const min = Date.parse(call.query.timeMin!);
      const max = Date.parse(call.query.timeMax!);
      const items = [...events.values()].filter(
        (e) => Date.parse(e.start.dateTime) < max && Date.parse(e.end.dateTime) > min,
      );
      // Two pages, so paging is exercised.
      const offset = Number(call.query.pageToken ?? 0);
      const page = items.slice(offset, offset + 2);
      const next = offset + 2 < items.length ? String(offset + 2) : undefined;
      return { status: 200, body: { items: page, ...(next ? { nextPageToken: next } : {}) } };
    }
    // POST /calendars/{id}/events
    if (parts.length === 3 && call.method === 'POST') {
      const id = `event-${state.nextId++}`;
      events.set(id, { id, ...(call.body as Omit<StoredEvent, 'id'>) });
      return { status: 200, body: events.get(id) };
    }
    const event = events.get(parts[3]!);
    if (!event) return { status: 410, body: googleErrorBody(410, 'deleted', 'Resource has been deleted') };
    if (call.method === 'PATCH') {
      Object.assign(event, call.body as Partial<StoredEvent>);
      return { status: 200, body: event };
    }
    if (call.method === 'DELETE') {
      events.delete(event.id);
      return { status: 204 };
    }
    return { status: 405, body: googleErrorBody(405, 'methodNotAllowed') };
  }

  const fetch: GoogleFetch = async (url, init) => {
    const parsed = new URL(url);
    const call: GoogleCall = {
      method: init.method,
      path: parsed.pathname.replace(/^\/calendar\/v3/, ''),
      query: Object.fromEntries(parsed.searchParams),
      body: init.body ? JSON.parse(init.body) : undefined,
      token: init.headers.Authorization?.replace(/^Bearer /, '') ?? null,
    };
    calls.push(call);
    if (!url.startsWith(API)) return notFound();
    const failure = state.failures.shift();
    if (failure instanceof Error) throw failure;
    if (failure) return reply(failure.status, failure.body);
    if (!call.token || !state.validTokens.has(call.token)) {
      return reply(401, googleErrorBody(401, 'authError', 'Invalid Credentials'));
    }
    const answer = route(call);
    return reply(answer.status, answer.body);
  };

  /** Writes so far (anything but GET and free/busy). */
  const writes = () => calls.filter((call) => call.method !== 'GET' && call.path !== '/freeBusy').length;

  /** Adds an event to a calendar directly, as the person would in Google. */
  function addEvent(calendarId: string, event: Omit<StoredEvent, 'id'>) {
    const id = `event-${state.nextId++}`;
    state.events.get(calendarId)?.set(id, { id, ...event });
    return id;
  }

  return { state, calls, fetch, writes, addEvent };
}
