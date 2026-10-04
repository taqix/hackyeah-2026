import assert from 'node:assert/strict';
import { test } from 'node:test';
import { apiSchemas } from '../../packages/contracts/src/product.ts';
import type {
  ActivePlanDto,
  ActivityCompletionEntity,
  GeneratePlanDto,
  SendChatDto,
  SportEntity,
} from '../../packages/contracts/src/product.ts';
import { ApiError } from '../functions/product-api/errors.ts';
import { createGeminiGenerator, type GeminiConfig } from '../functions/product-api/gemini.ts';
import { createProductApi } from '../functions/product-api/handler.ts';
import type { GeneratorContext, ProductStore } from '../functions/product-api/ports.ts';
import { validateGeneratedPlan } from '../functions/product-api/validation.ts';
import { activePlan, owner, preferences, profile, sports as running } from './fixtures.ts';

// Synthetic Gemini answers only: these tests never reach the real API.
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const id = (n: number) => `00000000-0000-4000-8000-0000000001${String(n).padStart(2, '0')}`;
const weekStart = '2026-10-05';
const days = ['05', '06', '07', '08', '09', '10', '11'].map((day) => `2026-10-${day}`);
const sports: SportEntity[] = [
  running[0]!,
  { ...running[0]!, id: '2', name: 'Strength', is_gym: true },
  { ...running[0]!, id: '3', name: 'Swimming', generation_enabled: false },
  { ...running[0]!, id: '4', name: 'Cycling' },
];
const settings = {
  ...preferences,
  sessions_per_week: 5,
  session_minutes: 30,
  activity_interests: ['1', '2'],
  discovery_preference: 'occasional' as const,
  available_locations: ['home' as const, 'outdoors' as const],
  excluded_activity_types: ['4'],
};
const availability = (from = 0) => ({
  source: 'manual' as const,
  captured_at: '2026-10-04T10:00:00Z',
  slots: days.slice(from).map((date) => ({
    start_at: `${date}T07:00:00+02:00`,
    end_at: `${date}T21:00:00+02:00`,
  })),
});
const generation: GeneratePlanDto = {
  request_id: id(90),
  expected_version: 0,
  sport_id: null,
  week_start: weekStart,
  availability: availability(),
};
const walk = (start_at: string, extra: Record<string, unknown> = {}) => ({
  id: null,
  sport_id: '1',
  title: 'Easy walk-jog',
  description: 'Walk for five minutes, then add short easy jogs. Finish with a slow walk.',
  start_at,
  duration_minutes: 30,
  gym_exercises: [],
  ...extra,
});

function answer(value: unknown, finishReason = 'STOP') {
  return Response.json({
    candidates: [{ finishReason, content: { parts: [{ text: JSON.stringify(value) }] } }],
  });
}
type Handler = (init: RequestInit | undefined) => Promise<Response>;
function gemini(
  replies: unknown[],
  config: Partial<GeminiConfig> = {},
  at = '2026-10-04T10:00:00Z',
) {
  const calls: { url: string; headers: Headers; body: any }[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    calls.push({
      url: String(input),
      headers: new Headers(init?.headers),
      body: JSON.parse(String(init?.body)),
    });
    const next = replies.shift();
    if (next instanceof Response) return next;
    if (typeof next === 'function') return (next as Handler)(init);
    return answer(next);
  };
  const generator = createGeminiGenerator(
    {
      apiKey: 'test-key',
      model: 'test-model',
      now: () => Date.parse(at),
      retryBaseDelayMs: 1,
      log: () => {},
      ...config,
    },
    fetcher,
  );
  return {
    generator,
    calls,
    context: (call = 0) => JSON.parse(calls[call]!.body.contents[0].parts[0].text),
  };
}
const isApiError = (code: string, status: number) => (error: unknown) =>
  error instanceof ApiError && error.code === code && error.status === status;
const plainError = (error: unknown) => error instanceof Error && !(error instanceof ApiError);

function context(overrides: Partial<GeneratorContext> = {}): GeneratorContext {
  return {
    preferences: settings,
    sports: sports.filter((sport) => sport.generation_enabled && sport.id !== '4'),
    activePlan: null,
    completions: [],
    messages: [],
    ...overrides,
  };
}

test('generate builds a validated weekly snapshot from a structured answer', async () => {
  const {
    generator,
    calls,
    context: sent,
  } = gemini([
    {
      summary: '  Two gentle sessions this week.  ',
      activities: [
        walk('2026-10-06T18:00:00+02:00', { title: '  Easy walk-jog  ' }),
        {
          ...walk('2026-10-08T07:00:00Z'),
          id: 'model-made-up',
          sport_id: '2',
          title: 'Simple strength',
          duration_minutes: 25,
          gym_exercises: [{ id: 'chair_squat', sets: [{ repetitions: 8 }, { repetitions: 8 }] }],
        },
      ],
    },
  ]);
  const result = await generator.generate(generation, context());
  assert.equal(result.summary, 'Two gentle sessions this week.');
  assert.equal(result.plan.week_start, weekStart);
  assert.equal(result.plan.timezone, 'Europe/Warsaw');
  const [first, second] = result.plan.activities;
  assert.match(first!.id, uuid);
  assert.match(second!.id, uuid);
  assert.equal(first!.title, 'Easy walk-jog');
  assert.equal(second!.start_at, '2026-10-08T09:00:00+02:00');
  assert.deepEqual(second!.gym_exercises, [
    { id: 'chair_squat', name: 'Chair squat', sets: [{ repetitions: 8 }, { repetitions: 8 }] },
  ]);
  validateGeneratedPlan(result.plan, generation, context({ sports }));

  assert.equal(calls.length, 1);
  assert.equal(
    calls[0]!.url,
    'https://generativelanguage.googleapis.com/v1beta/models/test-model:generateContent',
  );
  assert.equal(calls[0]!.headers.get('x-goog-api-key'), 'test-key');
  const config = calls[0]!.body.generationConfig;
  assert.equal(config.responseMimeType, 'application/json');
  const activity = config.responseJsonSchema.properties.activities;
  assert.equal(activity.description, 'At most 5 sessions.');
  assert.ok(!/"(minItems|maxItems)"/.test(JSON.stringify(config.responseJsonSchema)));
  assert.deepEqual(activity.items.properties.sport_id.enum, ['1', '2']);
  assert.equal(activity.items.properties.duration_minutes.maximum, 30);
  const prompt = sent();
  assert.equal(prompt.now, '2026-10-04T12:00:00+02:00');
  assert.deepEqual(prompt.allowed_slots[0], {
    start_at: '2026-10-05T07:00:00+02:00',
    end_at: '2026-10-05T21:00:00+02:00',
    minutes: 840,
  });
  assert.ok(prompt.exercise_library.every((item: { id: string }) => item.id !== 'brisk_walk'));
  assert.ok(!JSON.stringify(calls[0]!.body).includes('weight_kg'));
});

test('generate through the handler saves the Gemini plan', async () => {
  const { generator } = gemini([
    { summary: 'One walk.', activities: [walk('2026-10-06T18:00:00+02:00')] },
  ]);
  let saved: unknown;
  const store = {
    getProfile: async () => ({ ...profile, preferences: settings }),
    listSports: async () => sports,
    getCurrentPlan: async () => null,
    savedRequest: async () => null,
    savePlan: async (input: { plan: unknown }) => {
      saved = input.plan;
      return activePlan;
    },
  } as unknown as ProductStore;
  const api = createProductApi({
    authenticate: async () => ({ id: owner }),
    store: () => store,
    generator,
  });
  const response = await api(
    new Request('https://example.test/product-api/plans/generate', {
      method: 'POST',
      headers: { authorization: 'Bearer placeholder-session', 'content-type': 'application/json' },
      body: JSON.stringify(generation),
    }),
  );
  assert.equal(response.status, 200);
  assert.ok(apiSchemas.GeneratePlanResponse.safeParse(await response.json()).success);
  assert.equal((saved as { activities: unknown[] }).activities.length, 1);
});

test('chat keeps known IDs, mints new ones and re-inserts completed and past sessions', async () => {
  const done = {
    id: id(1),
    sport_id: '1',
    title: 'Morning walk',
    description: 'An easy walk.',
    start_at: '2026-10-05T09:00:00+02:00',
    duration_minutes: 30,
    gym_exercises: [],
  };
  const past = { ...done, id: id(2), title: 'Evening walk', start_at: '2026-10-06T18:00:00+02:00' };
  const strength = {
    ...done,
    id: id(3),
    sport_id: '2',
    title: 'Simple strength',
    start_at: '2026-10-09T18:00:00+02:00',
    duration_minutes: 25,
    gym_exercises: [{ id: 'chair_squat', name: 'Chair squat', sets: [{ repetitions: 8 }] }],
  };
  const saturday = {
    ...done,
    id: id(4),
    title: 'Saturday walk',
    start_at: '2026-10-10T10:00:00+02:00',
  };
  const active: ActivePlanDto = {
    ...activePlan,
    version: {
      ...activePlan.version,
      plan: {
        week_start: weekStart,
        timezone: 'Europe/Warsaw',
        activities: [done, past, strength, saturday],
      },
    },
  };
  const completion = {
    id: id(9),
    profile_id: owner,
    plan_version_id: active.version.id,
    activity_id: done.id,
    request_id: id(8),
    metrics: { duration_minutes: 30 },
    gym_log: [],
    feedback: { effort: 'hard' as const, enjoyment: 'yes' as const, notes: 'Private note.' },
    completed_at: '2026-10-05T09:30:00+02:00',
  } satisfies ActivityCompletionEntity;
  const chat: SendChatDto = {
    request_id: id(91),
    plan_id: active.plan.id,
    expected_version: 1,
    message: 'Move my strength session to Thursday and add a Sunday walk.',
    activity_id: strength.id,
    // Mid-week availability only covers the rest of the week.
    availability: availability(2),
  };
  const ctx = context({
    sports,
    activePlan: active,
    completions: [completion],
  });
  const {
    generator,
    calls,
    context: sent,
  } = gemini(
    [
      {
        outcome: 'plan_updated',
        message: 'I moved strength to Thursday and added a Sunday walk.',
        activities: [
          { ...done, title: 'Renamed by the model' },
          {
            ...strength,
            start_at: '2026-10-08T18:00:00+02:00',
            gym_exercises: [{ id: 'chair_squat', sets: [{ repetitions: 8 }] }],
          },
          { ...saturday, start_at: '2026-10-10T08:00:00Z' },
          { ...walk('2026-10-11T10:00:00+02:00'), id: id(99) },
        ],
      },
    ],
    {},
    '2026-10-07T10:00:00Z',
  );
  const result = await generator.chat(chat, ctx);
  assert.equal(result.outcome, 'plan_updated');
  assert.ok(result.outcome === 'plan_updated');
  assert.equal(result.summary, 'I moved strength to Thursday and added a Sunday walk.');
  const [first, second, third, fourth, fifth] = result.plan.activities;
  assert.deepEqual(first, done);
  assert.deepEqual(second, past);
  assert.equal(third!.id, strength.id);
  assert.equal(third!.start_at, '2026-10-08T18:00:00+02:00');
  assert.deepEqual(fourth, saturday);
  assert.match(fifth!.id, uuid);
  assert.ok(![id(99), done.id, past.id].includes(fifth!.id));
  // The handler's own validation accepts the past session outside today's free slots.
  validateGeneratedPlan(result.plan, chat, ctx);

  const prompt = sent();
  assert.deepEqual(
    prompt.kept_sessions.map((item: { id: string; status: string }) => [item.id, item.status]),
    [
      [done.id, 'completed'],
      [past.id, 'past'],
    ],
  );
  assert.deepEqual(
    prompt.planned_sessions.map((item: { id: string }) => item.id),
    [strength.id, saturday.id],
  );
  assert.equal(prompt.limits.max_returned_sessions, 3);
  assert.equal(prompt.attached_activity_id, strength.id);
  assert.deepEqual(prompt.completed_feedback, [
    { activity_id: done.id, effort: 'hard', would_choose_again: 'yes' },
  ]);
  assert.ok(!calls[0]!.body.contents[0].parts[0].text.includes('Private note.'));
  assert.equal(prompt.allowed_slots[0].start_at, '2026-10-07T12:00:00+02:00');
  // Chat receives the whole catalog; disabled and excluded sports stay out of the schema.
  const schema = calls[0]!.body.generationConfig.responseJsonSchema;
  assert.deepEqual(schema.properties.activities.anyOf[0].items.properties.sport_id.enum, [
    '1',
    '2',
  ]);
});

test('chat replies and clarifications leave the plan alone', async () => {
  const ctx = context({ activePlan });
  const chat: SendChatDto = {
    request_id: id(92),
    plan_id: activePlan.plan.id,
    expected_version: 1,
    message: 'Could I swim instead?',
    availability: availability(),
  };
  const { generator, calls } = gemini([
    { outcome: 'reply', message: ' Walking is a good start. ', activities: null },
    {
      outcome: 'clarification',
      message: 'Swimming is not available yet. Would a walk work?',
      activities: [walk('2026-10-06T18:00:00+02:00')],
    },
  ]);
  assert.deepEqual(await generator.chat(chat, ctx), {
    outcome: 'reply',
    reply: 'Walking is a good start.',
  });
  assert.deepEqual(await generator.chat(chat, ctx), {
    outcome: 'clarification',
    reply: 'Swimming is not available yet. Would a walk work?',
  });
  assert.equal(calls.length, 2);
});

test('an invalid plan is re-asked once with the problem, then rejected', async () => {
  const late = walk('2026-10-06T22:00:00+02:00');
  const fixed = gemini([
    { summary: 'One walk.', activities: [late] },
    { summary: 'One walk.', activities: [walk('2026-10-06T18:00:00+02:00')] },
  ]);
  const result = await fixed.generator.generate(generation, context());
  assert.equal(result.plan.activities[0]!.start_at, '2026-10-06T18:00:00+02:00');
  assert.equal(fixed.calls.length, 2);
  const retry = fixed.calls[1]!.body.contents;
  assert.equal(retry.length, 3);
  assert.equal(retry[1].role, 'model');
  assert.match(retry[2].parts[0].text, /not fully inside one free time slot/);

  const stubborn = gemini([
    { summary: 'One walk.', activities: [late] },
    { summary: 'One walk.', activities: [walk('2026-10-04T08:00:00+02:00')] },
  ]);
  await assert.rejects(
    stubborn.generator.generate(generation, context()),
    isApiError('INVALID_AI_OUTPUT', 502),
  );
  assert.equal(stubborn.calls.length, 2);
});

test('incomplete, blocked and unreadable answers are invalid AI output without a re-ask', async () => {
  for (const reply of [
    answer({ summary: 'Cut off.', activities: [] }, 'MAX_TOKENS'),
    Response.json({ promptFeedback: { blockReason: 'SAFETY' } }),
    Response.json({
      candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"summ' }] } }],
    }),
  ]) {
    const { generator, calls } = gemini([reply]);
    await assert.rejects(generator.generate(generation, context()), (error: unknown) => {
      assert.ok(isApiError('INVALID_AI_OUTPUT', 502)(error));
      assert.equal((error as ApiError).retryable, true);
      return true;
    });
    assert.equal(calls.length, 1);
  }
});

test('missing configuration answers AI_NOT_CONFIGURED without a request', async () => {
  for (const config of [{ apiKey: '' }, { model: undefined }, { model: 'bad model/id' }]) {
    const { generator, calls } = gemini([], config);
    await assert.rejects(
      generator.generate(generation, context()),
      isApiError('AI_NOT_CONFIGURED', 501),
    );
    assert.equal(calls.length, 0);
  }
});

test('transient HTTP failures are retried with the same request', async () => {
  const { generator, calls } = gemini([
    new Response('{}', { status: 429, headers: { 'Retry-After': '0' } }),
    new Response('{}', { status: 503 }),
    { summary: 'One walk.', activities: [walk('2026-10-06T18:00:00+02:00')] },
  ]);
  const result = await generator.generate(generation, context());
  assert.equal(result.plan.activities.length, 1);
  assert.equal(calls.length, 3);
  assert.deepEqual(calls[2]!.body, calls[0]!.body);

  const failing = gemini([400, 500, 500, 500, 500].map((status) => new Response('{}', { status })));
  await assert.rejects(failing.generator.generate(generation, context()), plainError);
  assert.equal(failing.calls.length, 1);
  const exhausted = gemini([500, 500, 500, 500].map((status) => new Response('{}', { status })));
  await assert.rejects(exhausted.generator.generate(generation, context()), plainError);
  assert.equal(exhausted.calls.length, 4);
});

test('retries and slow answers stay inside the deadline', async () => {
  const cooldown = gemini([new Response('{}', { status: 429, headers: { 'Retry-After': '5' } })], {
    deadlineMs: 1000,
  });
  await assert.rejects(cooldown.generator.generate(generation, context()), plainError);
  assert.equal(cooldown.calls.length, 1);

  const slow = gemini(
    [
      (init: RequestInit | undefined) =>
        new Promise<Response>((_resolve, reject) =>
          init?.signal?.addEventListener('abort', () => reject(init.signal!.reason)),
        ),
    ],
    { deadlineMs: 50 },
  );
  const started = Date.now();
  await assert.rejects(slow.generator.generate(generation, context()), (error: unknown) => {
    assert.ok(plainError(error));
    assert.match((error as Error).message, /timed out/);
    return true;
  });
  assert.ok(Date.now() - started < 2000);
});
