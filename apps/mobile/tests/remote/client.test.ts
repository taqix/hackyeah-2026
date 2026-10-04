import assert from 'node:assert/strict';
import { test } from 'node:test';

import { accessTokenGetter, createRemoteRuntime } from '../../src/api/remote/client';
import { isApiError } from '../../src/api/types';
import { fakeAuth, fakeDeps, ok, scriptedFetch, session, SPORTS } from './fakes';

test('the remote client lists the catalog in the app order with slug IDs', async () => {
  const fetch = scriptedFetch(() => ok(SPORTS));
  const { client } = createRemoteRuntime(fakeDeps({ fetch: fetch.fetch }));
  const sports = await client.catalog.listSports();
  assert.deepEqual(
    sports.map((s) => [s.id, s.availability]),
    [
      ['walking', 'working'],
      ['strength', 'working'],
      ['running', 'working'],
      ['sport-42', 'working'],
      ['tennis', 'preview'],
    ],
  );
  assert.deepEqual(
    sports.filter((s) => s.suggested).map((s) => s.id),
    ['walking', 'strength', 'running'],
  );
  assert.equal(fetch.calls.length, 1, 'catalog and ID map share one request');
});

test('without library sports the first six working ones are suggested', async () => {
  const fetch = scriptedFetch(() =>
    ok([1, 2, 3, 4, 5, 6, 7].map((n) => ({ id: String(n), name: `Sport ${n}`, is_gym: false, generation_enabled: true, metrics: [] }))),
  );
  const { client } = createRemoteRuntime(fakeDeps({ fetch: fetch.fetch }));
  assert.equal((await client.catalog.listSports()).filter((s) => s.suggested).length, 6);
});

test('sections not written yet reject instead of pretending', async () => {
  const { client } = createRemoteRuntime(fakeDeps());
  await assert.rejects(client.logs.commit('draft:x'), (error) => isApiError(error, 'unknown'));
});

test('the access token comes from the session, a forced refresh, or rejects on a network failure', async () => {
  const { auth, state } = fakeAuth();
  const token = accessTokenGetter(auth);
  assert.equal(await token(), 'token-1');
  state.refreshed = session(undefined, 'token-2');
  assert.equal(await token(true), 'token-2');
  state.current = null;
  assert.equal(await token(), null);

  const offline = accessTokenGetter({
    ...auth,
    getSession: async () => ({ data: { session: null }, error: { name: 'AuthRetryableFetchError', message: 'Network request failed', status: 0 } }),
  });
  await assert.rejects(offline());
});
