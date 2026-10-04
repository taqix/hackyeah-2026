import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createCalendarService } from '../src/services/calendar/service';
import {
  captureAvailability,
  captureAvailabilityFrom,
  MAX_SLOTS,
  toDailySlots,
  type AvailabilitySlot,
  type CaptureAvailabilityOptions,
} from '../src/services/calendar/plan-availability';
import { CalendarError } from '../src/services/calendar/types';
import { memoryCalendar } from './calendar-fake-driver';

/** Local wall-clock time in October 2026 (day 12 is the next Monday). */
const local = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute);
const free = (start: Date, end: Date) => ({ startDate: start, endDate: end });
const spans = (slots: AvailabilitySlot[]) =>
  slots.map((slot) => [Date.parse(slot.start_at), Date.parse(slot.end_at)]);
const span = (day: number, from: number, to: number, fromMinute = 0, toMinute = 0) => [
  local(day, from, fromMinute).getTime(),
  local(day, to, toMinute).getTime(),
];
const week = (overrides: Partial<CaptureAvailabilityOptions> = {}): CaptureAvailabilityOptions => ({
  weekStart: '2026-10-05',
  from: local(5, 0),
  window: [8, 20],
  capturedAt: local(5, 6, 30),
  ...overrides,
});

test('free time is split per local day and kept inside the daily window', () => {
  const slots = toDailySlots(
    [free(local(5, 10), local(7, 9)), free(local(7, 12), local(12, 0))],
    week({ from: local(5, 6) }),
  );
  assert.deepEqual(spans(slots), [
    span(5, 10, 20),
    span(6, 8, 20),
    span(7, 8, 9),
    span(7, 12, 20),
    span(8, 8, 20),
    span(9, 8, 20),
    span(10, 8, 20),
    span(11, 8, 20),
  ]);
  for (const slot of slots) {
    assert.match(slot.start_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
  }

  const longOnly = toDailySlots([free(local(5, 10), local(7, 9)), free(local(7, 12), local(12, 0))], week({ minMinutes: 90 }));
  assert.equal(longOnly.length, 7, 'Wednesday 8:00–9:00 is shorter than 90 minutes');
});

test('no window means 7 to 21, and nothing starts before `from` rounded up to 5 minutes', () => {
  const slots = toDailySlots([free(local(5, 0), local(12, 0))], week({ window: null, from: local(6, 13, 2) }));
  assert.equal(slots.length, 6);
  assert.deepEqual(spans(slots)[0], span(6, 13, 21, 5));
  assert.deepEqual(spans(slots)[5], span(11, 7, 21));
});

test('daylight saving weeks keep the local window on every day', () => {
  // Europe moves its clocks on 25 October 2026, the United States on 1 November.
  for (const [weekStart, firstDay] of [['2026-10-19', 19], ['2026-10-26', 26]] as const) {
    const options = week({ weekStart, from: local(firstDay, 0), window: [7, 21] });
    const slots = toDailySlots([free(local(firstDay, 0), local(firstDay + 7, 0))], options);
    assert.equal(slots.length, 7);
    slots.forEach((slot, day) => {
      assert.equal(Date.parse(slot.start_at), local(firstDay + day, 7).getTime());
      assert.equal(Date.parse(slot.end_at), local(firstDay + day, 21).getTime());
      assert.match(slot.start_at, /T07:00:00[+-]/);
      assert.match(slot.end_at, /T21:00:00[+-]/);
    });
  }
});

test('slots come out sorted and are capped at 100, earliest first', () => {
  const gaps: { startDate: Date; endDate: Date }[] = [];
  for (let day = 5; day < 12; day += 1) {
    for (let minute = 7 * 60; minute < 21 * 60; minute += 10) {
      gaps.push(free(local(day, 0, minute), local(day, 0, minute + 5)));
    }
  }
  const slots = toDailySlots(gaps.reverse(), week({ window: null }));
  assert.equal(slots.length, MAX_SLOTS);
  assert.equal(Date.parse(slots[0].start_at), local(5, 7).getTime());
  for (let i = 1; i < slots.length; i += 1) {
    assert.ok(Date.parse(slots[i].start_at) >= Date.parse(slots[i - 1].end_at));
  }
});

test('with access, busy time comes from the device and the Movo and excluded calendars are skipped', async () => {
  const { state, driver, addEvent, service } = memoryCalendar();
  state.calendars.push(
    { id: 'movo', title: 'Movo', source: 'Local', allowsModifications: true },
    { id: 'work', title: 'Work', source: 'Exchange', allowsModifications: true },
  );
  addEvent({ startDate: local(6, 10), endDate: local(6, 11, 30) });
  addEvent({ calendarId: 'movo', startDate: local(7, 8), endDate: local(7, 20), notes: 'movo-activity:a' });
  addEvent({ calendarId: 'work', startDate: local(8, 8), endDate: local(8, 20) });

  const availability = await captureAvailabilityFrom(service, week({ excludeCalendarIds: ['work'] }));
  assert.equal(availability.source, 'device_calendar');
  assert.equal(Date.parse(availability.captured_at), local(5, 6, 30).getTime());
  assert.deepEqual(spans(availability.slots), [
    span(5, 8, 20),
    span(6, 8, 10),
    span(6, 11, 20, 30),
    span(7, 8, 20),
    span(8, 8, 20),
    span(9, 8, 20),
    span(10, 8, 20),
    span(11, 8, 20),
  ]);
  assert.deepEqual(driver.getEvents.mock.calls[0].arguments, [['personal'], local(5, 0), local(12, 0)]);
  assert.equal(driver.requestPermission.mock.callCount(), 0);
});

test('a fully busy week is an empty device read, not manual time', async () => {
  const { addEvent, service } = memoryCalendar();
  addEvent({ startDate: local(1, 0), endDate: local(20, 0) });
  const availability = await captureAvailabilityFrom(service, week());
  assert.deepEqual(availability, { ...availability, source: 'device_calendar', slots: [] });
});

test('denied, undetermined and unavailable access plan from the window instead', async () => {
  const manualWeek = await captureAvailabilityFrom(createCalendarService(null), week());
  assert.equal(manualWeek.source, 'manual');
  assert.equal(manualWeek.slots.length, 7);
  assert.deepEqual(spans(manualWeek.slots)[0], span(5, 8, 20));

  for (const permission of [
    { status: 'denied', canAskAgain: false },
    { status: 'undetermined', canAskAgain: true },
  ] as const) {
    const { state, driver, service } = memoryCalendar();
    state.permission = permission;
    assert.deepEqual(await captureAvailabilityFrom(service, week()), manualWeek);
    assert.equal(driver.listCalendars.mock.callCount(), 0);
    assert.equal(driver.requestPermission.mock.callCount(), 0);
  }

  // Web and the Node test graph load the stub, as Expo Go reports unavailable.
  assert.equal((await captureAvailability(week())).source, 'manual');
});

test('access revoked during the read falls back to manual; a native failure propagates', async () => {
  const revoked = memoryCalendar();
  revoked.driver.getPermission.mock.mockImplementation(async () => {
    const current = revoked.state.permission;
    revoked.state.permission = { status: 'denied', canAskAgain: true };
    return current;
  });
  assert.equal((await captureAvailabilityFrom(revoked.service, week())).source, 'manual');

  const failing = memoryCalendar();
  failing.driver.getEvents.mock.mockImplementation(async () => {
    throw new Error('EventKit failed');
  });
  await assert.rejects(
    captureAvailabilityFrom(failing.service, week()),
    (error: unknown) => error instanceof CalendarError && error.code === 'native-error',
  );
});

test('a week that is already over reads nothing and has no slots', async () => {
  const { driver, service } = memoryCalendar();
  const availability = await captureAvailabilityFrom(service, week({ from: local(12, 0, 1) }));
  assert.deepEqual(availability.slots, []);
  assert.equal(driver.getPermission.mock.callCount(), 0);
});
