import assert from 'node:assert/strict';
import { test } from 'node:test';

import { diffVersions, DETAILS_NOTE, KEPT_LINE } from '../../src/api/remote/chat/diff';
import { threadFromWire, type ThreadContext } from '../../src/api/remote/chat/thread';
import type { ChatMessageEntity, PlanVersionEntity } from '../../src/api/remote/wire';
import type { ChatMessage, PlanChange } from '../../src/api/types';
import { activity, PLAN_ID, USER_ID, uuid, version } from './fakes';

// Days and times are device-local; pin the zone the fixtures are written in.
process.env.TZ = 'Europe/Warsaw';

const toApp = (id: string) => ({ '1': 'walking', '3': 'running' })[id] ?? `sport-${id}`;
const WEEK = '2026-10-05';

const walk = (n: number, startAt: string, minutes = 20) =>
  activity(n, { start_at: startAt, duration_minutes: minutes, title: `Walk ${n}` });

/** Mon, Wed, Fri, Sat and Sun walks. */
const v1 = version(1, WEEK, [
  walk(1, '2026-10-05T07:00:00+02:00'),
  walk(2, '2026-10-07T07:00:00+02:00'),
  walk(3, '2026-10-09T18:00:00+02:00', 30),
  walk(4, '2026-10-10T09:00:00+02:00'),
  walk(5, '2026-10-11T10:00:00+02:00'),
]);

/** Moves 1, lengthens 2, swaps 3 for a run, removes 4, adds 6, and (wrongly) touches done 5. */
const v2 = version(
  2,
  WEEK,
  [
    walk(1, '2026-10-06T08:00:00+02:00'),
    walk(2, '2026-10-07T07:00:00+02:00', 30),
    activity(3, { sport_id: '3', title: 'Easy run', start_at: '2026-10-09T18:00:00+02:00', duration_minutes: 30 }),
    walk(5, '2026-10-11T10:00:00+02:00', 40),
    walk(6, '2026-10-11T09:00:00+02:00', 25),
  ],
  'revise',
);

test('the diff lists moved, changed, swapped, removed and added sessions in day order', () => {
  const diff = diffVersions(v1, v2, { toAppSportId: toApp, skip: new Set([uuid(105)]) });
  assert.deepEqual(
    diff.rows.map((row) => [row.kind, row.session_id, row.date, row.title, row.was_title, row.sport_id, row.diffs]),
    [
      [
        'moved',
        uuid(101),
        '2026-10-06',
        'Walk 1',
        null,
        'walking',
        [
          { field: 'date', from: '2026-10-05', to: '2026-10-06' },
          { field: 'time', from: '7:00', to: '8:00' },
        ],
      ],
      ['changed', uuid(102), '2026-10-07', 'Walk 2', null, 'walking', [{ field: 'duration', from: 1200, to: 1800 }]],
      ['swapped', uuid(103), '2026-10-09', 'Easy run', 'Walk 3', 'running', []],
      ['removed', uuid(104), '2026-10-10', 'Walk 4', null, 'walking', []],
      [
        'added',
        uuid(106),
        '2026-10-11',
        'Walk 6',
        null,
        'walking',
        [
          { field: 'time', from: null, to: '9:00' },
          { field: 'duration', from: null, to: 1500 },
        ],
      ],
    ],
  );
  assert.deepEqual(new Set(diff.changedIds), new Set([101, 102, 103, 104, 105, 106].map(uuid)), 'skipped rows still count');
  assert.equal(diff.sport_switch, null, 'not every session switched');
});

test('the same moment written with another offset is no change; new details get a note', () => {
  const before = version(1, WEEK, [walk(1, '2026-10-05T07:00:00+02:00')]);
  const same = version(2, WEEK, [walk(1, '2026-10-05T05:00:00Z')], 'revise');
  assert.deepEqual(diffVersions(before, same, { toAppSportId: toApp }).rows, []);

  const details = version(2, WEEK, [{ ...walk(1, '2026-10-05T07:00:00+02:00'), description: 'Hills this time.' }], 'revise');
  const [row] = diffVersions(before, details, { toAppSportId: toApp }).rows;
  assert.deepEqual([row.kind, row.diffs, row.note], ['changed', [], DETAILS_NOTE]);
});

test('switching every session to one sport adds the sport row', () => {
  const walks = version(1, WEEK, [walk(1, '2026-10-05T07:00:00+02:00'), walk(2, '2026-10-07T07:00:00+02:00')]);
  const runs = version(
    2,
    WEEK,
    [
      activity(1, { sport_id: '3', title: 'Run 1', start_at: '2026-10-05T07:00:00+02:00' }),
      activity(7, { sport_id: '3', title: 'Run 7', start_at: '2026-10-08T07:00:00+02:00' }),
    ],
    'revise',
  );
  const diff = diffVersions(walks, runs, { toAppSportId: toApp });
  assert.deepEqual(diff.sport_switch, { from: 'walking', to: 'running' });
  assert.deepEqual(
    diff.rows.map((row) => row.kind),
    ['swapped', 'removed', 'added'],
  );
});

/* ------------------------------------------------------- Thread rules */

function message(n: number, overrides: Partial<ChatMessageEntity>): ChatMessageEntity {
  return {
    id: uuid(500 + n),
    profile_id: USER_ID,
    plan_id: PLAN_ID,
    role: 'assistant',
    content: `Message ${n}.`,
    outcome: 'plan_updated',
    plan_version_id: null,
    created_at: `2026-10-07T1${n}:00:00Z`,
    request_id: uuid(600 + n),
    ...overrides,
  };
}

const change = (m: ChatMessage): PlanChange => {
  assert.equal(m.kind, 'change');
  return (m as Extract<ChatMessage, { kind: 'change' }>).change;
};

const base = version(1, WEEK, [walk(1, '2026-10-08T07:00:00+02:00'), walk(2, '2026-10-09T07:00:00+02:00')]);
const first = version(2, WEEK, [walk(1, '2026-10-08T09:00:00+02:00'), walk(2, '2026-10-09T07:00:00+02:00')], 'revise');
const second = version(3, WEEK, [walk(1, '2026-10-08T09:00:00+02:00'), walk(2, '2026-10-10T07:00:00+02:00')], 'revise');
const thread = [
  message(1, { role: 'user', outcome: null, content: 'Later on Thursday' }),
  message(2, { plan_version_id: first.id }),
  message(3, { role: 'user', outcome: null, content: 'Friday to Saturday' }),
  message(4, { plan_version_id: second.id }),
  message(5, { outcome: 'reply', content: 'Done.', plan_version_id: second.id }),
];

function context(overrides: Partial<ThreadContext> = {}): ThreadContext {
  return {
    versions: [base, first, second],
    activeVersionId: second.id,
    done: new Map(),
    about: {},
    toAppSportId: toApp,
    ...overrides,
  };
}

test('messages map to bubbles, replies and change cards; only the newest active change can be undone', () => {
  const ref = { session_id: uuid(101), date: '2026-10-08', title: 'Walk 1', sport_id: 'walking' };
  const messages = threadFromWire(thread, context({ about: { [uuid(601)]: ref } }));
  assert.deepEqual(
    messages.map((m) => [m.role, m.kind]),
    [
      ['user', 'text'],
      ['coach', 'change'],
      ['user', 'text'],
      ['coach', 'change'],
      ['coach', 'reply'],
    ],
  );
  assert.deepEqual(messages[0].kind === 'text' && messages[0].about, ref, 'the chip saved when sending');
  assert.equal(messages[2].kind === 'text' && messages[2].about, null);
  const reply = messages[4];
  assert.ok(reply.kind === 'reply');
  assert.deepEqual([reply.text, reply.quick_replies, reply.quiet_option, reply.foot], ['Done.', [], null, 'plan_unchanged']);

  const older = change(messages[1]);
  const newer = change(messages[3]);
  assert.deepEqual([older.from_version, older.to_version, older.can_undo, older.undone], [1, 2, false, false]);
  assert.deepEqual([newer.from_version, newer.to_version, newer.can_undo, newer.undone], [2, 3, true, false]);
  assert.equal(newer.summary, 'Message 4.');
  assert.deepEqual(newer.not_changed, []);
  assert.equal(newer.kept, '', 'nothing done that week');
  assert.deepEqual(
    newer.rows.map((row) => [row.kind, row.session_id]),
    [['moved', uuid(102)]],
  );
});

test('a done changed session locks Undo but keeps its row; sessions done before the change are never rows', () => {
  // Walk 2 logged against the change's own version: done after the change.
  const after = threadFromWire(thread, context({ done: new Map([[uuid(102), 3]]) }));
  const locked = change(after[3]);
  assert.equal(locked.can_undo, false);
  assert.equal(locked.rows.length, 1);
  assert.equal(locked.kept, KEPT_LINE);

  // A done session the change did not touch keeps Undo.
  const untouched = change(threadFromWire(thread, context({ done: new Map([[uuid(101), 3]]) }))[3]);
  assert.equal(untouched.can_undo, true);
  assert.equal(untouched.kept, KEPT_LINE);

  // Logged against an older version: done before the change, so no row.
  const before = change(threadFromWire(thread, context({ done: new Map([[uuid(102), 1]]) }))[3]);
  assert.deepEqual(before.rows, []);
  assert.equal(before.can_undo, false);
});

test('an undo after a change marks it undone; a later version makes it final', () => {
  const restored = version(4, WEEK, first.plan.activities, 'undo');
  const undone = threadFromWire(thread, context({ versions: [base, first, second, restored], activeVersionId: restored.id }));
  assert.deepEqual([change(undone[3]).undone, change(undone[3]).can_undo], [true, false]);
  assert.equal(change(undone[1]).undone, false);

  const nextWeek = version(4, '2026-10-12', [walk(9, '2026-10-12T07:00:00+02:00')]);
  const moved = threadFromWire(thread, context({ versions: [base, first, second, nextWeek], activeVersionId: nextWeek.id }));
  assert.deepEqual([change(moved[3]).undone, change(moved[3]).can_undo], [false, false]);
});

test('a change whose version is not loaded shows its summary only', () => {
  const lost = threadFromWire([message(2, { plan_version_id: uuid(999) })], context());
  assert.deepEqual(change(lost[0]), {
    from_version: 0,
    to_version: 0,
    summary: 'Message 2.',
    sport_switch: null,
    rows: [],
    not_changed: [],
    kept: '',
    can_undo: false,
    undone: false,
  });
});

test('the previous version is the same week, not just the number before', () => {
  const otherWeek: PlanVersionEntity = version(2, '2026-10-12', [walk(8, '2026-10-12T07:00:00+02:00')]);
  const revise = version(3, WEEK, [walk(1, '2026-10-08T10:00:00+02:00'), walk(2, '2026-10-09T07:00:00+02:00')], 'revise');
  const [card] = threadFromWire(
    [message(2, { plan_version_id: revise.id })],
    context({ versions: [base, otherWeek, revise], activeVersionId: revise.id }),
  );
  assert.equal(change(card).from_version, 1);
  assert.deepEqual(
    change(card).rows.map((row) => row.kind),
    ['changed'],
  );
});
