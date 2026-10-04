import assert from 'node:assert/strict';
import { mock, test } from 'node:test';

import {
  CalendarError,
  createCalendarAvailabilityService,
  deviceCalendarAvailability,
  type CalendarErrorCode,
  type CalendarEvent,
  type CalendarEventQuery,
} from '../src/services/calendar';

const at = (hour: number, minute = 0) => new Date(Date.UTC(2026, 9, 3, hour, minute));
const range = (start = 9, end = 17) => ({ startDate: at(start), endDate: at(end) });
const event = (
  start: number,
  end: number,
  overrides: Partial<CalendarEvent> = {},
): CalendarEvent => ({
  id: 'event',
  occurrenceKey: `event:${start}`,
  calendarId: 'personal',
  title: 'Commitment',
  ...range(start, end),
  allDay: false,
  location: null,
  notes: null,
  availability: 'busy',
  status: 'confirmed',
  ...overrides,
});

function setup(events: CalendarEvent[] = []) {
  const calendar = { getEvents: mock.fn(async (_query: CalendarEventQuery) => events) };
  return { calendar, service: createCalendarAvailabilityService(calendar) };
}

test('an empty calendar leaves the whole requested range free, with independent dates', async () => {
  const { service } = setup();
  const query = range();
  const slots = await service.getFreeSlots(query);
  assert.deepEqual(slots, [range()]);
  assert.notEqual(slots[0].startDate, query.startDate);
  assert.notEqual(slots[0].endDate, query.endDate);
});

test('unsorted, overlapping, nested, duplicate, and adjacent events form maximal gaps', async () => {
  const events = [
    event(14, 15),
    event(10, 12),
    event(11, 13),
    event(10, 11),
    event(15, 16),
    event(10, 12),
  ];
  const original = structuredClone(events);
  const { service } = setup(events);
  assert.deepEqual(await service.getFreeSlots(range()), [
    range(9, 10),
    range(13, 14),
    range(16, 17),
  ]);
  assert.deepEqual(events, original);
});

test('busy intervals are clipped to query boundaries', async () => {
  const { service } = setup([event(8, 10), event(16, 18)]);
  assert.deepEqual(await service.getFreeSlots(range()), [range(10, 16)]);
});

test('a fully occupied range returns no slots', async () => {
  for (const events of [[event(8, 18)], [event(9, 12), event(12, 17)]]) {
    const { service } = setup(events);
    assert.deepEqual(await service.getFreeSlots(range()), []);
  }
});

test('half-open boundaries and zero-length events do not split free time', async () => {
  const { service } = setup([
    event(7, 8),
    event(8, 9),
    event(17, 18),
    event(18, 19),
    event(9, 9),
    event(12, 12),
    event(17, 17),
  ]);
  assert.deepEqual(await service.getFreeSlots(range()), [range()]);
});

test('all-day holidays do not block free time by default, even when marked busy', async () => {
  for (const availability of ['busy', 'notSupported'] as const) {
    const { service } = setup([
      event(0, 24, { allDay: true, title: 'Public holiday', availability }),
      event(10, 11),
    ]);
    assert.deepEqual(await service.getFreeSlots(range()), [range(9, 10), range(11, 17)]);
    assert.deepEqual(await service.getFreeSlots({ ...range(), blockAllDayEvents: false }), [
      range(9, 10),
      range(11, 17),
    ]);
  }
});

test('all-day busy events block time when explicitly requested', async () => {
  const { calendar, service } = setup([event(0, 24, { allDay: true })]);
  assert.deepEqual(await service.getFreeSlots({ ...range(), blockAllDayEvents: true }), []);
  assert.deepEqual(calendar.getEvents.mock.calls[0].arguments[0], {
    ...range(),
    calendarIds: undefined,
  });
});

test('canceled and explicitly free events do not block time, including all-day events', async () => {
  const { service } = setup([
    event(0, 24, { allDay: true, availability: 'free' }),
    event(0, 24, { allDay: true, status: 'canceled' }),
    event(10, 11, { status: 'canceled' }),
    event(12, 13, { availability: 'free' }),
  ]);
  assert.deepEqual(await service.getFreeSlots(range()), [range()]);
  assert.deepEqual(await service.getFreeSlots({ ...range(), blockAllDayEvents: true }), [range()]);
});

test('tentative, unavailable, and unsupported availability conservatively block time', async () => {
  for (const availability of ['busy', 'tentative', 'unavailable', 'notSupported'] as const) {
    for (const status of ['none', 'confirmed', 'tentative'] as const) {
      const { service } = setup([event(10, 11, { availability, status })]);
      assert.deepEqual(await service.getFreeSlots(range()), [range(9, 10), range(11, 17)]);
    }
  }
});

test('recurring occurrences sharing an ID each block their own time', async () => {
  const { service } = setup([event(10, 11), event(13, 14)]);
  assert.deepEqual(await service.getFreeSlots(range()), [
    range(9, 10),
    range(11, 13),
    range(14, 17),
  ]);
});

test('opted-in all-day occurrences retain local day boundaries across both DST transitions', async () => {
  // The runner exercises these dates in Europe/Warsaw and America/Los_Angeles.
  for (const [month, day] of [
    [2, 8],
    [2, 29],
    [9, 25],
    [10, 1],
  ]) {
    const query = {
      startDate: new Date(2026, month, day - 1),
      endDate: new Date(2026, month, day + 2),
    };
    const busy = event(0, 24, {
      allDay: true,
      startDate: new Date(2026, month, day),
      endDate: new Date(2026, month, day + 1),
    });
    const { service } = setup([busy]);
    assert.deepEqual(await service.getFreeSlots({ ...query, blockAllDayEvents: true }), [
      { startDate: query.startDate, endDate: busy.startDate },
      { startDate: busy.endDate, endDate: query.endDate },
    ]);
  }
});

test('timed occurrences use absolute instants regardless of their offset', async () => {
  const { service } = setup([
    event(0, 1, {
      startDate: new Date('2026-10-03T12:00:00+02:00'),
      endDate: new Date('2026-10-03T13:30:00+02:00'),
    }),
  ]);
  assert.deepEqual(await service.getFreeSlots(range()), [
    range(9, 10),
    { startDate: at(11, 30), endDate: at(17) },
  ]);
});

test('all-calendar, selected-calendar, and explicit empty filters pass through to the calendar API', async () => {
  for (const calendarIds of [undefined, ['personal', 'work'], []]) {
    const { calendar, service } = setup();
    const query = { ...range(), calendarIds };
    assert.deepEqual(await service.getFreeSlots(query), [range()]);
    assert.equal(calendar.getEvents.mock.callCount(), 1);
    assert.deepEqual(calendar.getEvents.mock.calls[0].arguments[0], query);
  }
});

test('invalid input ranges fail before reading the calendar', async () => {
  const { calendar, service } = setup();
  for (const query of [
    range(17, 9),
    range(9, 9),
    { startDate: new Date(NaN), endDate: at(17) },
    { startDate: at(9), endDate: new Date(NaN) },
    { startDate: '2026-10-03' as unknown as Date, endDate: at(17) },
    { startDate: at(9), endDate: '2026-10-04' as unknown as Date },
  ]) {
    await assert.rejects(
      service.getFreeSlots(query),
      (error: unknown) => error instanceof CalendarError && error.code === 'invalid-input',
    );
  }
  assert.equal(calendar.getEvents.mock.callCount(), 0);
});

test('calendar read failures propagate unchanged instead of reporting free time', async () => {
  const codes: CalendarErrorCode[] = [
    'permission-denied',
    'unavailable',
    'calendar-not-found',
    'native-error',
  ];
  for (const code of codes) {
    const failure = new CalendarError(code, 'Cannot read calendar.', {
      permission: { status: 'denied', canAskAgain: false },
      cause: new Error('Underlying failure'),
    });
    const { calendar, service } = setup();
    calendar.getEvents.mock.mockImplementation(async () => {
      throw failure;
    });
    await assert.rejects(service.getFreeSlots(range()), (error: unknown) => error === failure);
    assert.equal(calendar.getEvents.mock.callCount(), 1);
  }
});

test('invalid busy event ranges fail instead of yielding unreliable availability', async () => {
  for (const busy of [
    event(12, 11),
    event(10, 11, { startDate: new Date(NaN) }),
    event(10, 11, { endDate: new Date(NaN) }),
  ]) {
    const { service } = setup([busy]);
    await assert.rejects(
      service.getFreeSlots(range()),
      (error: unknown) => error instanceof CalendarError && error.code === 'native-error',
    );
  }
});

test('mutating query dates, calendar IDs, and all-day policy during a read does not change the result', async () => {
  const { calendar, service } = setup([event(10, 11), event(0, 24, { allDay: true })]);
  const query = { ...range(), calendarIds: ['personal'], blockAllDayEvents: false };
  const reading = service.getFreeSlots(query);
  query.startDate.setFullYear(2000);
  query.endDate.setFullYear(2001);
  query.calendarIds[0] = 'work';
  query.blockAllDayEvents = true;
  assert.deepEqual(await reading, [range(9, 10), range(11, 17)]);
  assert.deepEqual(calendar.getEvents.mock.calls[0].arguments[0], {
    ...range(),
    calendarIds: ['personal'],
  });
});

test('the public device implementation reports unavailable outside native platforms', async () => {
  await assert.rejects(
    deviceCalendarAvailability.getFreeSlots(range()),
    (error: unknown) => error instanceof CalendarError && error.code === 'unavailable',
  );
});
