import assert from 'node:assert/strict';
import { test } from 'node:test';

import { toLocalDate } from '../../src/lib/dates';
import { createRemoteRuntime } from '../../src/api/remote/client';
import type { Draft } from '../../src/api/remote/drafts';
import { draftStorageKey } from '../../src/api/remote/drafts';
import type {
  ActivityCompletionEntity,
  ActivityOpinionEntity,
  CompleteActivityDto,
  PlanVersionEntity,
} from '../../src/api/remote/wire';
import { isApiError, type LoggedSet } from '../../src/api/types';
import {
  activity,
  completion,
  fail,
  fakeAuth,
  fakeDeps,
  gymActivity,
  memoryStorage,
  ok,
  PLAN_ID,
  type Reply,
  scriptedFetch,
  SPORTS,
  USER_ID,
  uuid,
  version,
} from './fakes';

const WALK = activity(1);
const GYM = gymActivity(2);
const V1 = version(1, '2026-10-05', [WALK, GYM, activity(3)]);
const NOW = new Date('2026-10-07T12:00:00Z');

const notFoundRoute: Reply = {
  status: 404,
  body: { error: { code: 'NOT_FOUND', message: 'Endpoint not found.', retryable: false }, meta: { contract_version: '1', request_id: null } },
};

/** The product API in memory: plan, completions (with the feedback extension) and opinions. */
function fakeServer(options: { versions?: PlanVersionEntity[]; extensions?: boolean } = {}) {
  const versions = options.versions ?? [V1];
  const extensions = options.extensions ?? true;
  const state = {
    completions: [] as ActivityCompletionEntity[],
    opinions: [] as ActivityOpinionEntity[],
    /** Raw POST /completions bodies, in order (retries included). */
    posts: [] as string[],
    feedbackPuts: [] as unknown[],
    opinionPuts: [] as unknown[],
    /** Answers for the next POST /completions calls, before the normal behaviour. */
    completionReplies: [] as Reply[],
  };
  let saved = 0;
  const newest = () => [...versions].sort((a, b) => b.version - a.version)[0];
  const page = <T>(rows: T[], url: URL) => (Number(url.searchParams.get('offset') ?? 0) === 0 ? rows : []);

  const fetch = scriptedFetch((call) => {
    const url = new URL(call.url);
    const path = url.pathname.replace(/^.*\/product-api/, '');
    const body: unknown = call.init.body ? JSON.parse(call.init.body) : undefined;
    switch (`${call.init.method} ${path}`) {
      case 'GET /sports':
        return ok(SPORTS);
      case 'GET /plans/current': {
        const active = newest();
        return ok(active ? { plan: { id: PLAN_ID, profile_id: USER_ID, active_version_id: active.id, created_at: active.created_at }, version: active } : null);
      }
      case 'GET /plans/history':
        return ok(page([...versions].sort((a, b) => b.version - a.version), url));
      case 'GET /completions':
        return ok(page(state.completions, url));
      case 'POST /completions': {
        state.posts.push(call.init.body ?? '');
        const scripted = state.completionReplies.shift();
        if (scripted) return scripted;
        const dto = body as CompleteActivityDto;
        const existing = state.completions.find((c) => c.request_id === dto.request_id);
        if (existing) return ok(existing);
        if (state.completions.some((c) => c.activity_id === dto.activity_id)) return fail(409, 'ALREADY_COMPLETED');
        const entity: ActivityCompletionEntity = { ...dto, id: uuid(500 + (saved += 1)), profile_id: USER_ID };
        state.completions.unshift(entity);
        return ok(entity);
      }
      case 'PUT /completions/feedback': {
        if (!extensions) return notFoundRoute;
        state.feedbackPuts.push(body);
        const { completion_id, feedback } = body as { completion_id: string; feedback: CompleteActivityDto['feedback'] };
        const index = state.completions.findIndex((c) => c.id === completion_id);
        if (index < 0) return fail(404, 'NOT_FOUND');
        state.completions[index] = { ...state.completions[index], feedback };
        return ok(state.completions[index]);
      }
      case 'GET /opinions':
        return extensions ? ok(state.opinions) : notFoundRoute;
      case 'PUT /opinions': {
        if (!extensions) return notFoundRoute;
        state.opinionPuts.push(body);
        return ok(null);
      }
      default:
        return notFoundRoute;
    }
  });
  return { fetch, state };
}

function setup(options: Parameters<typeof fakeServer>[0] & { now?: () => Date; storage?: ReturnType<typeof memoryStorage> } = {}) {
  const server = fakeServer(options);
  const storage = options.storage ?? memoryStorage();
  const runtime = createRemoteRuntime(
    fakeDeps({ fetch: server.fetch.fetch, storage, now: options.now ?? (() => NOW) }),
  );
  return { ...runtime, server, storage };
}

const walkInput = {
  session_id: WALK.id,
  sport_id: 'walking',
  started_at: '2026-10-05T07:00:00+02:00',
  duration_seconds: 1500,
  source: 'typed' as const,
  metrics: { distance_km: '2.5', route: ' park ' },
};

const gymSets: LoggedSet[] = [
  { exercise_id: 'chair_squat', exercise_name: 'Chair squat', set_index: 0, reps: 10, weight_kg: 8, seconds: null },
  { exercise_id: 'chair_squat', exercise_name: 'Chair squat', set_index: 1, reps: 9, weight_kg: 10, seconds: null },
];

const posted = (raw: string) => JSON.parse(raw) as CompleteActivityDto;

test('a new log is a local draft: the session counts as done and nothing is sent yet', async () => {
  const { client, drafts, server } = setup();
  const log = await client.logs.create(walkInput);

  assert.match(log.id, /^draft:/);
  assert.equal(log.session_id, WALK.id);
  assert.equal(log.sport_id, 'walking');
  assert.equal(log.title, WALK.title);
  assert.equal(log.actuals_locked, false);
  assert.equal(log.feedback, null);
  assert.equal(log.metrics.duration_minutes, 1500, 'the duration metric is filled in seconds like the mock');
  assert.equal(server.state.posts.length, 0);

  const [draft] = await drafts.list();
  assert.equal(draft.id, `draft:${draft.request_id}`);
  assert.equal(draft.plan_version_id, V1.id);
  assert.deepEqual(await client.logs.get(log.id), log);
});

test('create rejects extras, unknown sessions and sessions already logged', async () => {
  const { client, server } = setup();
  server.state.completions.push(completion(1, GYM, V1));
  await assert.rejects(client.logs.create({ ...walkInput, session_id: null }), (error) =>
    isApiError(error, 'validation') && /outside the plan/.test(error.message),
  );
  await assert.rejects(client.logs.create({ ...walkInput, session_id: uuid(999) }), (error) => isApiError(error, 'not_found'));

  await client.logs.create(walkInput);
  await assert.rejects(client.logs.create(walkInput), (error) => isApiError(error, 'conflict'), 'a draft exists');
  await assert.rejects(client.logs.create({ ...walkInput, session_id: GYM.id, sport_id: 'strength' }), (error) =>
    isApiError(error, 'conflict'),
  );
});

test('create, fix, then feedback sends one completion with the feedback and saves the opinion', async () => {
  const { client, drafts, server } = setup();
  const draftLog = await client.logs.create(walkInput);
  await client.logs.update(draftLog.id, { duration_seconds: 1800, metrics: { duration_minutes: 1800, distance_km: 3 } });

  const saved = await client.logs.saveFeedback(draftLog.id, { felt: 'just_right', note: ' Nice ', choose_again: 'yes' });

  assert.equal(server.state.posts.length, 1);
  const body = posted(server.state.posts[0]);
  assert.equal(body.activity_id, WALK.id);
  assert.equal(body.plan_version_id, V1.id);
  assert.equal(body.request_id, draftLog.id.slice('draft:'.length));
  assert.deepEqual(body.metrics, { duration_minutes: 30, distance_km: 3 });
  assert.deepEqual(body.gym_log, []);
  assert.deepEqual(body.feedback, { effort: 'okay', enjoyment: 'yes', notes: 'Nice' });
  assert.equal(Date.parse(body.completed_at), Date.parse('2026-10-05T05:30:00Z'), 'start plus the length');

  assert.deepEqual(server.state.opinionPuts, [
    { activity_key: 'easy-walk-1', title: WALK.title, sport_id: '1', opinion: 'yes', last_date: toLocalDate(WALK.start_at) },
  ]);
  assert.equal(saved.id, server.state.completions[0].id);
  assert.equal(saved.actuals_locked, true);
  assert.equal(saved.feedback?.felt, 'just_right');
  assert.equal(saved.duration_seconds, 1800);
  assert.deepEqual(await drafts.list(), []);
  assert.equal((await client.logs.get(draftLog.id)).id, saved.id, 'the draft ID still finds the saved log');
});

test('closing feedback commits a gym draft without feedback; the duration fills the required metric', async () => {
  const { client, server } = setup();
  const draftLog = await client.logs.create({
    session_id: GYM.id,
    sport_id: 'strength',
    started_at: '2026-10-07T11:50:00Z',
    duration_seconds: 3600,
    source: 'live',
    sets: gymSets,
    ended_early: true,
  });
  const saved = await client.logs.commit(draftLog.id);

  const body = posted(server.state.posts[0]);
  assert.equal(body.feedback, null);
  assert.deepEqual(body.metrics, { duration_minutes: 60 });
  assert.deepEqual(body.gym_log, [
    { exercise_id: 'chair_squat', sets: [{ repetitions: 10, weight_kg: 8 }, { repetitions: 9, weight_kg: 10 }] },
  ]);
  assert.equal(Date.parse(body.completed_at), NOW.getTime(), 'completed_at is never in the future');
  assert.equal(saved.feedback, null);
  assert.equal(saved.actuals_locked, true);
  assert.equal(saved.sets.length, 2);

  assert.deepEqual(await client.logs.commit(saved.id), saved, 'a saved log comes back unchanged');
  assert.equal(server.state.posts.length, 1);
  await assert.rejects(client.logs.update(saved.id, { duration_seconds: 60 }), (error) =>
    isApiError(error, 'conflict') && error.message === "Saved sessions can't be edited.",
  );
  await assert.rejects(client.logs.update(draftLog.id, { duration_seconds: 60 }), (error) => isApiError(error, 'conflict'));
});

test('a retry after a failed save resends the same body; feedback given later follows with PUT', async () => {
  const { client, drafts, server } = setup();
  const draftLog = await client.logs.create(walkInput);
  server.state.completionReplies.push(fail(500, 'INTERNAL_ERROR'));
  await assert.rejects(client.logs.commit(draftLog.id), (error) => isApiError(error, 'unknown'));
  assert.ok((await drafts.get(draftLog.id))?.submission, 'the body is kept for the retry');

  const saved = await client.logs.saveFeedback(draftLog.id, { felt: 'hard', note: null, choose_again: null });
  assert.equal(server.state.posts.length, 2);
  assert.equal(server.state.posts[1], server.state.posts[0], 'same bytes, same request_id');
  assert.deepEqual(server.state.feedbackPuts, [
    { completion_id: saved.id, feedback: { effort: 'hard', enjoyment: null, notes: '' } },
  ]);
  assert.equal(saved.feedback?.felt, 'hard');
  assert.deepEqual(server.state.opinionPuts, [], 'no opinion without an answer');
});

test('offline saves retry the identical body and keep the draft until it is saved', async () => {
  const { client, drafts, server } = setup();
  const draftLog = await client.logs.create(walkInput);
  const offline = () => ({ throws: new TypeError('Network request failed') });
  server.state.completionReplies.push(offline(), offline(), offline());

  await assert.rejects(client.logs.commit(draftLog.id), (error) => isApiError(error, 'offline'));
  assert.equal(server.state.posts.length, 3, 'the transport retried twice');
  assert.ok(await drafts.get(draftLog.id));

  const saved = await client.logs.commit(draftLog.id);
  assert.equal(new Set(server.state.posts).size, 1, 'every attempt sent the same bytes');
  assert.equal(saved.id, server.state.completions[0].id);
  assert.equal(await drafts.get(draftLog.id), null);
});

test('changing a draft after a sent attempt gives the next attempt a new request_id', async () => {
  const { client, server } = setup();
  const draftLog = await client.logs.create(walkInput);
  server.state.completionReplies.push(fail(500, 'INTERNAL_ERROR'));
  await assert.rejects(client.logs.commit(draftLog.id));
  await client.logs.update(draftLog.id, { duration_seconds: 1200 });
  await client.logs.commit(draftLog.id);

  const [first, second] = server.state.posts.map(posted);
  assert.notEqual(second.request_id, first.request_id);
  assert.equal(second.metrics.duration_minutes, 25, 'the metric value was not patched, so it stays');
  assert.equal(Date.parse(second.completed_at), Date.parse('2026-10-05T05:20:00Z'));
});

test('ALREADY_COMPLETED counts as saved: the existing completion is shown and the draft goes', async () => {
  const { client, drafts, server } = setup();
  const draftLog = await client.logs.create(walkInput);
  const elsewhere = completion(7, WALK, V1, { feedback: null });
  server.state.completions.push(elsewhere);

  const saved = await client.logs.commit(draftLog.id);
  assert.equal(saved.id, elsewhere.id);
  assert.equal(await drafts.get(draftLog.id), null);

  const withFeedback = await client.logs.saveFeedback(draftLog.id, { felt: 'easy', note: null, choose_again: 'maybe' });
  assert.equal(withFeedback.id, elsewhere.id);
  assert.equal(server.state.feedbackPuts.length, 1, 'feedback on the saved log goes through PUT');
  assert.equal(withFeedback.feedback?.choose_again, 'maybe');
});

test('feedback on a saved completion uses PUT /completions/feedback; a missing route reads clearly', async () => {
  const saved = completion(1, WALK, V1, { feedback: null });
  const { client, server } = setup();
  server.state.completions.push(saved);
  const log = await client.logs.saveFeedback(saved.id, { felt: 'too_much', note: 'Stopped early.', choose_again: 'no' });
  assert.deepEqual(server.state.feedbackPuts, [
    { completion_id: saved.id, feedback: { effort: 'too_much', enjoyment: 'no', notes: 'Stopped early.' } },
  ]);
  assert.equal(log.feedback?.note, 'Stopped early.');
  assert.equal(server.state.posts.length, 0);

  const old = setup({ extensions: false });
  old.server.state.completions.push(saved);
  await assert.rejects(old.client.logs.saveFeedback(saved.id, { felt: 'easy', note: null, choose_again: null }), (error) =>
    isApiError(error, 'unknown') && !error.retryable && /saved session/.test(error.message),
  );
});

test('without the opinions route, feedback on a draft still saves (the answer stays in the feedback)', async () => {
  const { client, server } = setup({ extensions: false });
  const draftLog = await client.logs.create(walkInput);
  const saved = await client.logs.saveFeedback(draftLog.id, { felt: 'easy', note: null, choose_again: 'yes' });
  assert.equal(posted(server.state.posts[0]).feedback?.enjoyment, 'yes');
  assert.equal(saved.feedback?.choose_again, 'yes');
});

test('a draft saved in an earlier run is still found by its draft ID', async () => {
  const storage = memoryStorage();
  const first = setup({ storage });
  const draftLog = await first.client.logs.create(walkInput);
  await first.client.logs.commit(draftLog.id);

  const restarted = createRemoteRuntime(fakeDeps({ fetch: first.server.fetch.fetch, storage, now: () => NOW }));
  assert.equal((await restarted.client.logs.get(draftLog.id)).id, first.server.state.completions[0].id);
});

test('last time for an exercise comes from the newest completion that has it', async () => {
  const gymA = gymActivity(4);
  const gymB = gymActivity(5);
  const v = version(1, '2026-10-05', [gymA, gymB]);
  const { client, server } = setup({ versions: [v] });
  server.state.completions.push(
    completion(1, gymB, v, {
      completed_at: '2026-10-06T08:00:00Z',
      gym_log: [{ exercise_id: 'chair_squat', sets: [{ repetitions: 12, weight_kg: 6 }, { repetitions: 10, weight_kg: 9 }, { repetitions: 8, weight_kg: null }] }],
    }),
    completion(2, gymA, v, {
      completed_at: '2026-10-04T08:00:00Z',
      gym_log: [
        { exercise_id: 'chair_squat', sets: [{ repetitions: 5, weight_kg: 20 }] },
        { exercise_id: 'wall_push_up', sets: [{ repetitions: 8, weight_kg: null }, { repetitions: 7, weight_kg: null }] },
      ],
    }),
  );

  assert.deepEqual(await client.logs.lastForExercise({ exercise_id: 'chair_squat', name: 'Chair squat' }), {
    exercise_name: 'Chair squat',
    date: toLocalDate(new Date(Date.parse('2026-10-06T08:00:00Z') - 25 * 60_000)),
    sets: 3,
    reps: 12,
    weight_kg: 9,
  });
  const byName = await client.logs.lastForExercise({ name: 'wall push-up' });
  assert.equal(byName?.sets, 2);
  assert.equal(byName?.weight_kg, null);
  assert.equal(await client.logs.lastForExercise({ exercise_id: 'plank', name: 'Plank' }), null);
});

test('flushDrafts saves old drafts, keeps new ones, drops gone or saved sessions, and never rejects', async () => {
  let clock = NOW;
  const { client, drafts, server, flushDrafts, storage } = setup({ now: () => clock });
  const old = await client.logs.create(walkInput);
  const savedElsewhere = await client.logs.create({ ...walkInput, session_id: activity(3).id });
  server.state.completions.push(completion(9, activity(3), V1));
  clock = new Date(NOW.getTime() + 25 * 3_600_000);
  const fresh = await client.logs.create({ ...walkInput, session_id: GYM.id, sport_id: 'strength', sets: gymSets });
  const gone: Draft = { ...(await drafts.get(fresh.id))!, id: 'draft:gone', request_id: 'gone', activity_id: uuid(998) };
  await drafts.put(gone);

  await flushDrafts();
  assert.equal(server.state.posts.length, 1);
  assert.equal(posted(server.state.posts[0]).activity_id, WALK.id);
  assert.deepEqual((await drafts.list()).map((d) => d.id), [fresh.id]);
  assert.equal((await client.logs.get(old.id)).actuals_locked, true);
  assert.equal((await client.logs.get(savedElsewhere.id)).id, uuid(309));

  const signedOut = createRemoteRuntime(fakeDeps({ fetch: server.fetch.fetch, storage, auth: fakeAuth(null).auth }));
  await assert.doesNotReject(signedOut.flushDrafts());
  assert.ok(storage.items.has(draftStorageKey(USER_ID)));
});
