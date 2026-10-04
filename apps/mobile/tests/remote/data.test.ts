import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createRemoteData } from '../../src/api/remote/data';
import { createDraftStore, draftStorageKey, isDraftId, newDraftId, type Draft } from '../../src/api/remote/drafts';
import { createProductApi } from '../../src/api/remote/http';
import type { ActivityCompletionEntity, PlanVersionEntity } from '../../src/api/remote/wire';
import { activity, completion, fail, fakeAuth, memoryStorage, ok, scriptedFetch, session, SPORTS, uuid, version, type Call, type Reply } from './fakes';

interface Server {
  history?: PlanVersionEntity[];
  completions?: ActivityCompletionEntity[];
  current?: { plan: unknown; version: PlanVersionEntity } | null;
  routes?: Record<string, Reply>;
}

function page<T>(rows: T[], call: Call): Reply {
  const params = new URL(call.url).searchParams;
  const offset = Number(params.get('offset') ?? 0);
  const limit = Number(params.get('limit') ?? 50);
  return ok(rows.slice(offset, offset + limit));
}

function setup(server: Server) {
  const clock = { now: new Date('2026-10-07T12:00:00Z') };
  const { auth, state } = fakeAuth();
  const fetch = scriptedFetch((call) => {
    const path = new URL(call.url).pathname.replace('/functions/v1/product-api', '');
    const route = server.routes?.[path];
    if (route) return route;
    if (path === '/plans/history') return page(server.history ?? [], call);
    if (path === '/completions') return page(server.completions ?? [], call);
    if (path === '/plans/current') return ok(server.current ?? null);
    if (path === '/sports') return ok(SPORTS);
    return fail(404, 'NOT_FOUND');
  });
  const http = createProductApi({
    fetch: fetch.fetch,
    baseUrl: 'https://example.supabase.co/functions/v1/product-api',
    publishableKey: 'key',
    getAccessToken: async () => state.current?.access_token ?? null,
  });
  const data = createRemoteData(http, { auth, now: () => clock.now });
  const count = (path: string) => fetch.calls.filter((call) => new URL(call.url).pathname.endsWith(path)).length;
  return { data, clock, state, count, calls: fetch.calls };
}

const PLAN = { id: uuid(2), profile_id: uuid(1), active_version_id: null, created_at: '2026-10-01T00:00:00Z' };

test('history pages fully; each week keeps its highest version, revisions never count twice', async () => {
  // 130 versions: weeks 1..65 with two versions each, the second a revision.
  const history: PlanVersionEntity[] = [];
  for (let n = 1; n <= 130; n += 1) {
    const week = new Date(Date.UTC(2026, 0, 5) + Math.floor((n - 1) / 2) * 7 * 86_400_000).toISOString().slice(0, 10);
    history.unshift(version(n, week, [activity(n)], n % 2 === 0 ? 'revise' : 'generate'));
  }
  const { data, count, calls } = setup({ history });
  const weeks = await data.weekSnapshots();
  assert.equal(weeks.size, 65);
  for (const v of weeks.values()) assert.equal(v.version % 2, 0, 'the revision wins');
  assert.equal(count('/plans/history'), 2);
  assert.deepEqual(
    calls.filter((c) => c.url.includes('/plans/history')).map((c) => new URL(c.url).searchParams.get('offset')),
    ['0', '100'],
  );
  assert.equal((await data.history())[0].version, 130, 'newest first');
  assert.equal((await data.versionByNumber(7))?.version, 7);
  assert.equal((await data.versionById(uuid(203)))?.version, 3);
});

test('findActivity prefers the completed version, else the newest version holding it', async () => {
  const kept = activity(1);
  const moved = { ...activity(2), start_at: '2026-10-07T07:00:00+02:00' };
  const removed = activity(3);
  const v1 = version(1, '2026-10-05', [kept, activity(2), removed]);
  const v2 = version(2, '2026-10-05', [kept, moved], 'revise');
  const done = completion(1, kept, v1);
  const { data } = setup({ history: [v2, v1], completions: [done] });

  const found = await data.findActivity(kept.id);
  assert.equal(found?.version.version, 1, 'completed against v1');
  assert.equal((await data.findActivity(moved.id))?.activity.start_at, moved.start_at);
  assert.equal((await data.findActivity(removed.id))?.version.version, 1);
  assert.equal(await data.findActivity(uuid(999)), null);
  assert.equal((await data.completionByActivityId()).get(kept.id)?.id, done.id);
});

test('the active version counts even when the cached history is older', async () => {
  const v1 = version(1, '2026-10-05', [activity(1)]);
  const v2 = version(2, '2026-10-05', [activity(2)], 'revise');
  const { data } = setup({ history: [v1], current: { plan: PLAN, version: v2 } });
  assert.equal((await data.weekSnapshots()).get('2026-10-05')?.version, 2);
});

test('reads are shared while loading, cached for a short time, and refetched after invalidate', async () => {
  const { data, clock, count } = setup({ history: [version(1, '2026-10-05', [])] });
  await Promise.all([data.history(), data.history(), data.weekSnapshots()]);
  assert.equal(count('/plans/history'), 1);
  clock.now = new Date(clock.now.getTime() + 5_000);
  await data.history();
  assert.equal(count('/plans/history'), 1, 'still fresh');
  data.invalidate('history');
  await data.history();
  assert.equal(count('/plans/history'), 2);
  clock.now = new Date(clock.now.getTime() + 20_000);
  await data.history();
  assert.equal(count('/plans/history'), 3, 'stale after the TTL');
  const before = count('/plans/current');
  clock.now = new Date(clock.now.getTime() + 20_000);
  data.setCurrentPlan(null, await data.userId());
  assert.equal(await data.currentPlan(), null);
  assert.equal(count('/plans/current'), before, 'a primed value skips the request');
});

test('a failed read is not cached', async () => {
  const server: Server = { routes: { '/plans/current': fail(503, 'DATA_UNAVAILABLE', true) } };
  const { data, count } = setup(server);
  await assert.rejects(data.currentPlan());
  delete server.routes?.['/plans/current'];
  assert.equal(await data.currentPlan(), null);
  assert.equal(count('/plans/current'), 2);
});

test("another user's sign-in drops everything cached", async () => {
  const { data, state, count } = setup({ history: [] });
  assert.equal(await data.userId(), session().user.id);
  await data.history();
  state.current = session(uuid(77), 'token-2');
  assert.equal(await data.userId(), uuid(77));
  await data.history();
  assert.equal(count('/plans/history'), 2);
  state.current = null;
  await assert.rejects(data.userId(), (error: Error & { code?: string }) => error.code === 'unauthorized');
});

test("a write's answer is cached only while its account is the one signed in", async () => {
  const v1 = version(1, '2026-10-05', [activity(1)]);
  const plan = { plan: PLAN, version: v1 };
  const profile = { id: uuid(1), username: null, created_at: null, preferences: null };
  const { data, state, count } = setup({ routes: { '/profile': fail(404, 'NOT_FOUND') } });
  const ana = await data.userId();

  // Signed out while the write ran: nothing is kept for whoever signs in next.
  data.reset();
  data.setCurrentPlan(plan, ana);
  data.setProfile(profile, ana);
  assert.equal(await data.currentPlan(), null);
  assert.equal(await data.profile(), null);
  assert.equal(count('/plans/current'), 1);

  // Another account has read meanwhile: its cache stays its own.
  state.current = session(uuid(77), 'token-2');
  await data.userId();
  data.setCurrentPlan(plan, ana);
  assert.equal(await data.currentPlan(), null);
  assert.equal(count('/plans/current'), 2);

  data.setCurrentPlan(plan, uuid(77));
  assert.equal((await data.currentPlan())?.version.id, v1.id, "the account's own write is kept");
  assert.equal(count('/plans/current'), 2);
});

test('sport IDs translate between slugs and catalog IDs', async () => {
  const { data } = setup({});
  const ids = await data.sportIds();
  assert.equal(ids.toWire('walking'), '1');
  assert.equal(ids.toWire('running'), '3');
  assert.equal(ids.toWire('sport-42'), '42');
  assert.equal(ids.toWire('42'), '42');
  assert.equal(ids.toWire('yoga'), null);
  assert.equal(ids.toApp('2'), 'strength');
  assert.equal(ids.toApp('42'), 'sport-42');
  assert.equal(ids.toApp('999'), 'sport-999');
  assert.equal(await data.toWireSportId('tennis'), '9');
});

test('missing profile row and missing opinions endpoint read as empty', async () => {
  const { data } = setup({ routes: { '/profile': fail(404, 'NOT_FOUND') } });
  assert.equal(await data.profile(), null);
  assert.deepEqual(await data.opinions(), []);
});

test('drafts are kept per user and survive a new store', async () => {
  const storage = memoryStorage();
  let user = uuid(1);
  const drafts = createDraftStore(storage, async () => user);
  const id = newDraftId(() => 'abc');
  assert.equal(id, 'draft:abc');
  assert.ok(isDraftId(id) && !isDraftId(uuid(5)));
  const draft = { id, request_id: uuid(9), activity_id: uuid(101), duration_seconds: 600 } as Draft;
  await Promise.all([drafts.put(draft), drafts.put({ ...draft, id: 'draft:def' })]);
  await drafts.put({ ...draft, duration_seconds: 900 });
  assert.deepEqual((await drafts.list()).map((d) => [d.id, d.duration_seconds]), [
    ['draft:abc', 900],
    ['draft:def', 600],
  ]);
  assert.ok(storage.items.has(draftStorageKey(uuid(1))));

  user = uuid(2);
  assert.deepEqual(await drafts.list(), []);
  user = uuid(1);
  const again = createDraftStore(storage, async () => user);
  assert.equal((await again.get('draft:def'))?.duration_seconds, 600);
  await again.remove('draft:abc');
  await again.remove('draft:def');
  assert.equal(await again.get('draft:abc'), null);
  assert.equal(storage.items.size, 0, 'an empty list removes the key');
});
