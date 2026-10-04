import assert from 'node:assert/strict';
import { test } from 'node:test';

import { manualAvailability } from '../../src/services/calendar/plan-availability';

const local = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute).getTime();

test('manual availability is the window on each day of the week, from now on', () => {
  const availability = manualAvailability({
    weekStart: '2026-10-05',
    from: new Date(2026, 9, 7, 9, 2),
    window: [7, 10],
    capturedAt: new Date(2026, 9, 7, 9, 2, 30),
  });
  assert.equal(availability.source, 'manual');
  assert.equal(Date.parse(availability.captured_at), new Date(2026, 9, 7, 9, 2, 30).getTime());
  assert.match(availability.captured_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
  // Monday and Tuesday are over; Wednesday starts at 9:05 (rounded up), then Thursday to Sunday.
  assert.deepEqual(
    availability.slots.map((slot) => [Date.parse(slot.start_at), Date.parse(slot.end_at)]),
    [
      [local(7, 9, 5), local(7, 10)],
      [local(8, 7), local(8, 10)],
      [local(9, 7), local(9, 10)],
      [local(10, 7), local(10, 10)],
      [local(11, 7), local(11, 10)],
    ],
  );
});

test('no window means 7 to 21, and slots shorter than the minimum are dropped', () => {
  const week = manualAvailability({ weekStart: '2026-10-05', from: new Date(2026, 9, 1), window: null });
  assert.equal(week.slots.length, 7);
  assert.equal(Date.parse(week.slots[0].start_at), local(5, 7));
  assert.equal(Date.parse(week.slots[6].end_at), local(11, 21));

  const late = manualAvailability({ weekStart: '2026-10-05', from: new Date(2026, 9, 5, 20, 40), window: null, minMinutes: 30 });
  assert.equal(Date.parse(late.slots[0].start_at), local(6, 7), 'Monday 20:40–21:00 is too short');
  assert.deepEqual(manualAvailability({ weekStart: '2026-10-05', from: new Date(2026, 9, 12), window: null }).slots, []);
});
