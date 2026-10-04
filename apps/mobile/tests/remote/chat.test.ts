import assert from 'node:assert/strict';
import { test } from 'node:test';

import { aboutStorageKey } from '../../src/api/remote/chat/about';
import { createRemoteChat } from '../../src/api/remote/chat';
import type { RemoteContext } from '../../src/api/remote/context';
import { createRemoteData } from '../../src/api/remote/data';
import { createDraftStore } from '../../src/api/remote/drafts';
import { createProductApi, serverErrorCode } from '../../src/api/remote/http';
import type {
  ActivePlanDto,
  ActivityCompletionEntity,
  ChatMessageEntity,
  PlanVersionEntity,
  ProfileEntity,
  SendChatDto,
  UndoPlanDto,
} from '../../src/api/remote/wire';
import { isApiError } from '../../src/api/types';
import {
  activity,
  completion,
  fail,
  fakeDeps,
  memoryStorage,
  ok,
  PLAN_ID,
  scriptedFetch,
  SPORTS,
  USER_ID,
  uuid,
  version,
  type Call,
  type Reply,
} from './fakes';

process.env.TZ = 'Europe/Warsaw';

const WEEK = '2026-10-05';
const LAST_WEEK = '2026-09-28';
const v1 = version(1, LAST_WEEK, [activity(1, { start_at: '2026-09-29T07:00:00+02:00' })]);
const v2 = version(2, WEEK, [
  activity(2, { start_at: '2026-10-08T07:00:00+02:00' }),
  activity(3, { start_at: '2026-10-10T09:00:00+02:00' }),
]);
const v3 = version(
  3,
  WEEK,
  [activity(2, { start_at: '2026-10-08T07:00:00+02:00' }), activity(3, { start_at: '2026-10-11T09:00:00+02:00' })],
  'revise',
);

const active = (v: PlanVersionEntity): ActivePlanDto => ({
  plan: { id: PLAN_ID, profile_id: USER_ID, active_version_id: v.id, created_at: '2026-09-28T08:00:00Z' },
  version: v,
});

const PROFILE: ProfileEntity = {
  id: USER_ID,
  username: null,
  created_at: '2026-09-28T08:00:00Z',
  preferences: {
    starting_comfort: 'starting_out',
    sessions_per_week: 3,
    session_minutes: 20,
    preferred_window: { start_hour: 8, end_hour: 20 },
    activity_interests: ['1'],
    discovery_preference: 'selected_only',
    available_locations: ['outdoors'],
    available_equipment: [],
    avoidances: [],
    starting_obstacles: [],
    excluded_activity_types: [],
    timezone: 'Europe/Warsaw',
  },
};

const chatMessage = (n: number, overrides: Partial<ChatMessageEntity>): ChatMessageEntity => ({
  id: uuid(500 + n),
  profile_id: USER_ID,
  plan_id: PLAN_ID,
  role: 'user',
  content: `Message ${n}`,
  outcome: null,
  plan_version_id: null,
  created_at: `2026-10-07T1${n}:00:00Z`,
  request_id: uuid(600 + n),
  ...overrides,
});

interface Server {
  current: ActivePlanDto | null;
  history: PlanVersionEntity[];
  completions: ActivityCompletionEntity[];
  chat: ChatMessageEntity[];
  /** POST /chat and /plans/undo answers. */
  post?: (path: string, body: unknown) => Reply;
}

function setup(server: Server) {
  const clock = { now: new Date('2026-10-07T12:00:00Z') };
  const storage = memoryStorage();
  const path = (call: Call) => new URL(call.url).pathname.replace('/functions/v1/product-api', '');
  const fetch = scriptedFetch((call) => {
    const p = path(call);
    if (call.init.method === 'POST') return server.post?.(p, JSON.parse(call.init.body ?? 'null')) ?? fail(404, 'NOT_FOUND');
    const offset = Number(new URL(call.url).searchParams.get('offset') ?? 0);
    if (p === '/plans/current') return ok(server.current);
    if (p === '/plans/history') return ok(server.history.slice(offset, offset + 100));
    if (p === '/completions') return ok(server.completions.slice(offset, offset + 100));
    if (p === '/chat/messages') return ok(server.chat.slice(offset, offset + 100));
    if (p === '/profile') return ok(PROFILE);
    if (p === '/sports') return ok(SPORTS);
    return fail(404, 'NOT_FOUND');
  });
  const deps = fakeDeps({ fetch: fetch.fetch, storage, now: () => clock.now });
  const http = createProductApi({
    fetch: fetch.fetch,
    baseUrl: deps.productApiUrl,
    publishableKey: deps.publishableKey,
    getAccessToken: async () => 'token-1',
    sleep: async () => undefined,
  });
  const data = createRemoteData(http, deps);
  const ctx: RemoteContext = { http, data, deps, drafts: createDraftStore(storage, data.userId) };
  const posts = (p: string) => fetch.calls.filter((call) => call.init.method === 'POST' && path(call) === p);
  return { chat: createRemoteChat(ctx), data, fetch, posts, clock, storage };
}

/** A server that saves a chat turn: a reply, or a change to `revised`. */
function turn(server: Server, request: SendChatDto, revised?: PlanVersionEntity): Reply {
  const n = server.chat.length;
  const user = chatMessage(n, { content: request.message, request_id: request.request_id });
  const coach = chatMessage(n + 1, {
    role: 'assistant',
    content: revised ? 'Saturday is Sunday now.' : 'Here is why.',
    outcome: revised ? 'plan_updated' : 'reply',
    plan_version_id: revised?.id ?? server.current?.version.id ?? null,
    request_id: request.request_id,
  });
  server.chat.push(user, coach);
  if (revised) {
    server.history.unshift(revised);
    server.current = active(revised);
    return ok({ outcome: 'plan_updated', active_plan: server.current, messages: [user, coach] });
  }
  return ok({ outcome: 'reply', active_plan: null, messages: [user, coach] });
}

test('without a plan the thread is empty and sending is a conflict', async () => {
  const server: Server = { current: null, history: [], completions: [], chat: [] };
  const { chat, fetch, posts } = setup(server);
  assert.deepEqual(await chat.listMessages(), []);
  assert.ok(!fetch.calls.some((call) => call.url.includes('/chat/messages')));
  await assert.rejects(chat.send({ text: 'Hi', about_session_id: null, base_version: null }), (error) =>
    isApiError(error, 'conflict'),
  );
  assert.equal(posts('/chat').length, 0);
});

test('the thread maps replies and change cards; replies skip the plan history', async () => {
  const server: Server = {
    current: active(v3),
    history: [v3, v2, v1],
    completions: [],
    chat: [
      chatMessage(1, { content: 'Why walking?' }),
      chatMessage(2, { role: 'assistant', outcome: 'reply', content: 'It is gentle.', plan_version_id: v2.id }),
    ],
  };
  const { chat, fetch } = setup(server);
  const replies = await chat.listMessages();
  assert.deepEqual(
    replies.map((m) => m.kind),
    ['text', 'reply'],
  );
  assert.ok(!fetch.calls.some((call) => call.url.includes('/plans/history')), 'no change cards, no history');

  server.chat.push(
    chatMessage(3, { content: 'Saturday to Sunday' }),
    chatMessage(4, { role: 'assistant', outcome: 'plan_updated', content: 'Moved.', plan_version_id: v3.id }),
  );
  const { chat: fresh } = setup(server);
  const card = (await fresh.listMessages())[3];
  assert.ok(card.kind === 'change');
  assert.deepEqual(
    [card.change.from_version, card.change.to_version, card.change.can_undo, card.change.rows.map((r) => r.kind)],
    [2, 3, true, ['moved']],
  );
});

test('send posts the active version, free time from now in the active week, and only an active session', async () => {
  const server: Server = { current: active(v2), history: [v2, v1], completions: [], chat: [] };
  let sent: SendChatDto | null = null;
  // The first message changes the plan; later ones get a reply.
  let revise: PlanVersionEntity | undefined = v3;
  server.post = (p, body) => {
    sent = body as SendChatDto;
    const reply = turn(server, sent, revise);
    revise = undefined;
    return reply;
  };
  const { chat, data } = setup(server);

  const result = await chat.send({
    text: '  Saturday to Sunday ',
    about_session_id: uuid(103),
    base_version: null,
    request_id: uuid(700),
  });
  assert.ok(sent);
  const body = sent as SendChatDto;
  assert.equal(body.request_id, uuid(700));
  assert.equal(body.plan_id, PLAN_ID);
  assert.equal(body.expected_version, 2);
  assert.equal(body.message, 'Saturday to Sunday');
  assert.equal(body.activity_id, uuid(103));
  assert.equal(body.availability.source, 'manual');
  // Wednesday 14:00 local, inside the 8–20 window, through Sunday.
  assert.equal(body.availability.slots[0].start_at, '2026-10-07T14:00:00+02:00');
  assert.equal(body.availability.slots.at(-1)?.end_at, '2026-10-11T20:00:00+02:00');
  assert.equal(body.availability.slots.length, 5);

  assert.equal(result.plan_changed, true);
  assert.equal(result.active_version, 3);
  assert.deepEqual(
    result.messages.map((m) => m.kind),
    ['text', 'change'],
  );
  const [user, card] = result.messages;
  assert.ok(user.kind === 'text' && card.kind === 'change');
  assert.deepEqual(user.about, { session_id: uuid(103), date: '2026-10-10', title: 'Easy walk 3', sport_id: 'walking' });
  assert.equal(card.change.can_undo, true);
  assert.equal((await data.currentPlan())?.version.version, 3, 'the new plan is stored');

  // A session outside the active version is not sent, but its chip is kept.
  const reply = await chat.send({ text: 'Why did I miss it?', about_session_id: uuid(101), base_version: 3 });
  assert.equal((sent as SendChatDto).activity_id, undefined);
  assert.equal(reply.plan_changed, false);
  assert.equal(reply.active_version, 3);
  const thread = await chat.listMessages();
  const asked = thread.find((m) => m.kind === 'text' && m.text === 'Why did I miss it?');
  assert.ok(asked?.kind === 'text');
  assert.equal(asked.about?.session_id, uuid(101));
});

test('a retry with the same request_id resends the identical body, even later', async () => {
  const server: Server = { current: active(v2), history: [v2, v1], completions: [], chat: [] };
  let online = false;
  server.post = (p, body) => (online ? turn(server, body as SendChatDto) : { throws: new TypeError('Network request failed') });
  const { chat, posts, clock, storage } = setup(server);

  const input = { text: 'Why walking?', about_session_id: uuid(102), base_version: null, request_id: uuid(701) };
  await assert.rejects(chat.send(input), (error) => isApiError(error, 'offline'));
  assert.equal(posts('/chat').length, 3, 'two transport retries inside one send');

  clock.now = new Date('2026-10-07T12:30:00Z');
  online = true;
  await chat.send(input);
  const bodies = new Set(posts('/chat').map((call) => call.init.body));
  assert.equal(bodies.size, 1, 'same request_id, same captured availability');
  assert.equal(Object.keys(JSON.parse((await storage.getItem(aboutStorageKey(USER_ID))) ?? '{}')).length, 1);

  // A new action gets a new ID and a fresh capture.
  await chat.send({ text: 'Why walking?', about_session_id: null, base_version: null });
  const last = JSON.parse(posts('/chat').at(-1)?.init.body ?? '{}') as SendChatDto;
  assert.notEqual(last.request_id, uuid(701));
  assert.equal(last.availability.captured_at, '2026-10-07T14:30:00+02:00');
});

test('send maps a stale version and a missing AI provider, and retries neither', async () => {
  const server: Server = { current: active(v2), history: [v2, v1], completions: [], chat: [] };
  const replies: Reply[] = [fail(409, 'VERSION_CONFLICT'), fail(501, 'AI_NOT_CONFIGURED')];
  server.post = () => replies.shift() ?? fail(500, 'INTERNAL_ERROR');
  const { chat, posts, fetch } = setup(server);

  await assert.rejects(chat.send({ text: 'Shorter', about_session_id: null, base_version: 1 }), (error) => {
    assert.ok(isApiError(error, 'stale_version'));
    assert.equal(error.retryable, false);
    return true;
  });
  assert.equal((JSON.parse(posts('/chat')[0].init.body ?? '{}') as SendChatDto).expected_version, 1);
  const currentReads = fetch.calls.filter((call) => call.url.includes('/plans/current')).length;
  await assert.rejects(chat.send({ text: 'Shorter', about_session_id: null, base_version: null }), (error) => {
    assert.ok(isApiError(error, 'ai_unavailable'));
    assert.equal(error.retryable, false);
    return true;
  });
  assert.equal(posts('/chat').length, 2);
  assert.ok(
    fetch.calls.filter((call) => call.url.includes('/plans/current')).length > currentReads,
    'a stale version reloads the plan',
  );
});

test('undo restores through POST /plans/undo for the active change only', async () => {
  const change = chatMessage(2, { role: 'assistant', outcome: 'plan_updated', plan_version_id: v3.id });
  const older = chatMessage(1, { role: 'assistant', outcome: 'plan_updated', plan_version_id: v2.id });
  const server: Server = { current: active(v3), history: [v3, v2, v1], completions: [], chat: [older, change] };
  const v4 = version(4, WEEK, v2.plan.activities, 'undo');
  server.post = (p, body) => {
    if (p !== '/plans/undo') return fail(404, 'NOT_FOUND');
    server.history.unshift(v4);
    server.current = active(v4);
    assert.equal((body as UndoPlanDto).expected_version, 3);
    return ok(server.current);
  };
  const { chat, posts } = setup(server);

  await assert.rejects(chat.undo(older.id), (error) => isApiError(error, 'conflict'));
  await assert.rejects(chat.undo(uuid(999)), (error) => isApiError(error, 'not_found'));
  assert.equal(posts('/plans/undo').length, 0);

  assert.deepEqual(await chat.undo(change.id), { messages: [], plan_changed: true, active_version: 4 });
  const body = JSON.parse(posts('/plans/undo')[0].init.body ?? '{}') as UndoPlanDto;
  assert.equal(body.plan_id, PLAN_ID);
  assert.ok(body.request_id && body.request_id !== change.request_id);

  const card = (await chat.listMessages()).find((m) => m.id === change.id);
  assert.ok(card?.kind === 'change');
  assert.deepEqual([card.change.undone, card.change.can_undo], [true, false]);
});

test('undo maps NOTHING_TO_UNDO and UNDO_LOCKED to conflicts with clear copy', async () => {
  const change = chatMessage(2, { role: 'assistant', outcome: 'plan_updated', plan_version_id: v3.id });
  const server: Server = {
    current: active(v3),
    history: [v3, v2, v1],
    completions: [completion(1, v3.plan.activities[1], v3)],
    chat: [change],
  };
  const replies: Reply[] = [fail(409, 'NOTHING_TO_UNDO'), fail(409, 'UNDO_LOCKED')];
  server.post = () => replies.shift() ?? fail(500, 'INTERNAL_ERROR');
  const { chat } = setup(server);

  const card = (await chat.listMessages())[0];
  assert.ok(card.kind === 'change');
  assert.equal(card.change.can_undo, false, 'a changed session is done');

  await assert.rejects(chat.undo(change.id), (error) => {
    assert.ok(isApiError(error, 'conflict'));
    assert.equal(error.message, 'This change can no longer be undone.');
    assert.equal(serverErrorCode(error), 'NOTHING_TO_UNDO');
    return true;
  });
  await assert.rejects(chat.undo(change.id), (error) => {
    assert.ok(isApiError(error, 'conflict'));
    assert.match(error.message, /already done/);
    return true;
  });
});
