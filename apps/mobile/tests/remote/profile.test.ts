import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createRemoteRuntime } from '../../src/api/remote/client';
import type { ActivityOpinionEntity, PreferencesDto, ProfileEntity } from '../../src/api/remote/wire';
import { isApiError } from '../../src/api/types';
import { fakeDeps, ok, type Reply, scriptedFetch, SPORTS, USER_ID } from './fakes';

const PREFERENCES: PreferencesDto = {
  starting_comfort: 'starting_out',
  sessions_per_week: 3,
  session_minutes: 20,
  preferred_window: { start_hour: 7, end_hour: 9 },
  activity_interests: ['1', '2'],
  discovery_preference: 'occasional',
  available_locations: ['home', 'outdoors'],
  available_equipment: [],
  avoidances: ['jumping'],
  starting_obstacles: ['time'],
  excluded_activity_types: ['42'],
  timezone: 'Europe/Warsaw',
};

const OPINIONS: ActivityOpinionEntity[] = [
  { activity_key: 'easy-walk', title: 'Easy walk', sport_id: '1', opinion: 'yes', last_date: '2026-10-05', updated_at: '2026-10-05T08:00:00Z' },
  { activity_key: 'strength-basics', title: 'Strength basics', sport_id: '2', opinion: 'no', last_date: '2026-10-03', updated_at: '2026-10-03T08:00:00Z' },
];

const notFoundRoute: Reply = {
  status: 404,
  body: { error: { code: 'NOT_FOUND', message: 'Endpoint not found.', retryable: false }, meta: { contract_version: '1', request_id: null } },
};

function setup(options: { extensions?: boolean } = {}) {
  const extensions = options.extensions ?? true;
  const state = {
    profile: { id: USER_ID, username: 'ana', created_at: '2026-10-01T10:00:00Z', preferences: PREFERENCES } as ProfileEntity,
    opinions: [...OPINIONS],
    writes: [] as { method: string; path: string; body: unknown }[],
  };
  const fetch = scriptedFetch((call) => {
    const path = new URL(call.url).pathname.replace(/^.*\/product-api/, '');
    const body: unknown = call.init.body ? JSON.parse(call.init.body) : undefined;
    if (call.init.method !== 'GET') state.writes.push({ method: call.init.method, path, body });
    switch (`${call.init.method} ${path}`) {
      case 'GET /sports':
        return ok(SPORTS);
      case 'GET /profile':
        return ok(state.profile);
      case 'PUT /profile':
        state.profile = { ...state.profile, ...(body as Partial<ProfileEntity>) };
        return ok(state.profile);
      case 'GET /opinions':
        return extensions ? ok(state.opinions) : notFoundRoute;
      case 'PUT /opinions': {
        if (!extensions) return notFoundRoute;
        const put = body as ActivityOpinionEntity & { opinion: ActivityOpinionEntity['opinion'] | null };
        state.opinions = state.opinions.filter((o) => o.activity_key !== put.activity_key);
        if (put.opinion) state.opinions.unshift({ ...put, opinion: put.opinion, updated_at: '2026-10-07T12:00:00Z' });
        return ok(null);
      }
      case 'POST /opinions/reset': {
        if (!extensions) return notFoundRoute;
        const cleared = state.opinions.length;
        state.opinions = [];
        return ok({ cleared });
      }
      default:
        return notFoundRoute;
    }
  });
  return { ...createRemoteRuntime(fakeDeps({ fetch: fetch.fetch })), state };
}

test('the assistant summary is unavailable, so the You tab hides its card', async () => {
  const { client } = setup();
  assert.equal((await client.profile.getSummary()).status, 'unavailable');
});

test('feedback lists the server opinions and the switched-off sports with app sport IDs', async () => {
  const { client } = setup();
  assert.deepEqual(await client.profile.getFeedback(), {
    opinions: [
      { activity_key: 'easy-walk', title: 'Easy walk', sport_id: 'walking', opinion: 'yes', last_date: '2026-10-05', new_idea: false },
      { activity_key: 'strength-basics', title: 'Strength basics', sport_id: 'strength', opinion: 'no', last_date: '2026-10-03', new_idea: false },
    ],
    excluded_sport_ids: ['sport-42'],
  });

  const old = setup({ extensions: false });
  assert.deepEqual((await old.client.profile.getFeedback()).opinions, [], 'no opinions route reads as none');
});

test('Try again clears one opinion with PUT /opinions; an unknown key is not found', async () => {
  const { client, state } = setup();
  const overview = await client.profile.setOpinion('strength-basics', null);
  assert.deepEqual(state.writes, [
    {
      method: 'PUT',
      path: '/opinions',
      body: { activity_key: 'strength-basics', title: 'Strength basics', sport_id: '2', opinion: null, last_date: '2026-10-03' },
    },
  ]);
  assert.deepEqual(overview.opinions.map((o) => o.activity_key), ['easy-walk']);
  await assert.rejects(client.profile.setOpinion('nope', 'yes'), (error) => isApiError(error, 'not_found'));
});

test('reset feedback clears every opinion and keeps the switched-off sports', async () => {
  const { client, state } = setup();
  const overview = await client.profile.resetFeedback();
  assert.deepEqual(state.writes, [{ method: 'POST', path: '/opinions/reset', body: {} }]);
  assert.deepEqual(overview, { opinions: [], excluded_sport_ids: ['sport-42'] });
});

test('without the opinions routes, changing answers fails with a clear message', async () => {
  const { client } = setup({ extensions: false });
  await assert.rejects(client.profile.resetFeedback(), (error) =>
    isApiError(error, 'unknown') && !error.retryable && /can't reset/.test(error.message),
  );
});

test('switching a sport off or on saves the whole profile document with the catalog ID toggled', async () => {
  const { client, state } = setup();
  const off = await client.profile.setSportExcluded('walking', true);
  assert.deepEqual(off.excluded_sport_ids, ['sport-42', 'walking']);
  assert.deepEqual(state.writes[0], {
    method: 'PUT',
    path: '/profile',
    body: { username: 'ana', preferences: { ...PREFERENCES, excluded_activity_types: ['42', '1'] } },
  });

  const on = await client.profile.setSportExcluded('sport-42', false);
  assert.deepEqual(on.excluded_sport_ids, ['walking']);
  assert.deepEqual((state.writes[1].body as { preferences: PreferencesDto }).preferences.excluded_activity_types, ['1']);
  await assert.rejects(client.profile.setSportExcluded('kayaking', true), (error) => isApiError(error, 'not_found'));
});
