import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createRemoteRuntime } from '../../src/api/remote/client';
import type { Draft } from '../../src/api/remote/drafts';
import { changeSeenKey } from '../../src/api/remote/plan';
import { weekToPlanNext } from '../../src/api/remote/plan/schedule';
import { isApiError, type PlanState } from '../../src/api/types';
import { activity, completion, fakeDeps, fail, memoryStorage, USER_ID, uuid, version } from './fakes';
import { fakeServer, flush, gate, message } from './plan-fakes';

// Fixtures are in Warsaw time (+02:00); week math runs in the device's zone.
process.env.TZ = 'Europe/Warsaw';

const WEEK_1 = '2026-10-05';
const WEEK_2 = '2026-10-12';
const at = (day: number, hour = 7) => `2026-10-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00+02:00`;

/** Week 1 planned (v1), revised in chat (v2: a2 moved, a3 removed, a4 added), then week 2 planned (v3). */
function revisedWeeks() {
  const a1 = activity(1, { start_at: at(5) });
  const a2 = activity(2, { start_at: at(7, 18) });
  const a3 = activity(3, { start_at: at(9) });
  const a4 = activity(4, { start_at: at(10) });
  const b1 = activity(5, { start_at: at(13) });
  const v1 = version(1, WEEK_1, [a1, a2, a3]);
  const v2 = version(2, WEEK_1, [a1, { ...a2, start_at: at(8, 18) }, a4], 'revise');
  const v3 = version(3, WEEK_2, [b1]);
  return { a1, a2, a3, a4, b1, v1, v2, v3 };
}

function runtime(server: ReturnType<typeof fakeServer>, storage = memoryStorage()) {
  return createRemoteRuntime(fakeDeps({ fetch: server.fetch, storage }));
}

test('a week is its newest snapshot joined with completions; a revision never counts twice', async () => {
  const { a1, a2, a4, b1, v1, v2, v3 } = revisedWeeks();
  const server = fakeServer({ versions: [v1, v2, v3], completions: [completion(1, a1, v1)] });
  const { client } = runtime(server);

  const week = await client.plan.getWeek(WEEK_1);
  assert.equal(week.planned, true);
  assert.equal(week.week_end, '2026-10-11');
  assert.deepEqual(
    week.sessions.map((s) => [s.id, s.status, s.plan_version, s.changed_in_version]),
    [
      [a1.id, 'completed', 1, null],
      [a2.id, 'planned', 2, 2],
      [a4.id, 'planned', 2, 2],
    ],
  );
  assert.equal(week.sessions[0].log_id, uuid(301));
  assert.equal(week.summary, 'Version 2.');
  assert.deepEqual(week.extras, []);

  const next = await client.plan.getWeek(WEEK_2);
  assert.deepEqual(next.sessions.map((s) => s.id), [b1.id]);
  assert.equal(next.sessions[0].changed_in_version, null, "a week's first version is not an update");

  const before = await client.plan.getWeek('2026-09-28');
  assert.equal(before.planned, false);
  assert.deepEqual(before.sessions, []);

  const month = await client.plan.listSessions({ from: '2026-10-01', to: '2026-10-31' });
  assert.equal(month.sessions.length, 4);
  assert.deepEqual(month.extras, []);

  const state = await client.plan.getState();
  assert.deepEqual(
    [state.status, state.active_version, state.first_week_start, state.planned_through],
    ['ready', 3, WEEK_1, '2026-10-18'],
  );
});

test('a past week has no summary, and weeks must start on a Monday', async () => {
  const { v1 } = revisedWeeks();
  const server = fakeServer({ versions: [v1] });
  const { client } = createRemoteRuntime(
    fakeDeps({ fetch: server.fetch, now: () => new Date('2026-10-20T10:00:00Z') }),
  );
  const week = await client.plan.getWeek(WEEK_1);
  assert.equal(week.planned, true);
  assert.equal(week.summary, null);
  await assert.rejects(client.plan.getWeek('2026-10-06'), (error) => isApiError(error, 'validation'));
});

test('a draft marks its session done before it is saved', async () => {
  const { a2, v1, v2 } = revisedWeeks();
  const server = fakeServer({ versions: [v1, v2] });
  const { client, drafts } = runtime(server);
  const draft: Draft = {
    id: 'draft:1',
    request_id: uuid(900),
    activity_id: a2.id,
    plan_version_id: v1.id,
    sport_id: 'walking',
    title: a2.title,
    started_at: at(8, 18),
    duration_seconds: 1200,
    source: 'typed',
    file_name: null,
    metrics: {},
    sets: [],
    ended_early: false,
    created_at: at(8, 19),
    submission: null,
  };
  await drafts.put(draft);
  const session = await client.plan.getSession(a2.id);
  assert.equal(session.status, 'completed');
  assert.equal(session.log_id, 'draft:1');
  assert.equal(session.plan_version, 1, 'done in the version the draft was logged against');
  assert.equal(session.editable, false);
});

test('done work stays when a later revision dropped it; a dropped planned session is gone', async () => {
  const { a1, a3, v1, v2 } = revisedWeeks();
  const server = fakeServer({ versions: [v1, v2], completions: [completion(3, a3, v1)] });
  const { client } = runtime(server);
  const week = await client.plan.getWeek(WEEK_1);
  assert.ok(week.sessions.some((s) => s.id === a3.id && s.status === 'completed' && s.plan_version === 1));
  assert.equal(week.sessions.filter((s) => s.id === a1.id).length, 1);

  const removed = fakeServer({ versions: [v1, v2] });
  await assert.rejects(runtime(removed).client.plan.getSession(a3.id), (error) => isApiError(error, 'not_found'));
});

test('the first plan builds in the background: none, building, then ready', async () => {
  const server = fakeServer();
  const held = gate<void>();
  const save = server.state.generate;
  server.state.generate = async (body) => {
    await held.promise;
    return save(body);
  };
  const { client } = runtime(server);

  assert.equal((await client.plan.getState()).status, 'none');
  const started = await client.plan.build({});
  assert.equal(started.status, 'building');
  assert.equal((await client.plan.getState()).status, 'building');

  const [sent] = server.generates();
  const body = sent.body as { request_id: string; expected_version: number; sport_id: null; week_start: string; availability: { source: string; slots: { start_at: string }[] } };
  assert.equal(body.week_start, WEEK_1, 'the Monday of the current week');
  assert.equal(body.expected_version, 0);
  assert.equal(body.sport_id, null);
  assert.equal(body.availability.source, 'manual');
  assert.ok(Date.parse(body.availability.slots[0].start_at) >= Date.parse('2026-10-07T12:00:00Z'), 'free time from now');

  held.open();
  await flush();
  const ready = await client.plan.getState();
  assert.deepEqual([ready.status, ready.active_version, ready.failure_message], ['ready', 1, null]);
  assert.equal(server.generates().length, 1);
});

test('a failed first plan reads as failed, with calm copy per cause', async () => {
  const cases: [ReturnType<typeof fail>, string, RegExp][] = [
    [fail(501, 'AI_NOT_CONFIGURED'), 'ai_unavailable', /^Plan building isn't connected yet\. Your answers are saved\.$/],
    [fail(400, 'INVALID_REQUEST'), 'validation', /^We couldn't build a plan from these answers yet\.$/],
    [fail(502, 'INVALID_AI_OUTPUT', true), 'generation_failed', /trying again only takes a moment/],
  ];
  for (const [reply, code, copy] of cases) {
    const server = fakeServer({ generate: () => reply });
    const { client } = runtime(server);
    assert.equal((await client.plan.build({})).status, 'building');
    await flush();
    const state = await client.plan.getState();
    assert.equal(state.status, 'failed', code);
    assert.equal(state.failure_code, code);
    assert.match(state.failure_message ?? '', copy);
    assert.equal(server.generates().length, 1, 'no automatic retry');
  }
});

test('a calendar that cannot be read fails the build instead of sending no free time', async () => {
  const server = fakeServer();
  const calendarError = Object.assign(new Error('The calendar could not be read.'), { code: 'native-error' });
  const { client } = createRemoteRuntime(
    fakeDeps({ fetch: server.fetch, captureAvailability: () => Promise.reject(calendarError) }),
  );
  await assert.rejects(client.plan.build({}), (error) => isApiError(error, 'unknown'));
  const state = await client.plan.getState();
  assert.deepEqual([state.status, state.failure_code], ['failed', 'unknown']);
  assert.match(state.failure_message ?? '', /trying again only takes a moment/);
  assert.equal(server.generates().length, 0, 'nothing was sent');
});

test('Try again after a transport failure resends the same request, byte for byte', async () => {
  let attempts = 0;
  const server = fakeServer();
  const save = server.state.generate;
  server.state.generate = (body) => {
    attempts += 1;
    return attempts <= 3 ? { throws: new TypeError('Network request failed') } : save(body);
  };
  const { client } = runtime(server);
  await client.plan.build({});
  // The transport retries twice with a backoff before it gives up.
  for (let i = 0; i < 100 && (await client.plan.getState()).status === 'building'; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const failed = await client.plan.getState();
  assert.deepEqual([failed.status, failed.failure_code], ['failed', 'offline']);

  await client.plan.build({});
  await flush();
  assert.equal((await client.plan.getState()).status, 'ready');
  const sent = server.generates();
  assert.equal(sent.length, 4);
  assert.equal(new Set(sent.map((r) => r.raw)).size, 1, 'one request_id and one captured body for every attempt');
});

test('with a plan, the next week waits; a version conflict reloads and retries once with a new request', async () => {
  const { v1 } = revisedWeeks();
  const server = fakeServer({ versions: [v1] });
  const save = server.state.generate;
  let first = true;
  server.state.generate = (body) => {
    if (first) {
      first = false;
      // Another device changed the plan meanwhile.
      server.state.versions.push(version(2, WEEK_1, v1.plan.activities, 'revise'));
      server.state.activeId = uuid(202);
      return fail(409, 'VERSION_CONFLICT');
    }
    return save(body);
  };
  const { client } = runtime(server);
  await client.plan.getState();
  const state = await client.plan.build({ week_start: WEEK_2 });
  assert.deepEqual([state.status, state.active_version, state.planned_through], ['ready', 3, '2026-10-18']);
  const bodies = server.generates().map((r) => r.body as { request_id: string; expected_version: number; week_start: string });
  assert.deepEqual(
    bodies.map((b) => [b.expected_version, b.week_start]),
    [
      [1, WEEK_2],
      [2, WEEK_2],
    ],
  );
  assert.notEqual(bodies[0].request_id, bodies[1].request_id);
});

test('with a plan, a failed next week keeps the plan and leaves a note', async () => {
  const { v1 } = revisedWeeks();
  const server = fakeServer({ versions: [v1], generate: () => fail(501, 'AI_NOT_CONFIGURED') });
  const { client } = runtime(server);
  await assert.rejects(client.plan.build({ week_start: WEEK_2 }), (error) => isApiError(error, 'ai_unavailable'));
  const state = await client.plan.getState();
  assert.deepEqual([state.status, state.active_version, state.failure_code], ['ready', 1, null]);
  assert.equal(state.failure_message, "Next week isn't planned yet. Plan building isn't connected yet.");
});

test('plan history: sources, kept notes, the chat message and the version in use', async () => {
  const mon = activity(1, { start_at: at(5) });
  const wed = activity(2, { start_at: at(7) });
  const fri = activity(3, { start_at: at(9) });
  const v1 = version(1, WEEK_1, [mon, wed, fri]);
  const v2 = version(2, WEEK_1, [mon, wed, { ...fri, start_at: at(10) }], 'revise');
  const v3 = version(3, WEEK_1, [mon, wed], 'generate');
  const v4 = version(4, WEEK_2, [activity(4, { start_at: at(13) })]);
  const v5 = version(5, WEEK_1, [mon, wed, fri], 'undo');
  const server = fakeServer({
    versions: [v1, v2, v3, v4, v5],
    completions: [completion(1, mon, v1), completion(2, wed, v1)],
    messages: [message(1, { role: 'user', outcome: null }), message(2, { plan_version_id: v2.id })],
  });
  const { client } = runtime(server);
  const versions = await client.plan.listVersions();
  assert.deepEqual(
    versions.map((v) => [v.version, v.source, v.active]),
    [
      [5, 'undo', true],
      [4, 'weekly_plan', false],
      [3, 'answers', false],
      [2, 'chat', false],
      [1, 'first_plan', false],
    ],
  );
  assert.equal(versions[4].kept_note, 'Monday and Wednesday were done in this version.');
  assert.equal(versions[3].kept_note, null);
  assert.equal(versions[3].chat_message_id, uuid(502));
  assert.equal(versions[4].chat_message_id, null);
});

test('the Plan updated note shows the newest chat change until it is dismissed', async () => {
  const { v1 } = revisedWeeks();
  const v2 = version(2, WEEK_1, v1.plan.activities, 'revise');
  const storage = memoryStorage();
  const server = fakeServer({ versions: [v1, v2], messages: [message(1, { plan_version_id: v2.id })] });
  const { client, data } = runtime(server, storage);

  const shown = await client.plan.getState();
  assert.deepEqual(shown.recent_change, { summary: 'Change 1.', chat_message_id: uuid(501), created_at: '2026-10-06T01:00:00Z' });

  await client.plan.dismissRecentChange();
  assert.equal(storage.items.get(changeSeenKey(USER_ID)), '2026-10-06T01:00:00Z');
  assert.equal((await client.plan.getState()).recent_change, null);

  server.state.messages.push(message(2, { plan_version_id: v2.id }));
  data.invalidate('chat');
  assert.equal((await client.plan.getState()).recent_change?.chat_message_id, uuid(502));
});

test('without a dismissal on this device, an old change that is no longer in use does not show', async () => {
  const { v1, v3 } = revisedWeeks();
  const v2 = version(2, WEEK_1, v1.plan.activities, 'revise');
  const server = fakeServer({ versions: [v1, v2, v3], messages: [message(1, { plan_version_id: v2.id })] });
  assert.equal((await runtime(server).client.plan.getState()).recent_change, null);
});

test('the next week is planned from the last planned day, or the current week after a gap', () => {
  const ready = (planned_through: string | null): Pick<PlanState, 'status' | 'planned_through'> => ({
    status: 'ready',
    planned_through,
  });
  assert.equal(weekToPlanNext(ready('2026-10-11'), '2026-10-10'), null, 'Saturday: not yet');
  assert.equal(weekToPlanNext(ready('2026-10-11'), '2026-10-11'), WEEK_2, 'Sunday: the next Monday');
  assert.equal(weekToPlanNext(ready('2026-10-11'), '2026-10-12'), WEEK_2, 'Monday after: that week');
  assert.equal(weekToPlanNext(ready('2026-10-11'), '2026-10-21'), '2026-10-19', 'after a gap: the current week');
  assert.equal(weekToPlanNext({ status: 'building', planned_through: null }, '2026-10-11'), null);
  assert.equal(weekToPlanNext({ status: 'failed', planned_through: '2026-10-11' }, '2026-10-11'), null);
  assert.equal(weekToPlanNext(undefined, '2026-10-11'), null);
});
