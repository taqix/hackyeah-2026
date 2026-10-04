/**
 * The wire mirror against the real contract: fixtures typed with wire.ts must
 * parse with packages/contracts' runtime schemas. contract-compat.test.ts
 * compares the types themselves and the adapter's real request bodies.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { apiSchemas } from '../../../../packages/contracts/src/product';
import { preferencesToWire } from '../../src/api/remote/mappers';
import type { ActivePlanDto, GeneratePlanDto } from '../../src/api/remote/wire';
import { manualAvailability } from '../../src/services/calendar/plan-availability';
import { activity, completion, gymActivity, SPORTS, uuid, version } from './fakes';

const meta = { contract_version: '1', request_id: null };
const parses = (schema: { safeParse(value: unknown): { success: boolean; error?: unknown } }, value: unknown) => {
  const result = schema.safeParse(value);
  assert.ok(result.success, JSON.stringify(result.error, null, 1));
};

test('wire fixtures match the contract schemas', () => {
  const walk = activity(1);
  const gym = gymActivity(2, { start_at: '2026-10-06T07:00:00+02:00' });
  const v1 = version(1, '2026-10-05', [walk, gym]);
  const current: ActivePlanDto = {
    plan: { id: v1.plan_id, profile_id: v1.profile_id, active_version_id: v1.id, created_at: '2026-10-01T08:00:00Z' },
    version: v1,
  };
  parses(apiSchemas.SportListResponse, { data: SPORTS.map((s) => ({ ...s, name: s.name.trim() })), meta });
  parses(apiSchemas.CurrentPlanResponse, { data: current, meta });
  parses(apiSchemas.PlanHistoryResponse, { data: [v1], meta });
  parses(apiSchemas.CompletionListResponse, {
    data: [completion(1, gym, v1, { gym_log: [{ exercise_id: 'chair_squat', sets: [{ repetitions: 10, weight_kg: null }] }] })],
    meta,
  });
});

test('mapped requests match the contract schemas', () => {
  const preferences = preferencesToWire(
    {
      timezone: 'Europe/Warsaw',
      starting_comfort: 'starting_out',
      sessions_per_week: 3,
      session_minutes: 20,
      preferred_window: [7, 10],
      activity_interests: ['walking'],
      discovery_preference: 'occasional',
      available_locations: ['outdoors'],
      available_equipment: [],
      avoidances: [],
      starting_obstacles: [],
      excluded_activity_types: [],
    },
    (id) => (id === 'walking' ? '1' : null),
  );
  parses(apiSchemas.UpdateProfileDto, { username: null, preferences });
  const generate: GeneratePlanDto = {
    request_id: uuid(9),
    expected_version: 0,
    sport_id: null,
    week_start: '2026-10-05',
    availability: manualAvailability({ weekStart: '2026-10-05', from: new Date(2026, 9, 4), window: [7, 10] }),
  };
  parses(apiSchemas.GeneratePlanDto, generate);
});
