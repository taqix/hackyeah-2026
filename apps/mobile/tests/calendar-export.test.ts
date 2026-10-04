import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { PlannedSession } from '../src/api/types';
import { exportRange, exportSessionsFrom } from '../src/features/calendar-export/export-sessions';
import { toIsoWithOffset } from '../src/lib/dates';
import { captureAvailabilityFrom } from '../src/services/calendar/plan-availability';
import {
  exportNotes,
  removeAppCalendar,
  sessionIdOf,
  syncPlanToCalendar,
  type ExportSession,
} from '../src/services/calendar/plan-export';
import { memoryCalendar } from './calendar-fake-driver';

const local = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute);
const range = { start: local(5, 0), end: local(12, 0) };
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
const movoEvents = (state: ReturnType<typeof memoryCalendar>['state']) => {
  const movo = state.calendars.find((calendar) => calendar.title === 'Movo');
  return state.events
    .filter((event) => event.calendarId === movo?.id)
    .map((event) => [sessionIdOf(event.notes), event.title, event.startDate.getTime(), event.endDate.getTime()])
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
};

test('the first sync creates the Movo calendar and one marked event per session; a second run writes nothing', async () => {
  const { state, driver, service, writes } = memoryCalendar();
  assert.deepEqual(await syncPlanToCalendar(plan(), range, service), { created: 3, updated: 0, deleted: 0 });
  assert.deepEqual(driver.createCalendar.mock.calls[0].arguments, ['Movo']);
  assert.deepEqual(movoEvents(state), [
    ['a', 'Walk a', local(5, 8).getTime(), local(5, 8, 30).getTime()],
    ['b', 'Walk b', local(7, 18).getTime(), local(7, 18, 30).getTime()],
    ['c', 'Walk c', local(10, 9).getTime(), local(10, 9, 30).getTime()],
  ]);
  const first = driver.createEvent.mock.calls[0].arguments[0];
  assert.equal(first.notes, 'An easy walk.\n\nmovo-activity:a');
  assert.equal(first.timeZone, 'Europe/Warsaw');
  assert.equal(driver.createEvent.mock.calls[2].arguments[0].notes, 'movo-activity:c');

  const before = writes();
  assert.deepEqual(await syncPlanToCalendar(plan(), range, service), { created: 0, updated: 0, deleted: 0 });
  assert.equal(writes(), before);
  assert.equal(state.calendars.filter((calendar) => calendar.title === 'Movo').length, 1);
});

test('a changed plan updates moved sessions, adds new ones and removes stale marker events only', async () => {
  const { state, driver, addEvent, service } = memoryCalendar();
  await syncPlanToCalendar(plan(), range, service);
  const movoId = state.calendars.find((calendar) => calendar.title === 'Movo')!.id;
  // Not ours to touch: another calendar's event with a marker, an unmarked Movo event, and history before the range.
  const personal = addEvent({ startDate: local(6, 8), endDate: local(6, 9), notes: 'movo-activity:x' });
  const unmarked = addEvent({ calendarId: movoId, startDate: local(6, 12), endDate: local(6, 13), notes: 'Lunch' });
  const history = addEvent({ calendarId: movoId, startDate: local(2, 8), endDate: local(2, 9), notes: 'movo-activity:old' });

  const next = [session('a', 5, 9, { title: 'Brisk walk' }), session('c', 10, 9, { description: '' }), session('d', 11, 10)];
  assert.deepEqual(await syncPlanToCalendar(next, range, service), { created: 1, updated: 1, deleted: 1 });
  assert.deepEqual(movoEvents(state).filter(([id]) => id !== 'old' && id !== null), [
    ['a', 'Brisk walk', local(5, 9).getTime(), local(5, 9, 30).getTime()],
    ['c', 'Walk c', local(10, 9).getTime(), local(10, 9, 30).getTime()],
    ['d', 'Walk d', local(11, 10).getTime(), local(11, 10, 30).getTime()],
  ]);
  assert.deepEqual(driver.updateEvent.mock.calls[0].arguments[1], {
    title: 'Brisk walk',
    startDate: local(5, 9),
    endDate: local(5, 9, 30),
    notes: 'An easy walk.\n\nmovo-activity:a',
    timeZone: 'Europe/Warsaw',
  });
  for (const id of [personal, unmarked, history]) {
    assert.ok(state.events.some((event) => event.id === id), `${id} is kept`);
  }
});

test('duplicate marker events collapse to one, and sessions outside the range are left alone', async () => {
  const { state, service } = memoryCalendar();
  const movo = await service.ensureAppCalendar();
  for (let i = 0; i < 2; i += 1) {
    await service.createEvent({
      calendarId: movo.id,
      title: 'Walk a',
      startDate: local(5, 8),
      endDate: local(5, 8, 30),
      notes: exportNotes(session('a', 5, 8)),
    });
  }
  const outside = [session('late', 12, 8), session('early', 4, 23, { end: local(5, 0) })];
  assert.deepEqual(await syncPlanToCalendar([session('a', 5, 8), ...outside], range, service), {
    created: 0,
    updated: 0,
    deleted: 1,
  });
  assert.deepEqual(movoEvents(state).map(([id]) => id), ['a']);
});

test('turning the export off removes the Movo calendar with its events, and nothing else', async () => {
  const { state, addEvent, service } = memoryCalendar();
  const mine = addEvent({ startDate: local(6, 8), endDate: local(6, 9) });
  assert.equal(await removeAppCalendar(service), false);
  await syncPlanToCalendar(plan(), range, service);
  assert.equal(await removeAppCalendar(service), true);
  assert.deepEqual(state.calendars.map((calendar) => calendar.id), ['personal']);
  assert.deepEqual(state.events.map((event) => event.id), [mine]);
});

test('exported sessions never read as busy when availability is captured', async () => {
  const { service } = memoryCalendar();
  await syncPlanToCalendar([session('a', 6, 8, { end: local(6, 20) })], range, service);
  const availability = await captureAvailabilityFrom(service, {
    weekStart: '2026-10-05',
    from: local(5, 0),
    window: [8, 20],
  });
  assert.equal(availability.source, 'device_calendar');
  assert.equal(availability.slots.length, 7, 'Tuesday stays free despite its exported session');
});

test('planned and done sessions become events from today through the last planned day', () => {
  const planned = (id: string, start: Date, status: PlannedSession['status']): PlannedSession => ({
    id,
    sport_id: 'walking',
    title: `Walk ${id}`,
    time_slot: { start: toIsoWithOffset(start), duration: 1800 },
    description: 'Easy.',
    status,
    editable: status === 'planned',
    plan_version: 1,
    optional: false,
    changed_in_version: null,
    log_id: null,
    metrics: {},
    parts: [],
  });
  const sessions = exportSessionsFrom(
    [planned('a', local(5, 8), 'completed'), planned('b', local(6, 8), 'skipped'), planned('c', local(7, 8), 'planned')],
    'Europe/Warsaw',
  );
  assert.deepEqual(sessions, [
    { id: 'a', title: 'Walk a', description: 'Easy.', start: local(5, 8), end: local(5, 8, 30), timezone: 'Europe/Warsaw' },
    { id: 'c', title: 'Walk c', description: 'Easy.', start: local(7, 8), end: local(7, 8, 30), timezone: 'Europe/Warsaw' },
  ]);
  assert.deepEqual(exportRange('2026-10-05', '2026-10-11'), range);
  // The week the clocks change in Europe still ends at local midnight.
  assert.deepEqual(exportRange('2026-10-19', '2026-10-25').end, local(26, 0));
});
