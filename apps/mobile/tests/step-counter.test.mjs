import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { test } from 'node:test';

import { createStepCounter } from '../src/features/steps/step-counter.ts';

process.env.TZ = 'Europe/Warsaw';

function setup(overrides = {}, now = () => new Date('2026-03-29T08:00:00Z')) {
  const calls = { requests: 0, reads: [] };
  const source = {
    name: 'health-connect',
    getUnavailableReason: async () => null,
    hasPermission: async () => true,
    requestPermission: async () => { calls.requests++; return false; },
    readSteps: async (start, end) => { calls.reads.push([start, end]); return 1234; },
    openSettings: async () => {},
    ...overrides,
  };
  return { counter: createStepCounter(source, now), calls };
}

test('reads the system total from local midnight, including a DST change, without accumulating it', async () => {
  const { counter, calls } = setup();
  counter.setActive(true);
  await counter.refresh();
  assert.equal(counter.getSnapshot().steps, 1234);
  assert.equal(counter.getSnapshot().date, '2026-03-29');
  assert.equal(calls.reads[0][0].toISOString(), '2026-03-28T23:00:00.000Z');
  assert.equal(calls.reads[0][1].toISOString(), '2026-03-29T08:00:00.000Z');
  await counter.refresh();
  assert.equal(counter.getSnapshot().steps, 1234);
  assert.equal(calls.requests, 0);
});

test('denial never reads data or repeatedly prompts on refresh; explicit retry can grant access', async () => {
  let granted = false;
  const { counter, calls } = setup({ hasPermission: async () => granted });
  counter.setActive(true);
  await counter.refresh();
  assert.equal(counter.getSnapshot().status, 'permission-required');
  assert.equal(counter.getSnapshot().steps, null);
  counter.setActive(false);
  counter.setActive(true);
  await counter.refresh();
  assert.equal(calls.requests, 1);
  assert.equal(calls.reads.length, 0);
  await counter.requestPermission();
  assert.equal(calls.requests, 2);
  granted = true;
  await counter.refresh();
  assert.equal(counter.getSnapshot().status, 'ready');
});

test('concurrent refreshes and foregrounding during a permission sheet share one request', async () => {
  let resolvePermission;
  let requests = 0;
  const { counter, calls } = setup({
    hasPermission: async () => false,
    requestPermission: () => {
      requests++;
      return new Promise((resolve) => { resolvePermission = resolve; });
    },
  });
  counter.setActive(true);
  const first = counter.refresh();
  await setImmediate();
  counter.setActive(false);
  counter.setActive(true);
  const second = counter.refresh();
  resolvePermission(true);
  await Promise.all([first, second]);
  assert.equal(requests, 1);
  assert.equal(calls.reads.length, 1);
  assert.equal(counter.getSnapshot().status, 'ready');
});

test('revoking access in Settings clears the previous count without prompting again', async () => {
  let granted = true;
  const { counter, calls } = setup({ hasPermission: async () => granted });
  counter.setActive(true);
  await counter.refresh();
  granted = false;
  counter.setActive(false);
  counter.setActive(true);
  await counter.refresh();
  assert.equal(counter.getSnapshot().status, 'permission-required');
  assert.equal(counter.getSnapshot().steps, null);
  assert.equal(calls.requests, 0);
});

test('no reads run while inactive; foregrounding fetches steps recorded while closed', async () => {
  let steps = 12;
  const { counter } = setup({ readSteps: async () => steps });
  await counter.refresh();
  assert.equal(counter.getSnapshot().status, 'idle');
  counter.setActive(true);
  await counter.refresh();
  counter.setActive(false);
  steps = 500;
  await counter.refresh();
  assert.equal(counter.getSnapshot().steps, 12);
  counter.setActive(true);
  await counter.refresh();
  assert.equal(counter.getSnapshot().steps, 500);
});

test('no read starts when a permission request finishes in the background', async () => {
  let resolvePermission;
  let granted = false;
  const { counter, calls } = setup({
    hasPermission: async () => granted,
    requestPermission: () => new Promise((resolve) => { resolvePermission = resolve; }),
  });
  counter.setActive(true);
  const pending = counter.refresh();
  await setImmediate();
  counter.setActive(false);
  granted = true;
  resolvePermission(true);
  await pending;
  assert.equal(calls.reads.length, 0);
  counter.setActive(true);
  await counter.refresh();
  assert.equal(calls.reads.length, 1);
});

test('unavailable devices and Expo Go return a reason without requesting permissions', async () => {
  const { counter, calls } = setup({ getUnavailableReason: async () => 'Native build required.' });
  counter.setActive(true);
  await counter.refresh();
  assert.equal(counter.getSnapshot().status, 'unavailable');
  assert.equal(counter.getSnapshot().message, 'Native build required.');
  assert.equal(counter.getSnapshot().steps, null);
  assert.equal(calls.requests, 0);
  assert.equal(calls.reads.length, 0);
});

test('native failures are observable and can be retried without a fabricated zero', async () => {
  let fail = true;
  const { counter } = setup({ readSteps: async () => {
    if (fail) throw new Error('Native read failed');
    return 0;
  } });
  counter.setActive(true);
  await counter.refresh();
  assert.equal(counter.getSnapshot().status, 'error');
  assert.equal(counter.getSnapshot().steps, null);
  fail = false;
  await counter.refresh();
  assert.equal(counter.getSnapshot().status, 'ready');
  assert.equal(counter.getSnapshot().steps, 0);
});

test('a new day clears the old total while refreshing and replaces it with the new total', async () => {
  let date = new Date('2026-10-03T21:59:00Z');
  let steps = 9000;
  const { counter, calls } = setup({ readSteps: async (start, end) => {
    calls.reads.push([start, end]);
    return steps;
  } }, () => date);
  counter.setActive(true);
  await counter.refresh();
  assert.equal(counter.getSnapshot().steps, 9000);
  date = new Date('2026-10-03T22:01:00Z');
  steps = 7;
  const pending = counter.refresh();
  assert.equal(counter.getSnapshot().steps, null);
  await pending;
  assert.equal(counter.getSnapshot().steps, 7);
  assert.equal(counter.getSnapshot().date, '2026-10-04');
  assert.equal(calls.reads.at(-1)[0].toISOString(), '2026-10-03T22:00:00.000Z');
});

test('a response crossing midnight is not published as the current day', async () => {
  let date = new Date('2026-10-03T21:59:00Z');
  const { counter } = setup({ readSteps: async () => {
    date = new Date('2026-10-03T22:01:00Z');
    return 9000;
  } }, () => date);
  counter.setActive(true);
  await counter.refresh();
  assert.equal(counter.getSnapshot().steps, null);
  assert.equal(counter.getSnapshot().date, '2026-10-04');
  await counter.refresh();
  assert.equal(counter.getSnapshot().status, 'ready');
});
