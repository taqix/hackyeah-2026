import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generatePlan, createPlan } from '../src/create-plan.js';
import {
  parsePlanInput,
  parsePlanOutput,
  buildGeminiOutputSchema,
  buildPlanOutputSchema,
  type ExistingWorkout,
  type PlanInput,
  type PlanOutput,
} from '@hackyeah/contracts/plan';
import { PLAN_GENERATION_CONFIG } from '../src/plan-config.js';

const fixture = <T>(name: string): T =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8')) as T;
const now = Date.parse('2026-10-01T00:00:00Z');
const input = (): PlanInput => fixture('initial.input');
const output = (): PlanOutput => fixture('initial.expected-output');
const modify = (): PlanInput => fixture('modify.input');
const modified = (): PlanOutput => fixture('modify.expected-output');
const options = { apiKey: 'test-secret', model: 'test-model', now };
const response = (plan: unknown, finishReason = 'STOP') =>
  Response.json({
    candidates: [{ finishReason, content: { parts: [{ text: JSON.stringify(plan) }] } }],
  });

function walk(start?: string, duration = 600) {
  const event = output().events[0];
  if (!event || event.action !== 'add' || !('metrics' in event))
    throw Error('Missing walk fixture');
  if (start) event.time_slot.start = start;
  event.time_slot.duration = duration;
  event.metrics.duration = duration;
  return event;
}

function existing(start?: string, id = 201): ExistingWorkout {
  const { action: _action, ...workout } = walk(start);
  return { ...workout, id, status: 'planned', editable: true };
}

const plan = (...events: PlanOutput['events']): PlanOutput => ({ events, message: null });

for (const name of ['initial', 'partial', 'empty', 'modify']) {
  void test(`${name} fixtures conform to the runtime contract`, () => {
    const request = parsePlanInput(fixture(`${name}.input`));
    assert.deepEqual(
      parsePlanOutput(fixture(`${name}.expected-output`), request, now),
      fixture(`${name}.expected-output`),
    );
  });
}

void test('sends both modes, whole conversation and catalog with a compatible response schema', async () => {
  for (const request of [input(), modify()]) {
    const expected = request.mode === 'create' ? output() : modified();
    await generatePlan(request, {
      ...options,
      fetchImpl: async (url, init) => {
        assert.equal(
          url,
          'https://generativelanguage.googleapis.com/v1beta/models/test-model:generateContent',
        );
        assert.equal((init?.headers as Record<string, string>)['x-goog-api-key'], 'test-secret');
        const body = JSON.parse(String(init?.body));
        assert.match(body.systemInstruction.parts[0].text, /beginner movement plan/);
        const text: string = body.contents[0].parts[0].text;
        const serialized = JSON.parse(text.slice(text.indexOf('\n') + 1));
        assert.deepEqual(serialized, request);
        assert.equal(
          text.split(request.user_prompt ?? 'not present').length,
          request.user_prompt ? 2 : 1,
        );
        assert.equal(body.generationConfig.responseMimeType, 'application/json');
        assert.deepEqual(
          body.generationConfig.responseJsonSchema,
          JSON.parse(JSON.stringify(buildGeminiOutputSchema(request))),
        );
        assert.doesNotMatch(
          JSON.stringify(body.generationConfig.responseJsonSchema),
          /"oneOf"|"\$schema"|"exclusiveMinimum"/,
        );
        return response(expected);
      },
    }).then((result) => assert.deepEqual(result, expected));
  }
  assert.equal(createPlan, generatePlan);
});

void test('empty creation availability needs no credentials or provider call', async () => {
  assert.deepEqual(
    await generatePlan(
      { ...input(), available_slots: [] },
      {
        apiKey: '',
        model: '',
        fetchImpl: async () => {
          throw Error('Must not call');
        },
      },
    ),
    { events: [], message: null },
  );
});

void test('empty modification availability still calls Gemini for deletions and replies', async () => {
  for (const events of [[{ action: 'delete', id: 101 }], []]) {
    const expected = { events, message: 'Here is the update.' };
    const result = await generatePlan(
      { ...modify(), available_slots: [] },
      {
        ...options,
        fetchImpl: async () => response(expected),
      },
    );
    assert.deepEqual(result, expected);
  }
  assert.throws(
    () =>
      parsePlanOutput(
        { events: [walk()], message: 'Added' },
        { ...modify(), available_slots: [] },
        now,
      ),
    /available slot/,
  );
});

void test('rejects invalid input before a provider call', async () => {
  for (const patch of [
    { timezone: 'Invalid/Zone' },
    { preferred_duration: 0 },
    { preferred_duration: Infinity },
    { activity_interests: [999] },
    { activity_interests: [], discovery_preference: 'selected_only' },
  ]) {
    await assert.rejects(
      generatePlan({ ...input(), preferences: { ...input().preferences, ...patch } }, options),
    );
  }
  for (const sessions_per_week of [-1, 0, 4]) {
    assert.equal(
      parsePlanInput({ ...input(), preferences: { ...input().preferences, sessions_per_week } })
        .preferences.sessions_per_week,
      sessions_per_week,
    );
  }
  for (const request of [
    { ...input(), mode: 'modify', user_prompt: null },
    { ...input(), mode: 'modify', user_prompt: '  ' },
    { ...input(), user_prompt: 'Modify' },
    { ...input(), conversation: [{ role: 'system', content: 'instructions' }] },
    { ...input(), conversation: [{ role: 'user', content: '  ' }] },
    { ...input(), planning_window: { start: '2026-10-05T00:00:00', duration: 600 } },
    { ...input(), available_slots: [{ start: '2026-10-05T12:00:00Z', duration: -1 }] },
    { ...input(), available_slots: [{ start: '2026-10-05T12:00:00Z', duration: 1e100 }] },
  ])
    assert.throws(() => parsePlanInput(request));
});

void test('catalog definitions reject duplicate IDs, keys, contradictory bounds and unsupported schemas', () => {
  const request = input();
  const sport = request.sports[0];
  if (!sport || sport.is_gym !== 0) throw Error('Missing sport fixture');
  assert.throws(
    () =>
      parsePlanInput({
        ...request,
        sports: [{ ...sport, kind: 'non_gym' }],
      }),
    /schema/,
  );
  assert.throws(
    () =>
      parsePlanInput({
        ...request,
        sports: [{ ...sport, is_gym: 2 }],
      }),
    /schema/,
  );
  assert.throws(() => parsePlanInput({ ...request, sports: [...request.sports, sport] }), /unique/);
  for (const value_schema of [
    { type: 'number', minimum: 5, maximum: 1 },
    { type: 'integer', enum: [1.5] },
    { type: 'string', minLength: 5, maxLength: 1 },
    { type: 'string', enum: ['short'], minLength: 10 },
    { type: 'string', pattern: '.*' },
    { type: 'object' },
  ]) {
    assert.throws(() =>
      parsePlanInput({
        ...request,
        sports: [
          {
            ...sport,
            metrics: [{ key: 'test', description: 'Test', required: true, value_schema }],
          },
          request.sports[1],
        ],
      }),
    );
  }
  assert.throws(
    () =>
      parsePlanInput({
        ...request,
        sports: [{ ...sport, metrics: [sport.metrics[0], sport.metrics[0]] }, request.sports[1]],
      }),
    /unique/,
  );
});

void test('history deduplicates matching IDs regardless of object key order and rejects conflicting copies', () => {
  const request = modify();
  const event = request.target_window_events[0];
  if (!event) throw Error('Missing history');
  request.current_week_events = [
    Object.fromEntries(Object.entries(event).reverse()) as ExistingWorkout,
  ];
  assert.deepEqual(parsePlanOutput(modified(), parsePlanInput(request), now), modified());
  request.current_week_events[0] = { ...event, editable: false };
  assert.throws(() => parsePlanInput(request), /consistent/);
});

void test('accepts DB sport IDs, open durations and an unordered list of additions', () => {
  const request = input();
  request.preferences.preferred_duration = 720;
  request.preferences.activity_interests = [42, 2];
  request.sports[0] = { ...request.sports[0]!, id: 42 };
  const event = { ...walk(undefined, 720), sport_id: 42 };
  assert.deepEqual(parsePlanOutput(plan(event), parsePlanInput(request), now), plan(event));
  assert.deepEqual(
    parsePlanOutput({ ...output(), events: output().events.reverse() }, input(), now).events[0],
    output().events[1],
  );
});

void test('enforces catalog metric formats, required keys, workout shapes and session-duration consistency', () => {
  const cases: Record<string, string | number | boolean>[] = [
    {},
    { duration: '600' },
    { duration: 600, distance: -1 },
    { duration: 600, unknown: 1 },
    { duration: 500 },
  ];
  for (const metrics of cases)
    assert.throws(
      () => parsePlanOutput(plan({ ...walk(), metrics }), input(), now),
      /catalog|duration metric/,
    );
  assert.throws(() => parsePlanOutput(plan({ ...walk(), sport_id: 999 }), input(), now), /catalog/);
  assert.throws(() => parsePlanOutput(plan({ ...walk(), sport_id: 2 }), input(), now), /catalog/);
  assert.throws(
    () => parsePlanOutput(plan({ ...walk(), description: '  ' }), input(), now),
    /blank/,
  );
  assert.throws(() => parsePlanOutput(plan({ ...walk(), parts: [] }), input(), now), /schema/);
});

void test('supports string/boolean metric values and preserves schema-like metric names', () => {
  const request = input();
  const sport = request.sports[0];
  if (!sport || sport.is_gym !== 0) throw Error('Missing sport');
  sport.metrics.push(
    {
      key: 'minimum',
      description: 'Intensity label',
      required: true,
      value_schema: { type: 'string', enum: ['easy', 'gentle'], minLength: 4 },
    },
    {
      key: 'outdoors',
      description: 'Outdoor session',
      required: false,
      value_schema: { type: 'boolean' },
    },
  );
  const event = walk();
  event.metrics.minimum = 'easy';
  event.metrics.outdoors = true;
  assert.deepEqual(parsePlanOutput(plan(event), parsePlanInput(request), now), plan(event));
  assert.match(JSON.stringify(buildGeminiOutputSchema(request)), /"minimum":\{"type":"string"/);
  event.metrics.minimum = 'hard';
  assert.throws(() => parsePlanOutput(plan(event), request, now), /catalog/);
});

void test('Gemini discriminators have explicit types and duration format stays local', () => {
  const request = input();
  const sport = request.sports[0];
  if (!sport || sport.is_gym !== 0) throw Error('Missing sport');
  sport.metrics.push({
    key: 'active_duration',
    description: 'Active movement time in ISO 8601 duration format',
    required: false,
    value_schema: { type: 'string', format: 'duration' },
  });
  const schema = JSON.parse(JSON.stringify(buildGeminiOutputSchema(request)));
  for (const branch of schema.properties.events.items.anyOf) {
    assert.equal(branch.properties.action.type, 'string');
    assert.deepEqual(branch.properties.action.enum, ['add']);
  }
  assert.equal(
    schema.properties.events.items.anyOf[0].properties.metrics.properties.active_duration.format,
    undefined,
  );
  const event = walk();
  event.metrics.active_duration = 'PT5M';
  assert.deepEqual(parsePlanOutput(plan(event), parsePlanInput(request), now), plan(event));
  event.metrics.active_duration = 'five minutes';
  assert.throws(() => parsePlanOutput(plan(event), request, now), /catalog/);
});

void test('gym workouts use generated exercise instructions without a sport exercise catalog', () => {
  const gym = output().events[1];
  if (!gym || gym.action !== 'add' || !('exercises' in gym)) throw Error('Missing gym');
  for (const patch of [{ sets: 0 }, { repetitions: 1.5 }, { exercise_id: 999 }, { name: '  ' }]) {
    const changed = {
      ...gym,
      exercises: gym.exercises.map((exercise) => ({ ...exercise, ...patch })),
    };
    assert.throws(() => parsePlanOutput(plan(changed), input(), now), /catalog|schema|blank/);
  }
  assert.throws(
    () =>
      parsePlanOutput(
        plan(gym),
        { ...input(), preferences: { ...input().preferences, available_locations: ['home'] } },
        now,
      ),
    /gym access/i,
  );
  assert.deepEqual(parsePlanOutput(plan(gym), parsePlanInput(input()), now), plan(gym));
  const renamed = {
    ...gym,
    exercises: gym.exercises.map((exercise) => ({
      ...exercise,
      name: 'Gentle bodyweight movement',
    })),
  };
  assert.deepEqual(parsePlanOutput(plan(renamed), input(), now), plan(renamed));
  const request = input();
  assert.throws(
    () =>
      parsePlanInput({
        ...request,
        sports: request.sports.map((sport) =>
          sport.is_gym === 1 ? { ...sport, exercises: [] } : sport,
        ),
      }),
    /schema/,
  );
});

void test('deletions reject unknown, repeated, completed, skipped, past and non-editable activities', () => {
  const request = modify();
  assert.throws(
    () =>
      parsePlanOutput({ events: [{ action: 'delete', id: 999 }], message: 'Delete' }, request, now),
    /known/,
  );
  assert.throws(
    () =>
      parsePlanOutput(
        {
          events: [
            { action: 'delete', id: 101 },
            { action: 'delete', id: 101 },
          ],
          message: 'Delete',
        },
        request,
        now,
      ),
    /Duplicate/,
  );
  for (const patch of [{ status: 'completed' }, { status: 'skipped' }, { editable: false }]) {
    const changed = {
      ...request,
      target_window_events: request.target_window_events.map((event) => ({ ...event, ...patch })),
    };
    assert.throws(
      () => parsePlanOutput(modified(), changed as PlanInput, now),
      /completed|non-editable/,
    );
  }
  assert.throws(
    () => parsePlanOutput(modified(), request, Date.parse('2026-10-06T00:00:00Z')),
    /past/,
  );
  const outside = {
    ...request,
    planning_window: { start: '2026-10-06T00:00:00+02:00', duration: 518400 },
  };
  assert.throws(() => parsePlanOutput(modified(), outside, now), /window/);
  assert.throws(
    () =>
      parsePlanOutput(
        plan({ action: 'delete', id: 101 }),
        { ...request, mode: 'create', user_prompt: null },
        now,
      ),
    /Creation cannot delete/,
  );
});

void test('requires modification replies and keeps operation objects minimal', () => {
  for (const message of [null, '', '  '])
    assert.throws(() => parsePlanOutput({ events: [], message }, modify(), now));
  assert.throws(() => parsePlanOutput({ events: [], message: 'Hi' }, input(), now), /null/);
  assert.throws(
    () =>
      parsePlanOutput(
        { events: [{ action: 'delete', id: 101, description: 'Extra' }], message: 'Delete' },
        modify(),
        now,
      ),
    /schema/,
  );
  assert.throws(
    () =>
      parsePlanOutput(
        plan({ ...walk(), id: 'invented' } as PlanOutput['events'][number]),
        input(),
        now,
      ),
    /schema/,
  );
});

void test('validates actual durations, future grid, explicit offsets, buffers and planning window', () => {
  for (const start of [
    '2026-09-01T12:05:00+02:00',
    '2026-10-05T12:00:00+02:00',
    '2026-10-05T12:06:00+02:00',
    '2026-10-05T12:05:00',
  ])
    assert.throws(() => parsePlanOutput(plan(walk(start)), input(), now));
  assert.throws(() => parsePlanOutput(plan(walk(undefined, 1800)), input(), now), /available slot/);
  assert.throws(
    () =>
      parsePlanOutput(
        plan(walk()),
        { ...input(), planning_window: { start: '2026-10-06T00:00:00+02:00', duration: 86400 } },
        now,
      ),
    /window/,
  );
  const request = input();
  request.sports[0] = { ...request.sports[0]!, buffer_seconds: 900 };
  assert.throws(() => parsePlanOutput(plan(walk()), request, now), /available slot/);
  request.sports[0].buffer_seconds = 0;
  assert.deepEqual(
    parsePlanOutput(plan(walk('2026-10-05T12:00:00+02:00')), request, now).events.length,
    1,
  );
});

void test('final schedule includes retained workouts, counts completions and ignores skipped sessions', () => {
  const request = input();
  request.preferences.sessions_per_week = 1;
  request.target_window_events = [
    { ...existing('2026-10-06T12:05:00+02:00'), status: 'completed' },
  ];
  assert.throws(() => parsePlanOutput(plan(walk()), request, now), /frequency/);
  request.target_window_events[0]!.status = 'skipped';
  assert.deepEqual(parsePlanOutput(plan(walk()), request, now), plan(walk()));
  request.target_window_events = [existing()];
  assert.throws(() => parsePlanOutput(plan(walk()), request, now), /overlap/);
  request.target_window_events = [existing('2026-10-05T15:05:00+02:00')];
  assert.throws(() => parsePlanOutput(plan(walk()), request, now), /local date/);
  request.target_window_events = [existing('2026-10-05T12:20:00+02:00')];
  assert.throws(() => parsePlanOutput(plan(walk()), request, now), /overlap/);
});

void test('replacement validation applies deletions first regardless of operation order', () => {
  const request = modify();
  const replacement = { events: [walk(), { action: 'delete', id: 101 }], message: 'Replace' };
  assert.deepEqual(parsePlanOutput(replacement, request, now), replacement);
});

void test('chat can override duration and frequency without mutating saved preferences', () => {
  const request = modify();
  request.preferences.sessions_per_week = 1;
  request.user_prompt = 'Keep both workouts and make the Tuesday walk 15 minutes.';
  const before = structuredClone(request.preferences);
  assert.deepEqual(parsePlanOutput(modified(), request, now), modified());
  assert.deepEqual(request.preferences, before);
  const creation = {
    ...request,
    mode: 'create' as const,
    user_prompt: null,
    target_window_events: [],
  };
  const addition = modified().events.find((event) => event.action === 'add');
  if (!addition) throw Error('Missing addition');
  assert.throws(() => parsePlanOutput(plan(addition), creation, now), /duration/);
});

void test('creation retains frequency limits while chat still respects sport exclusions', () => {
  assert.throws(
    () =>
      parsePlanOutput(
        output(),
        { ...input(), preferences: { ...input().preferences, sessions_per_week: 1 } },
        now,
      ),
    /frequency/,
  );
  assert.throws(
    () =>
      parsePlanOutput(
        modified(),
        {
          ...modify(),
          preferences: { ...modify().preferences, excluded_activity_types: [1] },
        },
        now,
      ),
    /excluded/,
  );
});

void test('uses local Monday boundaries across UTC midnight and daylight-saving transitions', () => {
  const request = input();
  request.preferences.sessions_per_week = 1;
  request.planning_window = { start: '2026-10-04T00:00:00+02:00', duration: 172800 };
  request.available_slots = [{ start: '2026-10-04T20:00:00Z', duration: 21600 }];
  const result = plan(walk('2026-10-04T21:00:00Z'), walk('2026-10-04T23:00:00Z'));
  assert.deepEqual(parsePlanOutput(result, request, now), result);
  request.planning_window = { start: '2026-10-25T00:00:00+02:00', duration: 90000 };
  request.available_slots = [{ start: '2026-10-25T02:00:00+01:00', duration: 3600 }];
  assert.deepEqual(
    parsePlanOutput(plan(walk('2026-10-25T02:05:00+01:00')), request, now).events.length,
    1,
  );
  assert.throws(
    () =>
      parsePlanOutput(
        plan(walk('2026-10-25T02:05:00+01:00'), walk('2026-10-25T02:35:00+01:00')),
        request,
        now,
      ),
    /local date/,
  );
});

void test('empty sport catalog still supports modification deletions', () => {
  const request = {
    ...modify(),
    sports: [],
    preferences: {
      ...modify().preferences,
      activity_interests: [],
      discovery_preference: 'explore' as const,
    },
  };
  assert.deepEqual(
    parsePlanOutput(
      { events: [{ action: 'delete', id: 101 }], message: 'Delete' },
      parsePlanInput(request),
      now,
    ).events.length,
    1,
  );
  assert.ok(buildPlanOutputSchema(request));
  assert.throws(
    () => parsePlanOutput({ events: [walk()], message: 'Add' }, request, now),
    /catalog/,
  );
});

void test('rejects oversized complete conversations without truncating or calling the provider', async () => {
  let called = false;
  await assert.rejects(
    generatePlan(
      {
        ...modify(),
        conversation: [
          { role: 'user', content: 'x'.repeat(PLAN_GENERATION_CONFIG.maxRequestBytes) },
        ],
      },
      {
        ...options,
        fetchImpl: async () => {
          called = true;
          return response(modified());
        },
      },
    ),
    { code: 'INPUT_TOO_LARGE' },
  );
  assert.equal(called, false);
});

void test('rejects missing credentials, invalid models and invalid current time', async () => {
  await assert.rejects(generatePlan(input(), { ...options, apiKey: '' }), {
    code: 'CONFIGURATION',
  });
  await assert.rejects(generatePlan(input(), { ...options, model: 'models/test' }), {
    code: 'CONFIGURATION',
  });
  await assert.rejects(generatePlan(input(), { ...options, now: NaN }), { code: 'CONFIGURATION' });
});

for (const [status, code] of [
  [401, 'AUTHENTICATION'],
  [402, 'BILLING'],
  [403, 'AUTHENTICATION'],
  [429, 'RATE_LIMIT'],
  [500, 'PROVIDER'],
] as const) {
  void test(`handles HTTP ${status} without exposing provider content`, async () => {
    await assert.rejects(
      generatePlan(input(), {
        ...options,
        fetchImpl: async () => new Response('secret preferences', { status }),
      }),
      (error: unknown) => {
        assert.equal((error as { code: string }).code, code);
        assert.doesNotMatch(String(error), /secret preferences/);
        return true;
      },
    );
  });
}

void test('handles network errors and timeouts', async () => {
  await assert.rejects(
    generatePlan(input(), {
      ...options,
      fetchImpl: async () => {
        throw Error('network');
      },
    }),
    { code: 'NETWORK' },
  );
  await assert.rejects(
    generatePlan(input(), {
      ...options,
      fetchImpl: async () => {
        throw new DOMException('timeout', 'TimeoutError');
      },
    }),
    { code: 'TIMEOUT' },
  );
});

void test('rejects blocked, incomplete, malformed and wrong-shaped responses', async () => {
  for (const makeResponse of [
    () => Response.json({ promptFeedback: { blockReason: 'SAFETY' } }),
    () => response(output(), 'MAX_TOKENS'),
    () => Response.json({ candidates: [] }),
    () => new Response('not json'),
    () => response({ events: [{ time: 'bad', description: 'Walk' }] }),
    () =>
      response(
        plan({ ...walk(), series: [{ description: 'Extra' }] } as PlanOutput['events'][number]),
      ),
    () =>
      Response.json({
        candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'not json' }] } }],
      }),
  ])
    await assert.rejects(
      generatePlan(input(), { ...options, fetchImpl: async () => makeResponse() }),
    );
});

void test('application content review can reject before a result is returned', async () => {
  await assert.rejects(
    generatePlan(input(), {
      ...options,
      fetchImpl: async () => response(output()),
      reviewContent: async () => {
        throw Error('Unsuitable content');
      },
    }),
    /Unsuitable content/,
  );
});

void test('rejects malformed provider envelopes with explicit errors', async () => {
  for (const payload of [null, 1, [], { candidates: {} }, { candidates: [null] }]) {
    await assert.rejects(
      generatePlan(input(), { ...options, fetchImpl: async () => Response.json(payload) }),
      { code: 'INVALID_RESPONSE' },
    );
  }
  for (const parts of [null, {}, [null, 1, { thought: true, text: 'hidden' }]]) {
    await assert.rejects(
      generatePlan(input(), {
        ...options,
        fetchImpl: async () =>
          Response.json({ candidates: [{ finishReason: 'STOP', content: { parts } }] }),
      }),
      { code: 'INVALID_RESPONSE' },
    );
  }
});

void test('database IDs are numeric positive safe integers and are never coerced', () => {
  for (const id of ['1', 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    const request = input();
    assert.throws(
      () =>
        parsePlanInput({ ...request, sports: [{ ...request.sports[0], id }, request.sports[1]] }),
      /schema/,
    );
    assert.throws(
      () =>
        parsePlanInput({
          ...request,
          preferences: { ...request.preferences, activity_interests: [id] },
        }),
      /schema/,
    );
    assert.throws(
      () =>
        parsePlanInput({
          ...request,
          preferences: { ...request.preferences, excluded_activity_types: [id] },
        }),
      /schema/,
    );
    assert.throws(
      () =>
        parsePlanInput({
          ...modify(),
          target_window_events: modify().target_window_events.map((event) => ({ ...event, id })),
        }),
      /schema/,
    );
    assert.throws(
      () => parsePlanOutput({ events: [{ ...walk(), sport_id: id }], message: null }, request, now),
      /schema/,
    );
    assert.throws(
      () =>
        parsePlanOutput({ events: [{ action: 'delete', id }], message: 'Delete' }, modify(), now),
      /schema/,
    );
  }
  const schema = JSON.parse(JSON.stringify(buildGeminiOutputSchema(modify())));
  for (const branch of schema.properties.events.items.anyOf) {
    const identifier = branch.properties.sport_id ?? branch.properties.id;
    assert.equal(identifier.type, 'integer');
    assert.ok(identifier.enum.every((id: unknown) => typeof id === 'number'));
  }
});
