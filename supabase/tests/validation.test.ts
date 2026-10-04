import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ActivePlanDto, SendChatDto } from '../../packages/contracts/src/product.ts';
import { ApiError } from '../functions/product-api/errors.ts';
import type { GeneratorContext } from '../functions/product-api/ports.ts';
import { allowedSlots, localIso, zonedInstant } from '../functions/product-api/schedule.ts';
import { checkGeneratedPlan, validateGeneratedPlan } from '../functions/product-api/validation.ts';
import { activePlan, chat, completion, preferences, snapshot, sports } from './fixtures.ts';

const monday = snapshot.activities[0]!;
const wednesday = {
  ...monday,
  id: '00000000-0000-4000-8000-000000000204',
  start_at: '2026-10-07T18:00:00+02:00',
};
const active: ActivePlanDto = {
  ...activePlan,
  version: { ...activePlan.version, plan: { ...snapshot, activities: [monday, wednesday] } },
};
// A mid-week chat only sends free time from Wednesday on; Monday's session is in the past.
const midWeek: SendChatDto = {
  ...chat,
  availability: {
    ...chat.availability,
    slots: [{ start_at: '2026-10-07T07:00:00+02:00', end_at: '2026-10-07T21:00:00+02:00' }],
  },
};
const context = (overrides: Partial<GeneratorContext> = {}): GeneratorContext => ({
  preferences,
  sports,
  activePlan: active,
  completions: [],
  messages: [],
  ...overrides,
});
const invalid = (error: unknown) =>
  error instanceof ApiError && error.code === 'INVALID_AI_OUTPUT' && error.status === 502;

test('unchanged sessions of the same week skip the availability and window checks', () => {
  const revised = { ...snapshot, activities: [monday, { ...wednesday, title: 'Evening walk' }] };
  assert.deepEqual(validateGeneratedPlan(revised, midWeek, context()), revised);
  // Answers edited after planning (here a narrower window) keep past sessions too.
  validateGeneratedPlan(
    revised,
    midWeek,
    context({
      preferences: { ...preferences, preferred_window: { start_hour: 17, end_hour: 21 } },
    }),
  );
});

test('changed or other-week sessions are still checked against free time', () => {
  const moved = { ...snapshot, activities: [{ ...monday, title: 'Renamed walk' }, wednesday] };
  assert.throws(() => validateGeneratedPlan(moved, midWeek, context()), invalid);
  const lastWeek = {
    ...active,
    version: { ...active.version, plan: { ...active.version.plan, week_start: '2026-09-28' } },
  };
  const generation = {
    request_id: chat.request_id,
    expected_version: 1,
    sport_id: null,
    week_start: snapshot.week_start,
    availability: midWeek.availability,
  };
  assert.throws(
    () =>
      validateGeneratedPlan(
        { ...snapshot, activities: [monday, wednesday] },
        generation,
        context({ activePlan: lastWeek }),
      ),
    invalid,
  );
});

test('completed sessions stay locked and problems are specific for the AI re-ask', () => {
  const done = context({
    completions: [{ ...completion, id: completion.request_id, profile_id: active.plan.profile_id }],
  });
  const edited = { ...snapshot, activities: [{ ...monday, title: 'Edited' }, wednesday] };
  const result = checkGeneratedPlan(edited, midWeek, done);
  assert.equal(result.ok, false);
  assert.match(!result.ok ? result.problem : '', /completed and must stay exactly/);
  assert.match(
    (
      checkGeneratedPlan({ ...snapshot, activities: [wednesday] }, midWeek, done) as {
        problem: string;
      }
    ).problem,
    /Completed session .* is missing/,
  );
  const long = checkGeneratedPlan(
    { ...snapshot, activities: [monday, { ...wednesday, duration_minutes: 30 }] },
    midWeek,
    context(),
  );
  assert.match(!long.ok ? long.problem : '', /lasts 30 minutes; the limit is 20/);
});

test('allowed slots follow the local window, the future and daylight saving changes', () => {
  // Poland leaves summer time on 25 October 2026.
  assert.equal(
    localIso(Date.parse('2026-10-25T12:00:00Z'), 'Europe/Warsaw'),
    '2026-10-25T13:00:00+01:00',
  );
  assert.equal(
    zonedInstant('2026-10-25', 7 * 60, 'Europe/Warsaw'),
    Date.parse('2026-10-25T06:00:00Z'),
  );
  const slots = allowedSlots({
    weekStart: '2026-10-19',
    timeZone: 'Europe/Warsaw',
    window: { start_hour: 17, end_hour: 21 },
    slots: [
      { start_at: '2026-10-24T15:02:00Z', end_at: '2026-10-25T23:00:00Z' },
      { start_at: '2026-10-26T06:00:00Z', end_at: '2026-10-26T08:00:00Z' },
    ],
    now: Date.parse('2026-10-24T10:00:00Z'),
  });
  assert.deepEqual(slots, [
    { start_at: '2026-10-24T17:05:00+02:00', end_at: '2026-10-24T21:00:00+02:00', minutes: 235 },
    { start_at: '2026-10-25T17:00:00+01:00', end_at: '2026-10-25T21:00:00+01:00', minutes: 240 },
  ]);
});
