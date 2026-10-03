import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPlan } from '../src/create-plan.js';
import {
  parsePlanInput,
  parsePlanOutput,
  geminiOutputSchema,
  type PlanInput,
} from '@hackyeah/contracts/plan';

const fixture = (name: string) =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'));
const now = Date.parse('2026-10-01T00:00:00Z');
const input = (): PlanInput => fixture('initial.input');
const output = () => fixture('initial.expected-output');
const options = { apiKey: 'test-secret', model: 'test-model', now };
const response = (plan: unknown, finishReason = 'STOP') =>
  Response.json({
    candidates: [{ finishReason, content: { parts: [{ text: JSON.stringify(plan) }] } }],
  });

for (const name of ['initial', 'partial', 'empty']) {
  test(`${name} branch fixtures conform to runtime contract`, () => {
    const request = parsePlanInput(fixture(`${name}.input`));
    assert.deepEqual(
      parsePlanOutput(fixture(`${name}.expected-output`), request, now),
      fixture(`${name}.expected-output`),
    );
  });
}

test('sends collected input, separate instructions, secret header, and compatible schema', async () => {
  let calls = 0;
  const result = await createPlan(input(), {
    ...options,
    fetchImpl: async (url, init) => {
      calls++;
      assert.equal(
        url,
        'https://generativelanguage.googleapis.com/v1beta/models/test-model:generateContent',
      );
      assert.equal((init?.headers as Record<string, string>)['x-goog-api-key'], 'test-secret');
      const body = JSON.parse(String(init?.body));
      assert.match(body.systemInstruction.parts[0].text, /beginner movement plan/);
      assert.match(body.contents[0].parts[0].text, /available_slots/);
      assert.equal(body.generationConfig.responseMimeType, 'application/json');
      assert.deepEqual(body.generationConfig.responseJsonSchema, geminiOutputSchema);
      assert.equal(JSON.stringify(geminiOutputSchema).includes('oneOf'), false);
      return response(output());
    },
  });
  assert.equal(calls, 1);
  assert.deepEqual(result, output());
});

test('empty availability requires no credentials or provider call', async () => {
  assert.deepEqual(
    await createPlan(
      { ...input(), available_slots: [] },
      {
        fetchImpl: async () => {
          throw Error('must not call');
        },
      },
    ),
    { events: [] },
  );
});

test('rejects invalid preferences and timezone before calling provider', async () => {
  for (const patch of [
    { timezone: 'Invalid/Zone' },
    { sessions_per_week: 4 },
    { activity_interests: [], discovery_preference: 'selected_only' },
  ]) {
    await assert.rejects(
      createPlan({ ...input(), preferences: { ...input().preferences, ...patch } }, options),
      /schema|timezone/,
    );
  }
});

test('rejects missing credentials', async () => {
  await assert.rejects(createPlan(input(), { ...options, apiKey: '' }), { code: 'CONFIGURATION' });
});

for (const [status, code] of [
  [401, 'AUTHENTICATION'],
  [402, 'BILLING'],
  [403, 'AUTHENTICATION'],
  [429, 'RATE_LIMIT'],
  [500, 'PROVIDER'],
] as const) {
  test(`handles HTTP ${status} without echoing provider content`, async () => {
    await assert.rejects(
      createPlan(input(), {
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

test('handles network errors and timeouts', async () => {
  await assert.rejects(
    createPlan(input(), {
      ...options,
      fetchImpl: async () => {
        throw Error('network');
      },
    }),
    { code: 'NETWORK' },
  );
  await assert.rejects(
    createPlan(input(), {
      ...options,
      fetchImpl: async () => {
        throw new DOMException('timeout', 'TimeoutError');
      },
    }),
    { code: 'TIMEOUT' },
  );
});

test('rejects blocked, truncated, malformed and wrong-shaped responses', async () => {
  for (const makeResponse of [
    () => Response.json({ promptFeedback: { blockReason: 'SAFETY' } }),
    () => response(output(), 'MAX_TOKENS'),
    () => Response.json({ candidates: [] }),
    () => new Response('not json'),
    () => response({ events: [{ time: 'bad', description: 'Walk' }] }),
    () => response({ events: [{ ...output().events[0], series: [{ description: 'Extra' }] }] }),
  ])
    await assert.rejects(
      createPlan(input(), { ...options, fetchImpl: async () => makeResponse() }),
    );
});

test('rejects past times, missing buffers, off-grid and duplicate-day sessions', () => {
  for (const time of [
    '2026-09-01T12:05:00+02:00',
    '2026-10-05T12:00:00+02:00',
    '2026-10-05T12:06:00+02:00',
  ]) {
    assert.throws(() => parsePlanOutput({ events: [{ time, description: 'Walk' }] }, input(), now));
  }
  const request = input();
  request.available_slots = [
    { start: '2026-10-05T00:00:00+02:00', end: '2026-10-05T23:59:00+02:00' },
  ];
  assert.throws(
    () =>
      parsePlanOutput(
        {
          events: [
            { time: '2026-10-05T09:00:00+02:00', description: 'Walk' },
            { time: '2026-10-05T15:00:00+02:00', description: 'Walk' },
          ],
        },
        request,
        now,
      ),
    /local date/,
  );
});

test('enforces weekly limits and gym availability', () => {
  const request = input();
  request.preferences.sessions_per_week = 1;
  assert.throws(() => parsePlanOutput(output(), request, now), /frequency/);
  request.preferences.sessions_per_week = 2;
  request.preferences.available_locations = ['home'];
  assert.throws(() => parsePlanOutput(output(), request, now), /gym access/i);
});

test('uses local dates across UTC midnight and allows a new Monday week', () => {
  const request = input();
  request.preferences.sessions_per_week = 1;
  request.available_slots = [{ start: '2026-10-04T20:00:00Z', end: '2026-10-05T02:00:00Z' }];
  const plan = {
    events: [
      { time: '2026-10-04T21:00:00Z', description: 'Sunday walk' },
      { time: '2026-10-04T23:00:00Z', description: 'Monday walk' },
    ],
  };
  assert.deepEqual(parsePlanOutput(plan, request, now), plan);
});

test('content-review rejection prevents returning a plan', async () => {
  await assert.rejects(
    createPlan(input(), {
      ...options,
      fetchImpl: async () => response(output()),
      reviewContent: async () => {
        throw Error('Unsuitable content');
      },
    }),
    /Unsuitable content/,
  );
});
