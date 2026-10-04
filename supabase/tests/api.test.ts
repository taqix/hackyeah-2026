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
  activityId,
  availability,
  chat,
  completion,
  completionId,
  designExamples,
  examples,
  generation,
  messages,
  opinion,
  owner,
  planId,
  profile,
  snapshot,
  sports,
  undonePlan,
  undoRequest,
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
    getVersion: async () => null,
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
    updateFeedback: async () => {
      throw new ApiError('NOT_FOUND', 404, 'Record not found.');
    },
    listOpinions: async () => [],
    putOpinion: async () => null,
    resetOpinions: async () => 0,
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
  const call = (
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
    method = body === undefined ? 'GET' : 'POST',
  ) =>
    api(
      new Request(`https://example.test/functions/v1/product-api${path}`, {
        method,
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

const neverGenerates: PlanGenerator = {
  generate: async () => {
    throw new Error('must not call');
  },
  chat: async () => {
    throw new Error('must not call');
  },
};
const secondActivity = {
  ...snapshot.activities[0]!,
  id: '00000000-0000-4000-8000-000000000011',
  title: 'An easy walk',
  start_at: '2026-10-07T09:00:00+02:00',
};
const firstVersion = {
  ...activePlan.version,
  plan: { ...snapshot, activities: [snapshot.activities[0]!, secondActivity] },
};
// The newest chat change shortened the second session; the first one is unchanged.
const revisedPlan = {
  plan: { ...activePlan.plan, active_version_id: '00000000-0000-4000-8000-000000000012' },
  version: {
    ...firstVersion,
    id: '00000000-0000-4000-8000-000000000012',
    version: 2,
    origin: 'revise' as 'generate' | 'revise' | 'undo',
    plan: {
      ...snapshot,
      activities: [snapshot.activities[0]!, { ...secondActivity, duration_minutes: 15 }],
    },
    summary: 'Your walk is now 15 minutes.',
  },
};
const completedActivity = (id: string) => ({
  ...completion,
  activity_id: id,
  id: completionId,
  profile_id: owner,
});

test('a log can be saved before feedback, and feedback can be changed later', async () => {
  const received: unknown[] = [];
  const { call } = setup(unavailableGenerator, {
    complete: async (input) => {
      received.push(input.feedback);
      return { ...input, id: completionId, profile_id: owner };
    },
    updateFeedback: async (input) => {
      received.push(input);
      return { ...completion, feedback: input.feedback, id: completionId, profile_id: owner };
    },
  });
  const logged = await call('/completions', { ...completion, feedback: null });
  assert.equal(logged.status, 200);
  const loggedBody = await logged.json();
  assert.ok(apiSchemas.CompletionResponse.safeParse(loggedBody).success);
  assert.equal(loggedBody.data.feedback, null);
  const feedback = { effort: 'hard', enjoyment: 'maybe', notes: '' };
  const updated = await call(
    '/completions/feedback',
    { completion_id: completionId, feedback },
    {},
    'PUT',
  );
  assert.equal(updated.status, 200);
  const updatedBody = await updated.json();
  assert.ok(apiSchemas.CompletionResponse.safeParse(updatedBody).success);
  assert.deepEqual(updatedBody.data.feedback, feedback);
  assert.deepEqual(received, [null, { completion_id: completionId, feedback }]);
  assert.equal(
    (
      await call(
        '/completions/feedback',
        { completion_id: completionId, feedback: null },
        {},
        'PUT',
      )
    ).status,
    400,
  );
  assert.equal(
    (await call('/completions/feedback', { completion_id: completionId, feedback })).status,
    405,
  );
  const missing = setup();
  const notFound = await missing.call(
    '/completions/feedback',
    { completion_id: completionId, feedback },
    {},
    'PUT',
  );
  assert.equal(notFound.status, 404);
  assert.equal((await notFound.json()).error.code, 'NOT_FOUND');
});
test('opinions can be listed, saved, cleared and reset', async () => {
  const saved: unknown[] = [];
  const { call } = setup(unavailableGenerator, {
    listOpinions: async () => [opinion],
    putOpinion: async (input) => {
      saved.push(input);
      return input.opinion === null
        ? null
        : { ...input, opinion: input.opinion, updated_at: opinion.updated_at };
    },
    resetOpinions: async () => 3,
  });
  const list = await call('/opinions');
  assert.equal(list.status, 200);
  const listBody = await list.json();
  assert.ok(apiSchemas.OpinionListResponse.safeParse(listBody).success);
  assert.deepEqual(listBody.data, [opinion]);
  const put = await call('/opinions', { ...examples.PutOpinionDto, opinion: 'no' }, {}, 'PUT');
  assert.equal(put.status, 200);
  assert.equal((await put.json()).data.opinion, 'no');
  const cleared = await call('/opinions', { ...examples.PutOpinionDto, opinion: null }, {}, 'PUT');
  assert.equal(cleared.status, 200);
  const clearedBody = await cleared.json();
  assert.ok(apiSchemas.OpinionResponse.safeParse(clearedBody).success);
  assert.equal(clearedBody.data, null);
  assert.equal(saved.length, 2);
  for (const invalid of [
    { ...examples.PutOpinionDto, activity_key: 'Not a key' },
    { ...examples.PutOpinionDto, sport_id: 1 },
    { ...examples.PutOpinionDto, last_date: '5 October' },
    { ...examples.PutOpinionDto, opinion: 'never' },
  ])
    assert.equal((await call('/opinions', invalid, {}, 'PUT')).status, 400);
  assert.equal(saved.length, 2);
  const reset = await call('/opinions/reset', {});
  assert.equal(reset.status, 200);
  const resetBody = await reset.json();
  assert.ok(apiSchemas.ResetOpinionsResponse.safeParse(resetBody).success);
  assert.deepEqual(resetBody.data, { cleared: 3 });
  assert.equal((await call('/opinions/reset', { everything: true })).status, 400);
  assert.equal((await call('/opinions', {})).status, 405);
});
test('undo restores the previous same-week version without an AI call', async () => {
  let requestedIds: string[] = [];
  let saved = 0;
  const { call } = setup(neverGenerates, {
    getCurrentPlan: async () => revisedPlan,
    getVersion: async (id, version) => {
      assert.equal(id, planId);
      assert.equal(version, 1);
      return firstVersion;
    },
    contextCompletions: async (ids) => {
      requestedIds = ids;
      // The unchanged first session was logged; it stays exactly as it was.
      return [completedActivity(activityId)];
    },
    savePlan: async (input) => {
      saved++;
      assert.equal(input.origin, 'undo');
      assert.deepEqual(input.request, undoRequest);
      assert.deepEqual(input.plan, firstVersion.plan);
      assert.equal(input.summary, 'The last change was undone.');
      return undonePlan;
    },
  });
  const response = await call('/plans/undo', undoRequest);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.ok(apiSchemas.UndoPlanResponse.safeParse(body).success);
  assert.equal(body.data.version.origin, 'undo');
  assert.equal(body.meta.request_id, undoRequest.request_id);
  assert.deepEqual(requestedIds.sort(), [activityId, secondActivity.id].sort());
  assert.equal(saved, 1);
});
test('undo refuses when there is no change to undo or a changed session is logged', async () => {
  const undo = async (overrides: Partial<ProductStore>, input: unknown = undoRequest) => {
    const { call, saves } = setup(neverGenerates, {
      getCurrentPlan: async () => revisedPlan,
      getVersion: async () => firstVersion,
      ...overrides,
    });
    const response = await call('/plans/undo', input);
    assert.equal(saves(), 0);
    return {
      status: response.status,
      code: response.status === 200 ? null : (await response.json()).error.code,
    };
  };
  const withOrigin = (origin: 'generate' | 'undo') => ({
    ...revisedPlan,
    version: { ...revisedPlan.version, origin },
  });
  assert.deepEqual(await undo({ getCurrentPlan: async () => withOrigin('generate') }), {
    status: 409,
    code: 'NOTHING_TO_UNDO',
  });
  assert.deepEqual(await undo({ getCurrentPlan: async () => withOrigin('undo') }), {
    status: 409,
    code: 'NOTHING_TO_UNDO',
  });
  assert.deepEqual(await undo({ getVersion: async () => null }), {
    status: 409,
    code: 'NOTHING_TO_UNDO',
  });
  assert.deepEqual(
    await undo({
      getVersion: async () => ({
        ...firstVersion,
        plan: { ...firstVersion.plan, week_start: '2026-09-28', activities: [] },
      }),
    }),
    { status: 409, code: 'NOTHING_TO_UNDO' },
  );
  assert.deepEqual(
    await undo({ contextCompletions: async () => [completedActivity(secondActivity.id)] }),
    { status: 409, code: 'UNDO_LOCKED' },
  );
  // A session the change added and the person then logged would disappear, so it is locked too.
  const added = { ...secondActivity, id: '00000000-0000-4000-8000-000000000013' };
  assert.deepEqual(
    await undo({
      getCurrentPlan: async () => ({
        ...revisedPlan,
        version: {
          ...revisedPlan.version,
          plan: {
            ...revisedPlan.version.plan,
            activities: [...firstVersion.plan.activities, added],
          },
        },
      }),
      contextCompletions: async () => [completedActivity(added.id)],
    }),
    { status: 409, code: 'UNDO_LOCKED' },
  );
  assert.deepEqual(await undo({}, { ...undoRequest, expected_version: 1 }), {
    status: 409,
    code: 'VERSION_CONFLICT',
  });
  assert.deepEqual(
    await undo({}, { ...undoRequest, plan_id: '00000000-0000-4000-8000-000000000099' }),
    { status: 404, code: 'NOT_FOUND' },
  );
  assert.deepEqual(await undo({ getCurrentPlan: async () => null }), {
    status: 404,
    code: 'NOT_FOUND',
  });
  assert.deepEqual(await undo({}, { ...undoRequest, expected_version: 0 }), {
    status: 400,
    code: 'INVALID_REQUEST',
  });
  assert.deepEqual(await undo({ savedRequest: async () => undonePlan }), {
    status: 200,
    code: null,
  });
});
test('store writes opinions and feedback under the caller session', async () => {
  const requests: { url: URL; init: RequestInit | undefined }[] = [];
  let reply: unknown = [];
  let status = 200;
  const dependencies = createSupabaseDependencies(
    {
      url: 'https://supabase.example.test',
      publishableKey: '<PUBLISHABLE_KEY>',
      serverKey: '<SERVER_ONLY_KEY>',
    },
    unavailableGenerator,
    async (input, init) => {
      requests.push({ url: new URL(String(input)), init });
      return Response.json(reply, { status });
    },
  );
  const store = dependencies.store(owner, 'placeholder-session');
  const last = () => {
    const request = requests.at(-1)!;
    const headers = new Headers(request.init!.headers);
    return {
      path: request.url.pathname,
      query: Object.fromEntries(request.url.searchParams),
      method: request.init!.method,
      authorization: headers.get('authorization'),
      prefer: headers.get('prefer'),
      body: request.init!.body ? JSON.parse(String(request.init!.body)) : undefined,
    };
  };
  const columns = 'activity_key,title,sport_id::text,opinion,last_date,updated_at';

  reply = [opinion];
  assert.deepEqual(await store.putOpinion(examples.PutOpinionDto), opinion);
  assert.deepEqual(last(), {
    path: '/rest/v1/activity_opinion',
    query: { on_conflict: 'profile_id,activity_key', select: columns },
    method: 'POST',
    authorization: 'Bearer placeholder-session',
    prefer: 'resolution=merge-duplicates,return=representation',
    body: { ...examples.PutOpinionDto, profile_id: owner },
  });
  reply = [];
  assert.equal(await store.putOpinion({ ...examples.PutOpinionDto, opinion: null }), null);
  assert.deepEqual(last().query, {
    profile_id: `eq.${owner}`,
    activity_key: `eq.${opinion.activity_key}`,
    select: columns,
  });
  assert.equal(last().method, 'DELETE');
  reply = [{ activity_key: 'a' }, { activity_key: 'b' }];
  assert.equal(await store.resetOpinions(), 2);
  assert.deepEqual(last().query, { profile_id: `eq.${owner}`, select: columns });
  assert.equal(last().method, 'DELETE');
  reply = [opinion];
  assert.deepEqual(await store.listOpinions(), [opinion]);
  assert.equal(last().query.order, 'updated_at.desc,activity_key.asc');
  assert.equal(last().query.profile_id, `eq.${owner}`);

  const feedback = { effort: 'easy' as const, enjoyment: null, notes: '' };
  reply = { ...completion, feedback, id: completionId, profile_id: owner };
  assert.deepEqual(
    (await store.updateFeedback({ completion_id: completionId, feedback })).feedback,
    feedback,
  );
  assert.deepEqual(last(), {
    path: '/rest/v1/rpc/update_completion_feedback',
    query: {},
    method: 'POST',
    authorization: 'Bearer placeholder-session',
    prefer: 'return=representation',
    body: { p_completion_id: completionId, p_feedback: feedback },
  });

  reply = [activePlan.version];
  assert.deepEqual(await store.getVersion(planId, 1), activePlan.version);
  assert.deepEqual(last().query, {
    profile_id: `eq.${owner}`,
    plan_id: `eq.${planId}`,
    version: 'eq.1',
    limit: '1',
  });
  reply = [];
  assert.equal(await store.getVersion(planId, 1), null);

  reply = [
    { action: 'save_plan_version', payload: { client_input: undoRequest }, result: undonePlan },
  ];
  assert.deepEqual(await store.savedRequest(undoRequest.request_id, undoRequest), undonePlan);
  await assert.rejects(
    store.savedRequest(undoRequest.request_id, { ...undoRequest, expected_version: 3 }),
    (error: unknown) => error instanceof ApiError && error.code === 'REQUEST_CONFLICT',
  );

  // An unknown catalog sport fails the foreign key; that is a client error, not an outage.
  status = 409;
  reply = { code: '23503', message: 'insert or update violates foreign key constraint' };
  await assert.rejects(
    store.putOpinion({ ...examples.PutOpinionDto, sport_id: '999' }),
    (error: unknown) =>
      error instanceof ApiError && error.code === 'INVALID_REQUEST' && error.status === 400,
  );
});
