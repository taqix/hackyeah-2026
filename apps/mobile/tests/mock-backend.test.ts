import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createBackend, dailyFreeSlots, WRONG_PASSWORD } from '../src/api/mock/backend';
import { SPORTS } from '../src/api/mock/catalog';
import { emptyDb, nextId, type MockDb } from '../src/api/mock/model';
import { generatePlanWeek } from '../src/api/mock/planner';
import { DEMO_EMAIL, seedDb } from '../src/api/mock/seed';
import { isApiError, type ChatMessage, type PlannedSession } from '../src/api/types';
import { addDays, diffDays, formatTime, startOfWeek, toLocalDate } from '../src/lib/dates';
import { SAMPLE_PREFS } from '../src/lib/preference-options';
import {
  isOutsidePreferredWindow,
  sessionLocalDate,
  sessionMinutes,
  sessionStart,
  weekProgress,
} from '../src/lib/sessions';

/** Wednesday 7 October 2026, 20:00 device time: Ana's chat evening. */
const WEDNESDAY_EVENING = new Date(2026, 9, 7, 20, 0);

function setup(now = WEDNESDAY_EVENING) {
  const db: MockDb = seedDb(now);
  const clock = { now };
  const backend = createBackend({ db: () => db, now: () => clock.now, wallMs: () => clock.now.getTime() });
  backend.auth.signInWithEmail(DEMO_EMAIL, 'any-password');
  return { db, backend, clock };
}

const sendText = (backend: ReturnType<typeof setup>['backend'], text: string, about: string | null = null) =>
  backend.chat.send({ text, about_session_id: about, base_version: backend.plan.getState().active_version });

test('the planner spreads sessions_per_week sessions inside the preferred window', () => {
  const db = emptyDb();
  const monday = '2026-10-12';
  const sessions = generatePlanWeek(
    SAMPLE_PREFS,
    SPORTS,
    { from: monday, to: addDays(monday, 6), version: 1, newId: () => nextId(db, 's') },
    null,
    [],
  );
  assert.equal(sessions.length, SAMPLE_PREFS.sessions_per_week);
  const days = sessions.map(sessionLocalDate);
  assert.equal(new Set(days).size, days.length, 'one session a day');
  for (let i = 1; i < days.length; i += 1) assert.ok(diffDays(days[i - 1], days[i]) >= 2, 'rest days between');
  for (const s of sessions) {
    assert.equal(sessionMinutes(s), SAMPLE_PREFS.session_minutes);
    assert.equal(formatTime(sessionStart(s)), '7:00');
    assert.equal(isOutsidePreferredWindow(s, SAMPLE_PREFS), false);
    assert.ok(['walking', 'running'].includes(s.sport_id));
    assert.ok(!('exercises' in s) || s.exercises.every((e) => !('weight_kg' in e)));
  }
});

test('the planner uses free time, and goes outside the window when the window is busy', () => {
  const db = emptyDb();
  const monday = '2026-10-12';
  const evenings = dailyFreeSlots(monday, 7, 17, 21);
  const sessions = generatePlanWeek(
    SAMPLE_PREFS,
    SPORTS,
    { from: monday, to: addDays(monday, 6), version: 1, newId: () => nextId(db, 's') },
    evenings,
    [],
  );
  assert.equal(sessions.length, 3);
  for (const s of sessions) {
    assert.equal(formatTime(sessionStart(s)), '17:00');
    assert.equal(isOutsidePreferredWindow(s, SAMPLE_PREFS), true);
  }
});

test('the seed tells Ana story relative to the current week', () => {
  const { backend } = setup();
  const state = backend.plan.getState();
  assert.equal(state.status, 'ready');
  assert.equal(state.active_version, 4);
  const week = backend.plan.getWeek(startOfWeek(WEDNESDAY_EVENING));
  assert.equal(week.planned, true);
  const today = toLocalDate(WEDNESDAY_EVENING);
  for (const s of week.sessions) {
    if (sessionLocalDate(s) < today) assert.equal(s.status, 'completed');
    else assert.equal(s.status, 'planned');
  }
  assert.ok(week.sessions.some((s) => sessionLocalDate(s) === today), 'a session today');
  assert.deepEqual(weekProgress(week), { done: 1, total: 3 });
  assert.equal(backend.plan.listVersions().length, 4);
});

test('a wrong password and a short sign-up password are rejected', () => {
  const { backend } = setup();
  assert.throws(() => backend.auth.signInWithEmail(DEMO_EMAIL, WRONG_PASSWORD), (e) => isApiError(e, 'invalid_credentials'));
  assert.throws(() => backend.auth.signUpWithEmail('new@example.com', 'short', 'Ola'), (e) => isApiError(e, 'weak_password'));
  assert.equal(backend.auth.lookupEmail('NEW@example.com ').exists, false);
});

test('sign-up keeps the trimmed name for the greeting, and Settings can change it', () => {
  const db = emptyDb();
  const backend = createBackend({ db: () => db, now: () => WEDNESDAY_EVENING });
  for (const name of ['', '   ', 'x'.repeat(51)]) {
    assert.throws(() => backend.auth.signUpWithEmail('new@example.com', 'long enough', name), (e) => isApiError(e, 'validation'));
  }
  assert.equal(db.accounts.length, 0, 'nothing is created without a name');

  assert.equal(backend.auth.signUpWithEmail('new@example.com', 'long enough', '  Ola  ').user.name, 'Ola');
  assert.equal(backend.auth.getSession()?.user.name, 'Ola');
  assert.equal(backend.account.updateName(' Aleksandra '), 'Aleksandra');
  assert.equal(backend.account.get().user.name, 'Aleksandra');
  assert.equal(backend.auth.getSession()?.user.name, 'Aleksandra');
  assert.throws(() => backend.account.updateName(' '), (e) => isApiError(e, 'validation'));
  assert.equal(backend.account.get().user.name, 'Aleksandra');
});

test('"Make Friday shorter" changes its length, and Undo restores it', () => {
  const { backend } = setup();
  const friday = addDays(startOfWeek(WEDNESDAY_EVENING), 4);
  const before = backend.plan.getWeek(startOfWeek(WEDNESDAY_EVENING)).sessions.find((s) => sessionLocalDate(s) === friday);
  assert.ok(before, 'Friday has a session');
  assert.equal(sessionMinutes(before), 20);

  const turn = sendText(backend, 'Make Friday shorter');
  assert.equal(turn.plan_changed, true);
  const card = turn.messages[1] as Extract<ChatMessage, { kind: 'change' }>;
  assert.equal(card.kind, 'change');
  const row = card.change.rows.find((r) => r.session_id === before.id);
  assert.ok(row, 'a row for Friday');
  assert.deepEqual(
    row.diffs.find((d) => d.field === 'duration'),
    { field: 'duration', from: 1200, to: 600 },
  );
  assert.equal(row.note, 'Three runs instead of six.');
  assert.equal(card.change.summary, 'Friday is 10 minutes now.');
  assert.equal(card.change.kept, 'Monday and Tuesday stay as you did them.');
  const changed = backend.plan.getSession(before.id);
  assert.equal(sessionMinutes(changed), 10);
  assert.equal(changed.changed_in_version, card.change.to_version);
  assert.equal(backend.plan.getState().recent_change?.chat_message_id, card.id);

  const undo = backend.chat.undo(card.id);
  assert.equal(undo.plan_changed, true);
  const restored: PlannedSession = backend.plan.getSession(before.id);
  assert.equal(sessionMinutes(restored), 20);
  const versions = backend.plan.listVersions();
  assert.equal(versions[0].source, 'undo');
  assert.equal(versions[0].active, true);
  assert.throws(() => backend.chat.undo(card.id), (e) => isApiError(e, 'conflict'));
});

test('mornings for everything and a shorter Friday read like the design', () => {
  const { backend } = setup(new Date(2026, 9, 7, 20, 0));
  const friday = backend.plan
    .listSessions({ from: '2026-10-09', to: '2026-10-09' })
    .sessions.find((s) => s.status === 'planned');
  assert.ok(friday);
  backend.plan.dismissRecentChange();
  const evening = sendText(backend, 'Move Friday to the evening');
  assert.equal(evening.messages[1].kind, 'change');
  const turn = sendText(backend, 'Can we keep everything to mornings this week, and make Friday shorter?');
  const card = turn.messages[1] as Extract<ChatMessage, { kind: 'change' }>;
  assert.equal(card.change.summary, 'All your sessions are at 7:00 now, and Friday is 10 minutes.');
  const messages = backend.chat.listMessages();
  const older = messages.find((m) => m.id === evening.messages[1].id) as Extract<ChatMessage, { kind: 'change' }>;
  assert.equal(older.change.can_undo, false, 'only the newest card keeps Undo');
});

test('a workout sentence logs an extra that never counts toward the week', () => {
  const { backend } = setup();
  const weekStart = startOfWeek(WEDNESDAY_EVENING);
  const progressBefore = weekProgress(backend.plan.getWeek(weekStart));

  const ask = sendText(backend, 'I ran 3 km');
  const question = ask.messages[1];
  assert.equal(question.kind, 'reply');
  if (question.kind === 'reply') assert.equal(question.foot, 'nothing_saved');

  const turn = sendText(backend, '30 min');
  const logged = turn.messages[1];
  assert.equal(logged.kind, 'workout_logged');
  if (logged.kind !== 'workout_logged') return;
  assert.equal(logged.log.extra, true);
  assert.equal(logged.log.source, 'chat');
  assert.equal(logged.log.sport_id, 'running');
  assert.equal(logged.log.duration_seconds, 1800);
  assert.equal(logged.log.metrics.distance, 3);
  assert.equal(turn.plan_changed, false);

  const football = sendText(backend, 'I played football yesterday for an hour').messages[1];
  assert.equal(football.kind, 'workout_logged');
  if (football.kind === 'workout_logged') {
    assert.equal(toLocalDate(football.log.started_at), addDays(toLocalDate(WEDNESDAY_EVENING), -1));
  }

  const week = backend.plan.getWeek(weekStart);
  assert.equal(week.extras.length, 2);
  assert.deepEqual(weekProgress(week), progressBefore);

  backend.chat.undo(football.id);
  assert.equal(backend.plan.getWeek(weekStart).extras.length, 1);
});

test('the coach refuses done days, health questions and sports outside the catalog', () => {
  const { backend } = setup();
  const done = sendText(backend, 'Can Monday be a run instead?').messages[1];
  assert.equal(done.kind, 'reply');
  if (done.kind === 'reply') assert.match(done.text, /^Monday is done, so it stays as you did it\./);
  const health = sendText(backend, 'My knee hurts after running').messages[1];
  assert.equal(health.kind, 'reply');
  if (health.kind === 'reply') assert.match(health.text, /^Sorry about your knee\./);
  const other = sendText(backend, 'Could I try kitesurfing?').messages[1];
  assert.equal(other.kind, 'reply');
  assert.throws(() => sendText(backend, 'please fail'), (e) => isApiError(e, 'generation_failed'));
  assert.equal(sendText(backend, 'please fail').messages[1].kind, 'reply', 'a resend goes through');
});

test('a sport switch swaps upcoming sessions only', () => {
  const { backend } = setup();
  const card = sendText(backend, 'Can I try the gym instead?').messages[1];
  assert.equal(card.kind, 'change');
  if (card.kind !== 'change') return;
  assert.equal(card.change.sport_switch?.to, 'strength');
  assert.equal(card.change.rows.length, 2, 'today and Friday; Monday and Tuesday are done');
  for (const row of card.change.rows) {
    assert.equal(row.kind, 'swapped');
    const s = backend.plan.getSession(row.session_id);
    assert.ok('exercises' in s && s.exercises.length > 0);
  }
});

test('the first plan builds in about three seconds, or fails and keeps the answers', () => {
  const db = emptyDb();
  const clock = { now: new Date(2026, 9, 5, 6, 30) };
  const backend = createBackend({ db: () => db, now: () => clock.now, wallMs: () => clock.now.getTime() });
  backend.auth.signUpWithEmail('new@example.com', 'long enough', 'Ola');
  backend.preferences.save(SAMPLE_PREFS);
  assert.equal(backend.plan.build(null, true).status, 'building');
  clock.now = new Date(clock.now.getTime() + 3_500);
  const failed = backend.plan.getState();
  assert.equal(failed.status, 'failed');
  assert.ok(backend.preferences.get());
  assert.equal(backend.plan.listSessions({ from: '2026-10-01', to: '2026-10-31' }).sessions.length, 0);

  backend.plan.build();
  clock.now = new Date(clock.now.getTime() + 3_500);
  const ready = backend.plan.getState();
  assert.equal(ready.status, 'ready');
  assert.equal(ready.first_week_start, '2026-10-05');
  assert.equal(ready.planned_through, '2026-10-11');
  const sessions = backend.plan.listSessions({ from: '2026-10-05', to: '2026-10-11' }).sessions;
  assert.equal(sessions.length, 3);
  assert.equal(backend.plan.listVersions()[0].source, 'first_plan');
});
