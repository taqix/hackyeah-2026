import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createCalendarService } from '../src/services/calendar/service';
import {
  captureAvailabilityFrom,
  type AvailabilitySlot,
  type CaptureAvailabilityOptions,
  type FreeTimeSource,
} from '../src/services/calendar/plan-availability';
import type { ExportSession } from '../src/services/calendar/plan-export';
import { createGoogleCalendarApi } from '../src/services/google-calendar/api';
import {
  GOOGLE_MOVO_CALENDAR_DESCRIPTION,
  removeGoogleMovoCalendar,
  syncPlanToGoogleCalendar,
  type MovoCalendarRef,
} from '../src/services/google-calendar/export';
import { freeFromBusy, googleFreeTimeSource } from '../src/services/google-calendar/free-busy';
import {
  createGoogleAccessTokens,
  createGoogleTokenStore,
  googleTokenKey,
  type GoogleTokens,
} from '../src/services/google-calendar/tokens';
import { GOOGLE_CALENDAR_SCOPES, GoogleCalendarError } from '../src/services/google-calendar/types';
import { memoryCalendar } from './calendar-fake-driver';
import { fakeGoogleCalendar, googleErrorBody } from './google-calendar-fake';

/** Local wall-clock time in October 2026 (day 12 is the next Monday). */
const local = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute);
const spans = (slots: AvailabilitySlot[]) => slots.map((slot) => [Date.parse(slot.start_at), Date.parse(slot.end_at)]);
const span = (day: number, from: number, to: number, fromMinute = 0, toMinute = 0) => [
  local(day, from, fromMinute).getTime(),
  local(day, to, toMinute).getTime(),
];
const week = (overrides: Partial<CaptureAvailabilityOptions> = {}): CaptureAvailabilityOptions => ({
  weekStart: '2026-10-05',
  from: local(5, 0),
  window: [8, 20],
  capturedAt: local(5, 6, 30),
  timeZone: 'Europe/Warsaw',
  ...overrides,
});
const busy = (start: Date, end: Date) => ({ start: start.toISOString(), end: end.toISOString() });
const interval = (start: Date, end: Date) => ({ startDate: start, endDate: end });

/** The Google client over the fake, with a fixed token. */
function googleApi(google = fakeGoogleCalendar()) {
  return { google, api: createGoogleCalendarApi({ fetch: google.fetch, accessToken: async () => 'google-access-1' }) };
}

/* ------------------------------------------------------------- Scopes */

test('the app asks Google for free/busy and its own calendars only', () => {
  assert.deepEqual([...GOOGLE_CALENDAR_SCOPES], [
    'https://www.googleapis.com/auth/calendar.freebusy',
    'https://www.googleapis.com/auth/calendar.app.created',
  ]);
});

/* ---------------------------------------------------------- Free/busy */

test('busy times become the free gaps between them, clipped and merged', () => {
  const range = interval(local(5, 8), local(5, 20));
  assert.deepEqual(freeFromBusy([], range), [range]);
  const free = freeFromBusy(
    [
      interval(local(5, 7), local(5, 9)), // starts before the range
      interval(local(5, 12), local(5, 13)),
      interval(local(5, 12, 30), local(5, 14)), // overlaps
      interval(local(5, 12, 45), local(5, 13)), // nested
      interval(local(5, 14), local(5, 15)), // adjacent
      interval(local(5, 16), local(5, 16)), // zero length
      interval(local(5, 19), local(5, 22)), // ends after the range
    ],
    range,
  );
  assert.deepEqual(
    free.map((slot) => [slot.startDate.getTime(), slot.endDate.getTime()]),
    [span(5, 9, 12), span(5, 15, 19)],
  );
  assert.deepEqual(freeFromBusy([interval(local(5, 0), local(6, 0))], range), []);
});

test('free/busy asks for the primary calendar in the plan time zone and never for events', async () => {
  const { google, api } = googleApi();
  google.state.busy = [busy(local(5, 10), local(5, 11)), busy(local(6, 9), local(6, 17))];
  const source = googleFreeTimeSource(api);
  const free = await source.freeSlots({ startDate: local(5, 8), endDate: local(7, 0), timeZone: 'Europe/Warsaw' });
  assert.deepEqual(
    free.map((slot) => [slot.startDate.getTime(), slot.endDate.getTime()]),
    [
      [local(5, 8).getTime(), local(5, 10).getTime()],
      [local(5, 11).getTime(), local(6, 9).getTime()],
      [local(6, 17).getTime(), local(7, 0).getTime()],
    ],
  );
  assert.equal(google.calls.length, 1);
  const [call] = google.calls;
  assert.equal(call!.method, 'POST');
  assert.equal(call!.path, '/freeBusy');
  assert.equal(call!.token, 'google-access-1');
  assert.deepEqual(call!.body, {
    timeMin: local(5, 8).toISOString(),
    timeMax: local(7, 0).toISOString(),
    timeZone: 'Europe/Warsaw',
    items: [{ id: 'primary' }],
  });
});

test('Google availability is cut into the same daily windows, with the source google_calendar', async () => {
  const { google, api } = googleApi();
  google.state.busy = [busy(local(5, 10), local(7, 9)), busy(local(10, 0), local(10, 23))];
  const device = memoryCalendar();
  const availability = await captureAvailabilityFrom(device.service, week(), { google: googleFreeTimeSource(api) });
  assert.equal(availability.source, 'google_calendar');
  assert.deepEqual(spans(availability.slots), [
    span(5, 8, 10),
    span(7, 9, 20),
    span(8, 8, 20),
    span(9, 8, 20),
    span(11, 8, 20),
  ]);
  assert.equal(device.driver.getEvents.mock.callCount(), 0, 'the device calendar is not read');

  // A fully busy week is a valid, empty Google result.
  google.state.busy = [busy(local(5, 0), local(12, 0))];
  const full = await captureAvailabilityFrom(device.service, week(), { google: googleFreeTimeSource(api) });
  assert.deepEqual([full.source, full.slots], ['google_calendar', []]);
});

test('daylight saving weeks keep the local window with Google free time', async () => {
  // Europe moves its clocks on 25 October 2026, the United States on 1 November.
  for (const [weekStart, firstDay] of [['2026-10-19', 19], ['2026-10-26', 26]] as const) {
    const { api } = googleApi();
    const availability = await captureAvailabilityFrom(
      createCalendarService(null),
      week({ weekStart, from: local(firstDay, 0), window: [7, 21] }),
      { google: googleFreeTimeSource(api) },
    );
    assert.equal(availability.source, 'google_calendar');
    assert.equal(availability.slots.length, 7);
    availability.slots.forEach((slot, day) => {
      assert.equal(Date.parse(slot.start_at), local(firstDay + day, 7).getTime());
      assert.equal(Date.parse(slot.end_at), local(firstDay + day, 21).getTime());
      assert.match(slot.start_at, /T07:00:00[+-]/);
      assert.match(slot.end_at, /T21:00:00[+-]/);
    });
  }
});

test('a failed Google read falls back to the device calendar, then manual, never an empty Google result', async () => {
  const failing: FreeTimeSource = {
    freeSlots: async () => {
      throw new GoogleCalendarError('reconnect_required', 'Reconnect.');
    },
  };
  const device = memoryCalendar();
  device.addEvent({ calendarId: 'personal', title: 'Dentist', startDate: local(5, 9), endDate: local(5, 10) });
  const fromDevice = await captureAvailabilityFrom(device.service, week(), { google: failing });
  assert.equal(fromDevice.source, 'device_calendar');
  assert.deepEqual(spans(fromDevice.slots)[0], span(5, 8, 9));

  const offline: FreeTimeSource = {
    freeSlots: async () => {
      throw new GoogleCalendarError('offline', 'Offline.');
    },
  };
  const manual = await captureAvailabilityFrom(createCalendarService(null), week(), { google: offline });
  assert.equal(manual.source, 'manual');
  assert.equal(manual.slots.length, 7);

  // Google answering with a calendar error for the primary calendar is a failed read too.
  const { google, api } = googleApi();
  google.state.failures.push({ status: 200, body: { calendars: { primary: { busy: [], errors: [{ reason: 'internalError' }] } } } });
  const afterError = await captureAvailabilityFrom(createCalendarService(null), week(), { google: googleFreeTimeSource(api) });
  assert.equal(afterError.source, 'manual');
  assert.ok(afterError.slots.length > 0);

  // Without a Google source, nothing changes.
  assert.equal((await captureAvailabilityFrom(device.service, week(), { google: null })).source, 'device_calendar');
});

/* ------------------------------------------------------------- Client */

test('a 401 refreshes the token once; a refused scope or a second 401 means reconnect', async () => {
  const google = fakeGoogleCalendar();
  google.state.validTokens = new Set(['fresh']);
  const asked: boolean[] = [];
  const api = createGoogleCalendarApi({
    fetch: google.fetch,
    accessToken: async (force = false) => {
      asked.push(force);
      return force ? 'fresh' : 'stale';
    },
  });
  await api.freeBusy({ timeMin: local(5, 0), timeMax: local(6, 0), timeZone: 'Europe/Warsaw' });
  assert.deepEqual(asked, [false, true]);
  assert.deepEqual(google.calls.map((call) => call.token), ['stale', 'fresh']);

  google.state.validTokens = new Set();
  await assert.rejects(
    api.freeBusy({ timeMin: local(5, 0), timeMax: local(6, 0), timeZone: 'Europe/Warsaw' }),
    (error) => error instanceof GoogleCalendarError && error.code === 'reconnect_required' && error.status === 401,
  );

  const { google: scoped, api: scopedApi } = googleApi();
  scoped.state.failures.push({ status: 403, body: googleErrorBody(403, 'insufficientPermissions') });
  await assert.rejects(
    scopedApi.freeBusy({ timeMin: local(5, 0), timeMax: local(6, 0), timeZone: 'Europe/Warsaw' }),
    (error) => error instanceof GoogleCalendarError && error.code === 'reconnect_required',
  );
  for (const [reply, code] of [
    [{ status: 503, body: googleErrorBody(503, 'backendError') }, 'google'],
    [{ status: 403, body: googleErrorBody(403, 'rateLimitExceeded') }, 'google'],
    [new TypeError('Network request failed'), 'offline'],
  ] as const) {
    scoped.state.failures.push(reply);
    await assert.rejects(
      scopedApi.freeBusy({ timeMin: local(5, 0), timeMax: local(6, 0), timeZone: 'Europe/Warsaw' }),
      (error) => error instanceof GoogleCalendarError && error.code === code,
    );
  }
});

/* ------------------------------------------------------------- Tokens */

function memoryStorage() {
  const items = new Map<string, string>();
  return {
    items,
    getItem: async (key: string) => items.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      items.set(key, value);
    },
    removeItem: async (key: string) => {
      items.delete(key);
    },
  };
}

const stored = (overrides: Partial<GoogleTokens> = {}): GoogleTokens => ({
  access_token: 'google-access-1',
  expires_at: Date.UTC(2026, 9, 5, 12),
  refresh_token: 'google-refresh-1',
  email: 'ana@example.com',
  connected_at: Date.UTC(2026, 9, 5, 11),
  needs_reconnect: false,
  ...overrides,
});

test('a fresh token is used as is; an expiring one is refreshed once for concurrent callers', async () => {
  const storage = memoryStorage();
  const store = createGoogleTokenStore(storage);
  await store.write('user-1', stored());
  let clock = Date.UTC(2026, 9, 5, 11, 30);
  const refreshes: string[] = [];
  const tokens = createGoogleAccessTokens({
    store,
    now: () => clock,
    refresh: async (refreshToken) => {
      refreshes.push(refreshToken);
      return { access_token: 'google-access-2', expires_in: 3599 };
    },
  });
  assert.equal(await tokens.get('user-1'), 'google-access-1');
  assert.deepEqual(refreshes, []);

  clock = Date.UTC(2026, 9, 5, 11, 59, 30); // within the minute before expiry
  const [a, b] = await Promise.all([tokens.get('user-1'), tokens.get('user-1')]);
  assert.deepEqual([a, b], ['google-access-2', 'google-access-2']);
  assert.deepEqual(refreshes, ['google-refresh-1']);
  const saved = await store.read('user-1');
  assert.equal(saved?.expires_at, clock + 3599 * 1000);
  assert.equal(saved?.refresh_token, 'google-refresh-1', 'the refresh token is kept');
  assert.ok(storage.items.has(googleTokenKey('user-1')));
  assert.match(googleTokenKey('user-1'), /^[\w.-]+$/, 'a key the secure store accepts');

  // Another account on the same phone has no tokens.
  await assert.rejects(tokens.get('user-2'), (error) => error instanceof GoogleCalendarError && error.code === 'not_connected');
});

test('a refused refresh marks the tokens for reconnect; a passing failure does not', async () => {
  const store = createGoogleTokenStore(memoryStorage());
  const now = () => Date.UTC(2026, 9, 5, 13);
  let calls = 0;
  let failure: GoogleCalendarError = new GoogleCalendarError('offline', 'Offline.');
  const tokens = createGoogleAccessTokens({
    store,
    now,
    refresh: async () => {
      calls += 1;
      throw failure;
    },
  });
  await store.write('user-1', stored());
  await assert.rejects(tokens.get('user-1'), (error) => error instanceof GoogleCalendarError && error.code === 'offline');
  assert.equal((await store.read('user-1'))?.needs_reconnect, false);

  failure = new GoogleCalendarError('reconnect_required', 'Refused.', { reason: 'GOOGLE_RECONNECT_REQUIRED' });
  await assert.rejects(tokens.get('user-1'), (error) => error instanceof GoogleCalendarError && error.code === 'reconnect_required');
  assert.equal((await store.read('user-1'))?.needs_reconnect, true);
  await assert.rejects(tokens.get('user-1'), (error) => error instanceof GoogleCalendarError && error.code === 'reconnect_required');
  assert.equal(calls, 2, 'once marked, refresh is not tried again until the person reconnects');

  // Without a refresh token, an expired access token also needs a reconnect.
  await store.write('user-3', stored({ refresh_token: null }));
  await assert.rejects(tokens.get('user-3'), (error) => error instanceof GoogleCalendarError && error.code === 'reconnect_required');
  assert.equal((await store.read('user-3'))?.needs_reconnect, true);
});

/* ------------------------------------------------------------- Export */

const session = (id: string, day: number, hour: number, overrides: Partial<ExportSession> = {}): ExportSession => ({
  id,
  title: `Walk ${id}`,
  description: 'An easy walk.',
  start: local(day, hour),
  end: local(day, hour, 30),
  timezone: 'Europe/Warsaw',
  ...overrides,
});
const plan = () => [session('a', 5, 8), session('b', 7, 18), session('c', 10, 9, { description: '' })];
const range = { start: local(5, 0), end: local(12, 0) };

function movoRef(initial: string | null = null) {
  const ref = { id: initial };
  const calendar: MovoCalendarRef = {
    get: async () => ref.id,
    set: async (id) => {
      ref.id = id;
    },
  };
  return { ref, calendar };
}

function movoEvents(google: ReturnType<typeof fakeGoogleCalendar>, calendarId: string) {
  return [...(google.state.events.get(calendarId)?.values() ?? [])]
    .map((event) => [
      event.extendedProperties?.private?.movoActivityId ?? null,
      event.summary,
      Date.parse(event.start.dateTime),
      Date.parse(event.end.dateTime),
    ])
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
}

test('the first Google sync creates the Movo calendar and one marked event per session; a second run writes nothing', async () => {
  const { google, api } = googleApi();
  const { ref, calendar } = movoRef();
  const target = { api, calendar, timeZone: 'Europe/Warsaw' };
  assert.deepEqual(await syncPlanToGoogleCalendar(plan(), range, target), { created: 3, updated: 0, deleted: 0 });
  assert.ok(ref.id, 'the calendar ID is remembered');
  const created = google.state.calendars.get(ref.id!);
  assert.deepEqual([created?.summary, created?.description, created?.timeZone], [
    'Movo',
    GOOGLE_MOVO_CALENDAR_DESCRIPTION,
    'Europe/Warsaw',
  ]);
  assert.deepEqual(movoEvents(google, ref.id!), [
    ['a', 'Walk a', local(5, 8).getTime(), local(5, 8, 30).getTime()],
    ['b', 'Walk b', local(7, 18).getTime(), local(7, 18, 30).getTime()],
    ['c', 'Walk c', local(10, 9).getTime(), local(10, 9, 30).getTime()],
  ]);
  const first = [...google.state.events.get(ref.id!)!.values()][0]!;
  assert.deepEqual(first.start, { dateTime: local(5, 8).toISOString(), timeZone: 'Europe/Warsaw' });
  assert.equal(first.description, 'An easy walk.');

  const before = google.writes();
  assert.deepEqual(await syncPlanToGoogleCalendar(plan(), range, target), { created: 0, updated: 0, deleted: 0 });
  assert.equal(google.writes(), before);
  assert.equal(google.state.calendars.size, 1);
});

test('a changed plan updates moved sessions, adds new ones and deletes stale marked events only', async () => {
  const { google, api } = googleApi();
  const { ref, calendar } = movoRef();
  const target = { api, calendar, timeZone: 'Europe/Warsaw' };
  await syncPlanToGoogleCalendar(plan(), range, target);
  const mine = google.addEvent(ref.id!, {
    summary: 'My own note',
    description: '',
    start: { dateTime: local(6, 12).toISOString() },
    end: { dateTime: local(6, 13).toISOString() },
  });
  // A duplicate of session a (an earlier sync that was cut short).
  google.addEvent(ref.id!, {
    summary: 'Walk a',
    description: 'An easy walk.',
    start: { dateTime: local(5, 8).toISOString() },
    end: { dateTime: local(5, 8, 30).toISOString() },
    extendedProperties: { private: { movoActivityId: 'a' } },
  });

  const changed = [session('a', 5, 8), session('b', 8, 7, { title: 'Morning walk' }), session('d', 11, 10)];
  assert.deepEqual(await syncPlanToGoogleCalendar(changed, range, target), { created: 1, updated: 1, deleted: 2 });
  assert.deepEqual(movoEvents(google, ref.id!), [
    ['a', 'Walk a', local(5, 8).getTime(), local(5, 8, 30).getTime()],
    ['b', 'Morning walk', local(8, 7).getTime(), local(8, 7, 30).getTime()],
    ['d', 'Walk d', local(11, 10).getTime(), local(11, 10, 30).getTime()],
    [null, 'My own note', local(6, 12).getTime(), local(6, 13).getTime()],
  ]);
  assert.ok(google.state.events.get(ref.id!)!.has(mine), 'an event without the marker is left alone');
});

test('a Movo calendar deleted in Google is created again; one found by its description is reused', async () => {
  const { google, api } = googleApi();
  const { ref, calendar } = movoRef('gone@group.calendar.google.com');
  const target = { api, calendar, timeZone: 'Europe/Warsaw' };
  assert.deepEqual(await syncPlanToGoogleCalendar(plan(), range, target), { created: 3, updated: 0, deleted: 0 });
  assert.notEqual(ref.id, 'gone@group.calendar.google.com');
  assert.equal(google.state.calendars.size, 1);

  // After a reinstall the ID is forgotten: listing finds the same calendar again.
  const fresh = movoRef();
  assert.deepEqual(await syncPlanToGoogleCalendar(plan(), range, { ...target, calendar: fresh.calendar }), {
    created: 0,
    updated: 0,
    deleted: 0,
  });
  assert.equal(fresh.ref.id, ref.id);

  // When these scopes may not list calendars, a new one is created instead.
  google.state.calendarListStatus = 403;
  const again = movoRef();
  await syncPlanToGoogleCalendar(plan(), range, { ...target, calendar: again.calendar });
  assert.notEqual(again.ref.id, ref.id);
  assert.equal(google.state.calendars.size, 2);
});

test('removing the Google Movo calendar deletes it and forgets its ID', async () => {
  const { google, api } = googleApi();
  const { ref, calendar } = movoRef();
  await syncPlanToGoogleCalendar(plan(), range, { api, calendar, timeZone: 'Europe/Warsaw' });
  assert.equal(await removeGoogleMovoCalendar({ api, calendar }), true);
  assert.equal(ref.id, null);
  assert.equal(google.state.calendars.size, 0);
  assert.equal(await removeGoogleMovoCalendar({ api, calendar }), false);

  // Already deleted in Google: nothing to do, the ID is forgotten.
  const stale = movoRef('gone@group.calendar.google.com');
  assert.equal(await removeGoogleMovoCalendar({ api, calendar: stale.calendar }), false);
  assert.equal(stale.ref.id, null);
});

test('a failed Google write propagates, and the next run finishes the job', async () => {
  const { google, api } = googleApi();
  const { ref, calendar } = movoRef();
  const target = { api, calendar, timeZone: 'Europe/Warsaw' };
  await syncPlanToGoogleCalendar([session('a', 5, 8)], range, target);
  google.state.failures.push({ status: 503, body: googleErrorBody(503, 'backendError') });
  // The list call fails first.
  await assert.rejects(syncPlanToGoogleCalendar(plan(), range, target), (error) => error instanceof GoogleCalendarError && error.code === 'google');
  assert.deepEqual(await syncPlanToGoogleCalendar(plan(), range, target), { created: 2, updated: 0, deleted: 0 });
  assert.equal(movoEvents(google, ref.id!).length, 3);
});
