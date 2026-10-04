import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createRemoteRuntime } from '../../src/api/remote/client';
import { planningFieldsChanged } from '../../src/api/remote/preferences';
import type { Preferences } from '../../src/api/types';
import type { FetchLike } from '../../src/api/remote/deps';
import { activity, fakeAuth, fakeDeps, session, uuid, version } from './fakes';
import { fakeServer, flush, gate, PREFERENCES } from './plan-fakes';

process.env.TZ = 'Europe/Warsaw';

const APP_PREFERENCES: Preferences = {
  timezone: 'Europe/Warsaw',
  starting_comfort: 'starting_out',
  sessions_per_week: 3,
  session_minutes: 20,
  preferred_window: [7, 11],
  activity_interests: ['walking'],
  discovery_preference: 'occasional',
  available_locations: ['outdoors'],
  available_equipment: [],
  avoidances: [],
  starting_obstacles: ['time'],
  excluded_activity_types: [],
};

const runtime = (server: ReturnType<typeof fakeServer>) => createRemoteRuntime(fakeDeps({ fetch: server.fetch }));

test('answers read as null before onboarding, then in the app shape with slug IDs', async () => {
  assert.equal(await runtime(fakeServer({ profile: null })).client.preferences.get(), null, 'no profile row (404)');
  const empty = fakeServer();
  empty.state.profile = { id: 'x', username: null, created_at: null, preferences: null };
  assert.equal(await runtime(empty).client.preferences.get(), null);

  assert.deepEqual(await runtime(fakeServer()).client.preferences.get(), APP_PREFERENCES);
});

test('saving puts the whole document, keeps the username, and round-trips', async () => {
  const server = fakeServer();
  const { client } = runtime(server);
  const next: Preferences = { ...APP_PREFERENCES, activity_interests: ['walking', 'strength'], preferred_window: null };
  const saved = await client.preferences.save(next);
  assert.deepEqual(saved, next);
  const put = server.requests.find((r) => r.method === 'PUT');
  assert.deepEqual(put?.body, {
    username: 'ana',
    preferences: { ...PREFERENCES, activity_interests: ['1', '2'], preferred_window: null },
  });
  assert.deepEqual(await client.preferences.get(), next, 'read back from the saved profile');
  assert.equal(server.generates().length, 0, 'no plan yet: nothing to re-plan');
});

test('changed answers re-plan the active week in the background; the save does not wait', async () => {
  const week = version(1, '2026-10-05', [activity(1, { start_at: '2026-10-09T07:00:00+02:00' })]);
  const server = fakeServer({ versions: [week] });
  const held = gate<void>();
  const save = server.state.generate;
  server.state.generate = async (body) => {
    await held.promise;
    return save(body);
  };
  const { client } = runtime(server);
  assert.equal((await client.plan.getState()).active_version, 1);

  await client.preferences.save({ ...APP_PREFERENCES, sessions_per_week: 4 });
  await flush();
  const [sent] = server.generates();
  const body = sent.body as { week_start: string; expected_version: number; availability: { slots: { start_at: string }[] } };
  assert.equal(body.week_start, '2026-10-05', 'the active week');
  assert.equal(body.expected_version, 1);
  assert.ok(Date.parse(body.availability.slots[0].start_at) >= Date.parse('2026-10-07T12:00:00Z'), 'free time from now');
  assert.equal((await client.plan.getState()).status, 'ready', 'the plan stays usable while it re-plans');

  held.open();
  await flush();
  assert.equal((await client.plan.getState()).active_version, 2);
});

test("answers saved as another account signs in neither fill that account's cache nor re-plan its week", async () => {
  const server = fakeServer({ versions: [version(1, '2026-10-05', [activity(1, { start_at: '2026-10-09T07:00:00+02:00' })])] });
  const signedIn = fakeAuth();
  let switched: Promise<unknown> = Promise.resolve();
  const fetch: FetchLike = async (url, init) => {
    const response = await server.fetch(url, init);
    if (init.method === 'PUT') {
      // Ana signs out while her answers save; Ben signs in and reads his profile.
      remote.data.reset();
      signedIn.state.current = session(uuid(77), 'token-2');
      server.state.profile = { id: uuid(77), username: 'ben', created_at: null, preferences: { ...PREFERENCES, sessions_per_week: 2 } };
      switched = remote.client.preferences.get();
    }
    return response;
  };
  const remote = createRemoteRuntime(fakeDeps({ fetch, auth: signedIn.auth }));
  await remote.client.plan.getState();

  await remote.client.preferences.save({ ...APP_PREFERENCES, sessions_per_week: 4 });
  await switched;
  await flush();
  assert.equal(server.generates().length, 0, "Ben's week is not re-planned from Ana's answers");
  assert.equal((await remote.client.preferences.get())?.sessions_per_week, 2, "Ben's answers, not Ana's");
});

test('answers the planner does not read, or the same lists in another order, re-plan nothing', async () => {
  const server = fakeServer({ versions: [version(1, '2026-10-05', [activity(1)])] });
  server.state.profile = {
    id: 'x',
    username: 'ana',
    created_at: null,
    preferences: { ...PREFERENCES, activity_interests: ['1', '2'] },
  };
  const { client } = runtime(server);
  await client.preferences.save({
    ...APP_PREFERENCES,
    activity_interests: ['strength', 'walking'],
    starting_obstacles: ['boredom'],
    timezone: 'Europe/London',
  });
  await flush();
  assert.equal(server.generates().length, 0);
});

test('a failed re-plan keeps the week and leaves a note', async () => {
  const server = fakeServer({
    versions: [version(1, '2026-10-05', [activity(1)])],
    generate: () => ({ status: 503, body: { error: { code: 'PROVIDER_UNAVAILABLE', message: 'busy', retryable: true }, meta: { contract_version: '1', request_id: null } } }),
  });
  const { client } = runtime(server);
  await client.preferences.save({ ...APP_PREFERENCES, session_minutes: 30 });
  await flush();
  const state = await client.plan.getState();
  assert.deepEqual([state.status, state.active_version], ['ready', 1]);
  assert.equal(state.failure_message, "Your answers are saved, but your week didn't update. It stays as it was for now.");
});

test('planning fields: lists compare as sets, the window and counts as values, obstacles never', () => {
  assert.equal(planningFieldsChanged(APP_PREFERENCES, { ...APP_PREFERENCES }), false);
  const otherObstacles: Preferences = { ...APP_PREFERENCES, starting_obstacles: [], timezone: 'UTC' };
  assert.equal(planningFieldsChanged(APP_PREFERENCES, otherObstacles), false);
  assert.equal(
    planningFieldsChanged(
      { ...APP_PREFERENCES, available_locations: ['home', 'outdoors'] },
      { ...APP_PREFERENCES, available_locations: ['outdoors', 'home'] },
    ),
    false,
  );
  assert.equal(planningFieldsChanged(APP_PREFERENCES, { ...APP_PREFERENCES, preferred_window: [8, 11] }), true);
  assert.equal(planningFieldsChanged(APP_PREFERENCES, { ...APP_PREFERENCES, excluded_activity_types: ['running'] }), true);
  assert.equal(planningFieldsChanged(APP_PREFERENCES, { ...APP_PREFERENCES, starting_comfort: 'some_routine' }), true);
  assert.equal(planningFieldsChanged(PREFERENCES, { ...PREFERENCES, preferred_window: null }), true, 'wire shape too');
  assert.equal(planningFieldsChanged(null, APP_PREFERENCES), true);
});
