import assert from 'node:assert/strict';
import { test } from 'node:test';

import { mapExpoEvent, toExpoEvent } from '../src/services/calendar/expo-mapping';
import { CalendarError, type NewCalendarEvent } from '../src/services/calendar/types';

type NativeEvent = Parameters<typeof mapExpoEvent>[0];

function nativeEvent(overrides: Partial<NativeEvent> = {}): NativeEvent {
  return {
    id: 'event', calendarId: 'personal', title: 'Walk',
    startDate: '2026-03-29T10:00:00Z', endDate: '2026-03-29T11:00:00Z',
    allDay: false, location: null, notes: '',
    // Importing the Expo enum values would load the native module in CPU tests.
    availability: 'busy' as NativeEvent['availability'],
    status: 'confirmed' as NativeEvent['status'],
    ...overrides,
  };
}

test('Android all-day dates round-trip as local calendar days across US and European DST changes', () => {
  for (const day of [8, 29]) {
    const input: NewCalendarEvent = {
      calendarId: 'personal', title: 'Rest day', allDay: true,
      startDate: new Date(2026, 2, day), endDate: new Date(2026, 2, day + 1),
    };
    const native = toExpoEvent(input, 'android');
    assert.ok(native.startDate instanceof Date);
    assert.ok(native.endDate instanceof Date);
    assert.equal(native.startDate.toISOString(), `2026-03-${String(day).padStart(2, '0')}T00:00:00.000Z`);
    assert.equal(native.endDate.toISOString(), `2026-03-${String(day + 1).padStart(2, '0')}T00:00:00.000Z`);
    assert.equal(native.timeZone, 'UTC');
    assert.equal(native.endTimeZone, 'UTC');

    const mapped = mapExpoEvent(nativeEvent({
      allDay: true, startDate: native.startDate.toISOString(), endDate: native.endDate.toISOString(),
    }), 'android');
    assert.deepEqual(mapped.startDate, input.startDate);
    assert.deepEqual(mapped.endDate, input.endDate);
    assert.equal(mapped.startDate.getHours(), 0);
    assert.equal(mapped.endDate.getHours(), 0);
  }
});

test('iOS all-day dates preserve local midnight and their exclusive end date', () => {
  const input: NewCalendarEvent = {
    calendarId: 'personal', title: 'Rest day', allDay: true,
    startDate: new Date(2026, 2, 29), endDate: new Date(2026, 2, 30),
  };
  const native = toExpoEvent(input, 'ios');
  assert.deepEqual(native.startDate, input.startDate);
  assert.deepEqual(native.endDate, input.endDate);
  assert.equal(native.timeZone, undefined);
  const mapped = mapExpoEvent(nativeEvent({
    allDay: true, startDate: input.startDate.toISOString(), endDate: input.endDate.toISOString(),
  }), 'ios');
  assert.deepEqual(mapped.startDate, input.startDate);
  assert.deepEqual(mapped.endDate, input.endDate);
});

test('timed event offsets preserve the instant and explicit scheduling zone on both platforms', () => {
  const native = nativeEvent({
    startDate: '2026-03-29T10:30:00+02:00', endDate: '2026-03-29T11:30:00+02:00',
  });
  for (const platform of ['ios', 'android'] as const) {
    const mapped = mapExpoEvent(native, platform);
    assert.equal(mapped.startDate.toISOString(), '2026-03-29T08:30:00.000Z');
    assert.equal(mapped.endDate.toISOString(), '2026-03-29T09:30:00.000Z');
    const input: NewCalendarEvent = {
      calendarId: mapped.calendarId, title: mapped.title,
      startDate: mapped.startDate, endDate: mapped.endDate, timeZone: 'Europe/Warsaw',
    };
    const saved = toExpoEvent(input, platform);
    assert.deepEqual(saved.startDate, input.startDate);
    assert.deepEqual(saved.endDate, input.endDate);
    assert.equal(saved.allDay, false);
    assert.equal(saved.timeZone, 'Europe/Warsaw');
    assert.equal(saved.endTimeZone, 'Europe/Warsaw');
  }
});

test('occurrence keys distinguish recurring dates and calendars, and normalize equivalent date representations', () => {
  const first = mapExpoEvent(nativeEvent(), 'ios');
  const same = mapExpoEvent(nativeEvent({ startDate: new Date('2026-03-29T12:00:00+02:00') }), 'ios');
  const next = mapExpoEvent(nativeEvent({ startDate: '2026-03-30T10:00:00Z', endDate: '2026-03-30T11:00:00Z' }), 'ios');
  const other = mapExpoEvent(nativeEvent({ calendarId: 'work' }), 'ios');
  assert.equal(first.id, next.id);
  assert.equal(first.occurrenceKey, same.occurrenceKey);
  assert.equal(new Set([first.occurrenceKey, next.occurrenceKey, other.occurrenceKey]).size, 3);
});

test('invalid OS dates fail explicitly instead of entering the application as Invalid Date', () => {
  for (const dates of [{ startDate: 'bad date' }, { endDate: new Date(NaN) }]) {
    assert.throws(() => mapExpoEvent(nativeEvent(dates), 'android'), (error: unknown) =>
      error instanceof CalendarError && error.code === 'native-error');
  }
});
