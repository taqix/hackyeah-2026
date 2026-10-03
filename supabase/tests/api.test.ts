import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  apiSchemas,
  getProductJsonSchemas,
  gymLogSchema,
  metricDefinitionSchema,
  planSnapshotSchema,
} from '../../packages/contracts/src/product.ts';
import { createProductApi } from '../functions/product-api/handler.ts';
import { ApiError } from '../functions/product-api/errors.ts';
import { unavailableGenerator } from '../functions/product-api/provider.ts';
import { createSupabaseDependencies } from '../functions/product-api/supabase-store.ts';
import type { PlanGenerator, ProductStore } from '../functions/product-api/ports.ts';
import {
  activePlan,
  availability,
  chat,
  designExamples,
  examples,
  generation,
  messages,
  owner,
  profile,
  snapshot,
  sports,
} from './fixtures.ts';

function setup(
  generator: PlanGenerator = unavailableGenerator,
  overrides: Partial<ProductStore> = {},
) {
  let saves = 0;
  const store: ProductStore = {
    getProfile: async () => profile,
    updateProfile: async (input) => ({ ...profile, ...input }),
    listSports: async () => sports,
    getCurrentPlan: async () => null,
    listVersions: async () => [],
    listMessages: async () => messages,
    recentMessages: async () => messages,
    requestMessages: async () => messages,
    contextCompletions: async () => [],
    listCompletions: async () => [],
    savedRequest: async () => null,
    savePlan: async () => {
      saves++;
      return activePlan;
    },
    saveReply: async () => messages,
    complete: async () => {
      throw new ApiError('NOT_FOUND', 404, 'Activity not found.');
    },
    ...overrides,
  };
  const api = createProductApi({
    authenticate: async (token) => {
      if (token !== 'placeholder-session') throw new ApiError('UNAUTHENTICATED', 401, 'Sign in.');
      return { id: owner };
    },
    store: () => store,
    generator,
  });
  const call = (path: string, body?: unknown, headers: Record<string, string> = {}) =>
    api(
      new Request(`https://example.test/functions/v1/product-api${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          authorization: 'Bearer placeholder-session',
          'content-type': 'application/json',
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );
  return { api, call, saves: () => saves };
}

test('committed JSON schemas and examples match the runtime contracts', () => {
  assert.deepEqual(
    JSON.parse(
      readFileSync(new URL('../../docs/api/product-api.schemas.json', import.meta.url), 'utf8'),
    ),
    getProductJsonSchemas(),
  );
  for (const name of Object.keys(apiSchemas) as (keyof typeof apiSchemas)[])
    assert.ok(apiSchemas[name].safeParse(examples[name]).success, name);
  assert.deepEqual(
    JSON.parse(
      readFileSync(
        new URL('../../docs/api/product-api.design-examples.json', import.meta.url),
        'utf8',
      ),
    ),
    designExamples,
  );
  assert.equal(
    planSnapshotSchema.safeParse({ ...snapshot, timezone: 'not/a-zone' }).success,
    false,
  );
  assert.equal(
    planSnapshotSchema.safeParse({ ...snapshot, week_start: 'bad-date' }).success,
    false,
  );
  assert.equal(
    planSnapshotSchema.safeParse({
      ...snapshot,
      activities: [{ ...snapshot.activities[0]!, start_at: 'bad-date' }],
    }).success,
    false,
  );
  assert.equal(
    planSnapshotSchema.safeParse({
      ...snapshot,
      activities: [...snapshot.activities, ...snapshot.activities],
    }).success,
    false,
  );
});
test('logging contracts reject ambiguous exercise IDs and impossible catalog bounds', () => {
  assert.equal(
    gymLogSchema.safeParse([
      { exercise_id: 'squat', sets: [{ repetitions: 8, weight_kg: null }] },
      { exercise_id: 'squat', sets: [{ repetitions: 8, weight_kg: null }] },
    ]).success,
    false,
  );
  assert.equal(
    metricDefinitionSchema.safeParse({
      key: 'duration',
      label: 'Time',
      unit: 'min',
      type: 'number',
      required: true,
      minimum: 20,
      maximum: 10,
    }).success,
    false,
  );
});
test('schema endpoint returns the shared envelope and matching JSON schemas', async () => {
  const { call } = setup();
  const response = await call('/schema');
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.ok(apiSchemas.SchemaResponse.safeParse(body).success);
  assert.deepEqual(body.data, getProductJsonSchemas());
  assert.equal(body.meta.contract_version, '1');
});
test('requires verified sessions and supports CORS preflight', async () => {
  const { call, api } = setup();
  assert.equal((await call('/sports', undefined, { authorization: '' })).status, 401);
  assert.equal(
    (
      await call('/sports', undefined, {
        authorization: 'Bearer wrong-placeholder',
      })
    ).status,
    401,
  );
  const response = await api(
    new Request('https://example.test/product-api/profile', {
      method: 'OPTIONS',
    }),
  );
  assert.equal(response.status, 204);
  assert.match(response.headers.get('Access-Control-Allow-Headers')!, /authorization/);
});
test('empty plan/history are explicit and request ownership fields are rejected', async () => {
  const { call } = setup();
  assert.equal((await (await call('/plans/current')).json()).data, null);
  assert.deepEqual((await (await call('/plans/history')).json()).data, []);
  assert.equal((await call('/plans/generate', { ...generation, profile_id: owner })).status, 400);
  assert.equal((await call('/plans/history?limit=101')).status, 400);
});
test('disabled provider and invalid AI output never save a plan', async () => {
  const disabled = setup();
  const response = await disabled.call('/plans/generate', generation);
  assert.equal(response.status, 501);
  assert.equal((await response.json()).error.code, 'AI_NOT_CONFIGURED');
  assert.equal(disabled.saves(), 0);
  const invalid = setup({
    generate: async () => ({
      plan: {
        ...snapshot,
        activities: [{ ...snapshot.activities[0]!, start_at: '2026-10-06T09:00:00+02:00' }],
      },
      summary: 'Invalid availability.',
    }),
    chat: unavailableGenerator.chat,
  });
  assert.equal((await invalid.call('/plans/generate', generation)).status, 502);
  assert.equal(invalid.saves(), 0);
});
test('valid generation saves first and returns the shared response shape', async () => {
  const { call, saves } = setup({
    generate: async () => ({ plan: snapshot, summary: 'Ready.' }),
    chat: unavailableGenerator.chat,
  });
  const response = await call('/plans/generate', generation);
  assert.equal(response.status, 200);
  assert.equal(saves(), 1);
  assert.ok(apiSchemas.GeneratePlanResponse.safeParse(await response.json()).success);
});
test('generation may select an eligible sport and save an empty week', async () => {
  const emptyPlan = { ...snapshot, activities: [] };
  const emptyActivePlan = {
    ...activePlan,
    version: {
      ...activePlan.version,
      plan: emptyPlan,
      summary: 'No session fits this week.',
    },
  };
  let receivedSportIds: string[] = [];
  let saved = false;
  const { call } = setup(
    {
      generate: async (input, context) => {
        assert.equal(input.sport_id, null);
        receivedSportIds = context.sports.map((sport) => sport.id);
        return { plan: emptyPlan, summary: 'No session fits this week.' };
      },
      chat: unavailableGenerator.chat,
    },
    {
      savePlan: async () => {
        saved = true;
        return emptyActivePlan;
      },
    },
  );
  const response = await call('/plans/generate', {
    ...generation,
    sport_id: null,
  });
  assert.equal(response.status, 200);
  assert.deepEqual(receivedSportIds, ['1']);
  assert.deepEqual((await response.json()).data.version.plan.activities, []);
  assert.equal(saved, true);
});
test('generation restricts discovery candidates and rejects ineligible output', async () => {
  const otherSport = { ...sports[0]!, id: '2', name: 'Cycling' };
  const otherSportPlan = {
    ...snapshot,
    activities: snapshot.activities.map((activity) => ({
      ...activity,
      sport_id: '2',
    })),
  };
  const preferencesWithBoth = {
    ...profile.preferences!,
    activity_interests: ['1', '2'],
  };
  const excluded = setup(
    {
      generate: async (_input, context) => {
        assert.deepEqual(
          context.sports.map((sport) => sport.id),
          ['2'],
        );
        return { plan: snapshot, summary: 'Excluded sport.' };
      },
      chat: unavailableGenerator.chat,
    },
    {
      getProfile: async () => ({
        ...profile,
        preferences: { ...preferencesWithBoth, excluded_activity_types: ['1'] },
      }),
      listSports: async () => [sports[0]!, otherSport],
    },
  );
  assert.equal(
    (await excluded.call('/plans/generate', { ...generation, sport_id: null })).status,
    502,
  );
  const selectedOnly = setup(
    {
      generate: async (_input, context) => {
        assert.deepEqual(
          context.sports.map((sport) => sport.id),
          ['1'],
        );
        return { plan: otherSportPlan, summary: 'Cycling.' };
      },
      chat: unavailableGenerator.chat,
    },
    {
      listSports: async () => [sports[0]!, otherSport],
    },
  );
  assert.equal(
    (
      await selectedOnly.call('/plans/generate', {
        ...generation,
        sport_id: null,
      })
    ).status,
    502,
  );
});
test('stale requests and replayed requests do not invoke the provider', async () => {
  const generator: PlanGenerator = {
    generate: async () => {
      throw new Error('must not call');
    },
    chat: unavailableGenerator.chat,
  };
  assert.equal(
    (
      await setup(generator, { getCurrentPlan: async () => activePlan }).call(
        '/plans/generate',
        generation,
      )
    ).status,
    409,
  );
  const replay = setup(generator, { savedRequest: async () => activePlan });
  assert.equal((await replay.call('/plans/generate', generation)).status, 200);
  assert.equal(replay.saves(), 0);
});
test('chat replies preserve the plan and malformed provider replies are rejected before persistence', async () => {
  const generator: PlanGenerator = {
    generate: unavailableGenerator.generate,
    chat: async () => ({ outcome: 'reply', reply: messages[1]!.content }),
  };
  const { call, saves } = setup(generator, {
    getCurrentPlan: async () => activePlan,
  });
  const response = await call('/chat', chat);
  assert.equal(response.status, 200);
  assert.ok(apiSchemas.ChatResponse.safeParse(await response.json()).success);
  assert.equal(saves(), 0);
  const invalid = setup(
    { ...generator, chat: async () => ({ outcome: 'reply', reply: '' }) },
    {
      getCurrentPlan: async () => activePlan,
      saveReply: async () => {
        throw new Error('must not save');
      },
    },
  );
  assert.equal((await invalid.call('/chat', chat)).status, 502);
});
test('gateway sends caller JWT for normal operations and filters by the verified owner', async () => {
  const requests: { url: URL; init: RequestInit | undefined }[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    requests.push({ url, init });
    return Response.json(url.pathname === '/auth/v1/user' ? { id: owner } : [profile]);
  };
  const dependencies = createSupabaseDependencies(
    {
      url: 'https://supabase.example.test',
      publishableKey: '<PUBLISHABLE_KEY>',
    },
    unavailableGenerator,
    fetcher,
  );
  assert.deepEqual(await dependencies.authenticate('placeholder-session'), {
    id: owner,
  });
  assert.deepEqual(await dependencies.store(owner, 'placeholder-session').getProfile(), profile);
  assert.equal(requests[1]!.url.searchParams.get('id'), `eq.${owner}`);
  assert.equal(
    new Headers(requests[1]!.init!.headers).get('authorization'),
    'Bearer placeholder-session',
  );
  assert.ok(!requests[1]!.url.searchParams.get('select')!.includes('email'));
});
test('request lookup rejects a completion receipt before another AI call', async () => {
  const dependencies = createSupabaseDependencies(
    {
      url: 'https://supabase.example.test',
      publishableKey: '<PUBLISHABLE_KEY>',
      serverKey: '<SERVER_ONLY_KEY>',
    },
    unavailableGenerator,
    async (input) => {
      const url = new URL(String(input));
      assert.equal(url.searchParams.get('profile_id'), `eq.${owner}`);
      assert.equal(url.searchParams.get('action'), null);
      return Response.json([{ action: 'complete_activity', payload: {}, result: {} }]);
    },
  );
  await assert.rejects(
    dependencies
      .store(owner, 'placeholder-session')
      .savedRequest(generation.request_id, generation),
    (error: unknown) =>
      error instanceof ApiError && error.code === 'REQUEST_CONFLICT' && error.status === 409,
  );
});
test('chat revisions persist the validated plan and return the replacement version', async () => {
  const revised = {
    ...activePlan,
    version: { ...activePlan.version, version: 2, origin: 'revise' as const },
  };
  const { call } = setup(
    {
      generate: unavailableGenerator.generate,
      chat: async () => ({
        outcome: 'plan_updated',
        plan: snapshot,
        summary: 'Updated.',
      }),
    },
    {
      getCurrentPlan: async () => activePlan,
      savePlan: async (input) => {
        assert.equal(input.origin, 'revise');
        assert.deepEqual(input.plan, snapshot);
        return revised;
      },
    },
  );
  const response = await call('/chat', chat);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.ok(apiSchemas.ChatResponse.safeParse(body).success);
  assert.equal(body.data.outcome, 'plan_updated');
  assert.equal(body.data.active_plan.version.version, 2);
});
test('large bodies and provider exceptions return sanitized contract errors without persistence', async () => {
  const { call, saves } = setup({
    generate: async () => {
      throw new Error('private-provider-detail');
    },
    chat: unavailableGenerator.chat,
  });
  const failed = await call('/plans/generate', generation);
  assert.equal(failed.status, 502);
  const body = await failed.json();
  assert.ok(apiSchemas.ErrorResponse.safeParse(body).success);
  assert.equal(body.error.code, 'PROVIDER_UNAVAILABLE');
  assert.ok(!JSON.stringify(body).includes('private-provider-detail'));
  assert.equal((await call('/plans/generate', { payload: 'x'.repeat(32769) })).status, 413);
  assert.equal(saves(), 0);
});
test('free slots must be sorted and raw calendar event fields are not accepted', async () => {
  const { call } = setup();
  assert.equal(
    (
      await call('/plans/generate', {
        ...generation,
        availability: { ...availability, events: [] },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call('/plans/generate', {
        ...generation,
        availability: {
          ...availability,
          slots: [...availability.slots, ...availability.slots],
        },
      })
    ).status,
    400,
  );
});
