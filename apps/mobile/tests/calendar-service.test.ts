import assert from 'node:assert/strict';
import { mock, test } from 'node:test';

import { createCalendarService } from '../src/services/calendar/service';
import {
  CalendarError,
  type CalendarErrorCode,
  type CalendarEvent,
  type CalendarPermission,
  type DeviceCalendar,
  type NewCalendarEvent,
} from '../src/services/calendar/types';

const granted: CalendarPermission = { status: 'granted', canAskAgain: true };
const calendar: DeviceCalendar = {
  id: 'personal', title: 'Personal', source: 'Local', allowsModifications: true,
};
const range = () => ({
  startDate: new Date('2026-10-03T10:00:00Z'),
  endDate: new Date('2026-10-03T11:00:00Z'),
});
const newEvent = () => ({ calendarId: calendar.id, title: 'Walk', ...range() } satisfies NewCalendarEvent);
const event = (overrides: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: 'event', occurrenceKey: 'event:1', calendarId: calendar.id, title: 'Walk',
  ...range(), allDay: false, location: null, notes: null,
  availability: 'busy', status: 'confirmed', ...overrides,
});

function setup() {
  const state = {
    permission: { ...granted },
    calendars: [calendar],
    events: [] as CalendarEvent[],
  };
  const driver = {
    getPermission: mock.fn(async () => state.permission),
    requestPermission: mock.fn(async () => (state.permission = { ...granted })),
    listCalendars: mock.fn(async () => state.calendars),
    getEvents: mock.fn(async (_ids: string[], _start: Date, _end: Date) => state.events),
    createEvent: mock.fn(async (input: NewCalendarEvent) => event(input)),
  };
  return { state, driver, service: createCalendarService(driver) };
}

function hasCode(code: CalendarErrorCode) {
  return (error: unknown) => error instanceof CalendarError && error.code === code;
}

test('operations never prompt implicitly and denied errors retain the settings recovery state', async () => {
  const { state, service, driver } = setup();
  state.permission = { status: 'denied', canAskAgain: false };

  assert.deepEqual(await service.getPermission(), state.permission);
  for (const operation of [
    () => service.listCalendars(),
    () => service.getEvents(range()),
    () => service.createEvent(newEvent()),
  ]) {
    await assert.rejects(operation, (error: unknown) =>
      error instanceof CalendarError && error.code === 'permission-denied' &&
      error.permission?.canAskAgain === false);
  }
  assert.deepEqual(await service.requestPermission(), state.permission);
  assert.equal(driver.requestPermission.mock.callCount(), 0);
  assert.equal(driver.listCalendars.mock.callCount(), 0);
  assert.equal(driver.createEvent.mock.callCount(), 0);
});

test('only an explicit request prompts, and a subsequent operation detects revoked access', async () => {
  const { state, service, driver } = setup();
  state.permission = { status: 'undetermined', canAskAgain: true };
  assert.deepEqual(await service.requestPermission(), granted);
  await service.requestPermission();
  assert.equal(driver.requestPermission.mock.callCount(), 1);
  assert.deepEqual(await service.listCalendars(), [calendar]);

  state.permission = { status: 'denied', canAskAgain: true };
  await assert.rejects(service.getEvents(range()), hasCode('permission-denied'));
  assert.equal(driver.getEvents.mock.callCount(), 0);
});

test('unsupported environments report unavailable without accessing a native module', async () => {
  const service = createCalendarService(null);
  const permission = { status: 'unavailable', canAskAgain: false };
  assert.deepEqual(await service.getPermission(), permission);
  assert.deepEqual(await service.requestPermission(), permission);
  await assert.rejects(service.listCalendars(), hasCode('unavailable'));
  await assert.rejects(service.getEvents(range()), hasCode('unavailable'));
  await assert.rejects(service.createEvent(newEvent()), hasCode('unavailable'));
});

test('empty selections and no installed calendars return no events; stale selections fail', async () => {
  const { state, service, driver } = setup();
  assert.deepEqual(await service.getEvents({ ...range(), calendarIds: [] }), []);
  state.calendars = [];
  assert.deepEqual(await service.getEvents(range()), []);
  await assert.rejects(
    service.getEvents({ ...range(), calendarIds: ['deleted'] }),
    hasCode('calendar-not-found'),
  );
  assert.equal(driver.getEvents.mock.callCount(), 0);
});

test('queries include overlaps and in-range point events, with half-open boundaries', async () => {
  const { state, service, driver } = setup();
  const at = (hour: number, minute = 0) => new Date(Date.UTC(2026, 9, 3, hour, minute));
  state.events = [
    event({ occurrenceKey: 'right-overlap', startDate: at(10, 45), endDate: at(12) }),
    event({ occurrenceKey: 'ends-at-start', startDate: at(9), endDate: at(10) }),
    event({ occurrenceKey: 'starts-at-end', startDate: at(11), endDate: at(12) }),
    event({ occurrenceKey: 'point-at-start', startDate: at(10), endDate: at(10) }),
    event({ occurrenceKey: 'point-at-end', startDate: at(11), endDate: at(11) }),
    event({ occurrenceKey: 'left-overlap', startDate: at(9), endDate: at(10, 15) }),
    event({ occurrenceKey: 'other-calendar', calendarId: 'other' }),
  ];
  const found = await service.getEvents({ ...range(), calendarIds: ['personal', 'personal'] });
  assert.deepEqual(found.map(({ occurrenceKey }) => occurrenceKey), [
    'left-overlap', 'point-at-start', 'right-overlap',
  ]);
  assert.deepEqual(driver.getEvents.mock.calls[0].arguments[0], ['personal']);
});

test('long queries deduplicate chunk overlaps while preserving recurring occurrences with the same ID', async () => {
  const { state, service, driver } = setup();
  const query = {
    startDate: new Date('2026-01-01T00:00:00Z'),
    endDate: new Date('2027-01-03T00:00:00Z'),
  };
  state.events = [
    event({ occurrenceKey: 'event:first', startDate: query.startDate, endDate: query.endDate }),
    event({ occurrenceKey: 'event:second', startDate: new Date('2027-01-02T10:00:00Z'), endDate: new Date('2027-01-02T11:00:00Z') }),
  ];
  const found = await service.getEvents(query);
  assert.deepEqual(found.map(({ occurrenceKey }) => occurrenceKey), ['event:first', 'event:second']);
  const calls = driver.getEvents.mock.calls;
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0].arguments[1], query.startDate);
  assert.deepEqual(calls[0].arguments[2], calls[1].arguments[1]);
  assert.deepEqual(calls[1].arguments[2], query.endDate);
});

test('writable filtering and creation reject read-only or deleted calendars', async () => {
  const { state, service, driver } = setup();
  state.calendars.push({ ...calendar, id: 'holidays', allowsModifications: false });
  assert.deepEqual(await service.listCalendars({ writableOnly: true }), [calendar]);
  assert.equal((await service.listCalendars()).length, 2);
  await assert.rejects(service.createEvent({ ...newEvent(), calendarId: 'holidays' }), hasCode('calendar-read-only'));
  await assert.rejects(service.createEvent({ ...newEvent(), calendarId: 'deleted' }), hasCode('calendar-not-found'));
  assert.equal(driver.createEvent.mock.callCount(), 0);
});

test('invalid query and event ranges fail before OS access', async () => {
  const { service, driver } = setup();
  for (const dates of [
    { startDate: new Date(NaN), endDate: range().endDate },
    { startDate: range().startDate, endDate: new Date(NaN) },
    { startDate: range().startDate, endDate: range().startDate },
    { startDate: range().endDate, endDate: range().startDate },
    { startDate: '2026-10-03' as unknown as Date, endDate: range().endDate },
  ]) {
    await assert.rejects(service.getEvents(dates), hasCode('invalid-input'));
    await assert.rejects(service.createEvent({ ...newEvent(), ...dates }), hasCode('invalid-input'));
  }
  assert.equal(driver.getPermission.mock.callCount(), 0);
});

test('creation validates titles, calendar IDs, all-day dates, and time zones before OS access', async () => {
  const { service, driver } = setup();
  const invalidEvents: NewCalendarEvent[] = [
    { ...newEvent(), title: '   ' },
    { ...newEvent(), calendarId: '   ' },
    { ...newEvent(), allDay: true, startDate: new Date(2026, 9, 3, 12), endDate: new Date(2026, 9, 4) },
    { ...newEvent(), allDay: true, startDate: new Date(2026, 9, 3), endDate: new Date(2026, 9, 4, 0, 1) },
    { ...newEvent(), allDay: false, timeZone: 'Not/A_Time_Zone' },
    { ...newEvent(), allDay: true, startDate: new Date(2026, 9, 3), endDate: new Date(2026, 9, 4), timeZone: 'Europe/Warsaw' } as unknown as NewCalendarEvent,
  ];
  for (const input of invalidEvents) {
    await assert.rejects(service.createEvent(input), hasCode('invalid-input'));
  }
  assert.equal(driver.getPermission.mock.callCount(), 0);
});

test('successful timed and all-day writes preserve scheduling details and return the saved event', async () => {
  const { service, driver } = setup();
  const input: NewCalendarEvent = {
    ...newEvent(), title: '  Walk  ', allDay: false, timeZone: 'Europe/Warsaw',
    location: 'Park', notes: 'Easy pace',
  };
  const saved = await service.createEvent(input);
  assert.deepEqual(driver.createEvent.mock.calls[0].arguments[0], { ...input, title: 'Walk' });
  assert.equal(saved.id, 'event');
  assert.equal(saved.title, 'Walk');

  const allDay: NewCalendarEvent = {
    ...newEvent(), allDay: true, startDate: new Date(2026, 9, 3), endDate: new Date(2026, 9, 4),
  };
  await service.createEvent(allDay);
  assert.deepEqual(driver.createEvent.mock.calls[1].arguments[0], allDay);
});

test('query and write inputs are snapshotted before asynchronous permission checks', async () => {
  const { service, driver } = setup();
  const query = { ...range(), calendarIds: ['personal'] };
  const reading = service.getEvents(query);
  query.startDate.setFullYear(2000);
  query.endDate.setFullYear(2001);
  query.calendarIds[0] = 'deleted';
  await reading;
  assert.deepEqual(driver.getEvents.mock.calls[0].arguments, [
    ['personal'], range().startDate, range().endDate,
  ]);

  const input = newEvent();
  const writing = service.createEvent(input);
  input.startDate.setFullYear(2000);
  input.endDate.setFullYear(2001);
  input.title = 'Changed later';
  await writing;
  assert.deepEqual(driver.createEvent.mock.calls[0].arguments[0], newEvent());
});

test('native failures are actionable and writes are never retried after uncertain saves', async () => {
  const { service, driver } = setup();
  const nativeFailure = new Error('OS response failed');
  driver.createEvent.mock.mockImplementation(async () => { throw nativeFailure; });
  await assert.rejects(service.createEvent(newEvent()), (error: unknown) =>
    error instanceof CalendarError && error.code === 'native-error' && error.cause === nativeFailure);
  assert.equal(driver.createEvent.mock.callCount(), 1);

  driver.getEvents.mock.mockImplementation(async () => { throw nativeFailure; });
  await assert.rejects(service.getEvents(range()), hasCode('native-error'));
  assert.equal(driver.getEvents.mock.callCount(), 1);
});
