import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  createDebugLogger,
  debugError,
  debugLog,
  debugLogsEnabled,
  debugWarn,
  describeError,
  errorLabel,
  formatDuration,
  maskEmail,
  sanitizeDetails,
  shortId,
  shortenIds,
  startTimer,
  summarizeBody,
  summarizeData,
  summarizeQuery,
  type DebugDetails,
  type DebugLevel,
} from '../../src/lib/debug-log';
import { createProductApi, errorFromResponse } from '../../src/api/remote/http';
import { ApiError } from '../../src/api/types';
import { ok, scriptedFetch } from './fakes';

const REQUEST_ID = '1a2b3c4d-1111-4222-8333-444455556666';
const PLAN_ID = '9f8e7d6c-aaaa-4bbb-8ccc-dddddddddddd';
const TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.signature';

/** Every console write during `run`. */
async function consoleWrites(run: () => Promise<void> | void): Promise<unknown[][]> {
  const writes: unknown[][] = [];
  const saved = { log: console.log, warn: console.warn, error: console.error, info: console.info };
  const capture = (...args: unknown[]) => {
    writes.push(args);
  };
  console.log = capture;
  console.warn = capture;
  console.error = capture;
  console.info = capture;
  try {
    await run();
  } finally {
    Object.assign(console, saved);
  }
  return writes;
}

function recordingLogger() {
  const lines: { level: DebugLevel; line: string; details?: DebugDetails }[] = [];
  let clock = 1_000;
  const logger = createDebugLogger({
    enabled: true,
    sink: (level, line, details) => lines.push({ level, line, details }),
    now: () => clock,
  });
  return { logger, lines, advance: (ms: number) => (clock += ms) };
}

test('is off and silent without __DEV__ (Node, release builds)', async () => {
  assert.equal(typeof (globalThis as { __DEV__?: unknown }).__DEV__, 'undefined');
  assert.equal(debugLogsEnabled, false);
  const writes = await consoleWrites(async () => {
    debugLog('http', `→ POST /chat rid=${REQUEST_ID}`, { message: 'secret text' });
    debugWarn('auth', 'warn');
    debugError('app', 'error');
    assert.equal(startTimer()(), '');
    // The transport logs nothing either.
    const fetch = scriptedFetch([ok({ id: 'x' })]);
    const api = createProductApi({
      fetch: fetch.fetch,
      baseUrl: 'https://example.supabase.co/functions/v1/product-api',
      publishableKey: 'sb_publishable_test',
      getAccessToken: async () => TOKEN,
      sleep: async () => undefined,
    });
    await api.post('/chat', { request_id: REQUEST_ID, message: 'hello' });
  });
  assert.deepEqual(writes, []);
});

test('a disabled logger never builds its details', () => {
  const logger = createDebugLogger({ enabled: false, sink: () => assert.fail('wrote while disabled') });
  logger.log('http', 'line', () => assert.fail('built details while disabled'));
  assert.equal(logger.enabled, false);
});

test('formats one line per event with the [movo:scope] prefix and a duration', () => {
  const { logger, lines, advance } = recordingLogger();
  const took = logger.startTimer();
  advance(812);
  logger.log('http', `← 200 POST /plans/generate ${took()} rid=${shortId(REQUEST_ID)}`, () => ({
    data: 'object{plan,version}',
  }));
  logger.warn('query', '✕ plan.state offline');
  assert.deepEqual(lines, [
    {
      level: 'log',
      line: '[movo:http] ← 200 POST /plans/generate 812ms rid=1a2b3c4d',
      details: { data: 'object{plan,version}' },
    },
    { level: 'warn', line: '[movo:query] ✕ plan.state offline', details: undefined },
  ]);
  assert.equal(formatDuration(12_340), '12.3s');
});

test('masks emails and shortens IDs', () => {
  assert.equal(maskEmail('anna.kowalska@example.com'), 'a***@example.com');
  assert.equal(maskEmail('not an email'), '***');
  assert.equal(maskEmail(undefined), '-');
  assert.equal(shortId(REQUEST_ID), '1a2b3c4d');
  assert.equal(shortId(`draft:${REQUEST_ID}`), 'draft:1a2b3c4d');
  assert.equal(shortenIds(`/session/${PLAN_ID}`), '/session/9f8e7d6c');
  assert.equal(
    summarizeQuery({ plan_id: PLAN_ID, limit: 100, offset: 0, skip: undefined }),
    'plan_id=9f8e7d6c limit=100 offset=0',
  );
});

test('summarizes request bodies as keys and safe scalars only', () => {
  const chat = summarizeBody({
    request_id: REQUEST_ID,
    plan_id: PLAN_ID,
    expected_version: 3,
    message: 'I hurt my knee, swap Friday for swimming',
    availability: { source: 'device_calendar', captured_at: '2026-10-07T20:00:00+02:00', slots: [{}, {}, {}] },
  });
  assert.deepEqual(chat, {
    keys: 'request_id,plan_id,expected_version,message,availability',
    plan_id: '9f8e7d6c',
    expected_version: 3,
    availability: 'device_calendar×3',
  });
  assert.ok(!JSON.stringify(chat).includes('knee'));

  const completion = summarizeBody({
    request_id: REQUEST_ID,
    activity_id: PLAN_ID,
    feedback: { effort: 3, enjoyment: 4, notes: 'my private note' },
    gym_log: [{}, {}],
    metrics: { duration_minutes: 30 },
  });
  assert.equal(completion.feedback, 'given');
  assert.equal(completion.gym_sets, 2);
  assert.equal(completion.metrics, 'duration_minutes');
  assert.ok(!JSON.stringify(completion).includes('private'));

  const profile = summarizeBody({ username: 'Anna', preferences: { sessions_per_week: 3, timezone: 'Europe/Warsaw' } });
  assert.deepEqual(profile, { keys: 'username,preferences', preferences: 'object(2 fields)' });
  assert.deepEqual(summarizeBody(undefined), {});
});

test('summarizes response data as a shape', () => {
  assert.equal(summarizeData([1, 2, 3, 4, 5, 6, 7]), 'array(7)');
  assert.equal(summarizeData({ plan: {}, version: {} }), 'object{plan,version}');
  assert.equal(summarizeData(null), 'null');
  assert.equal(summarizeData('secret'), 'string(6)');
});

test('redacts tokens, keys, passwords, emails and free text in details', () => {
  const safe = sanitizeDetails({
    access_token: TOKEN,
    refresh_token: 'r-123',
    apikey: 'sb_publishable_test',
    Authorization: `Bearer ${TOKEN}`,
    password: 'hunter22',
    email: 'anna@example.com',
    message: 'swap Friday for swimming',
    notes: 'my private note',
    title: 'Dentist appointment',
    user: REQUEST_ID,
    nested: { token: 'x', count: 2, contact: 'write to anna@example.com' },
    stray: TOKEN,
  });
  assert.deepEqual(safe, {
    access_token: '[redacted]',
    refresh_token: '[redacted]',
    apikey: '[redacted]',
    Authorization: '[redacted]',
    password: '[redacted]',
    email: 'a***@example.com',
    message: '[text 24]',
    notes: '[text 15]',
    title: '[text 19]',
    user: '1a2b3c4d',
    nested: { token: '[redacted]', count: 2, contact: 'write to a***@example.com' },
    stray: '[redacted]',
  });
  const printed = JSON.stringify(safe);
  for (const secret of ['eyJ', 'r-123', 'sb_publishable', 'hunter22', 'anna@', 'Friday', 'private', 'Dentist']) {
    assert.ok(!printed.includes(secret), secret);
  }
});

test('the logger sanitizes every line and details object it prints', () => {
  const { logger, lines } = recordingLogger();
  logger.log('auth', 'event SIGNED_IN', { user: REQUEST_ID, email: 'anna@example.com', access_token: TOKEN });
  assert.deepEqual(lines[0].details, { user: '1a2b3c4d', email: 'a***@example.com', access_token: '[redacted]' });
  logger.warn('auth', `oops anna@example.com Bearer ${TOKEN} user ${REQUEST_ID}`);
  assert.equal(lines[1].line, '[movo:auth] oops a***@example.com Bearer [redacted] user 1a2b3c4d');
});

test('describes errors by their codes only', () => {
  const conflict = errorFromResponse(409, {
    error: { code: 'VERSION_CONFLICT', message: 'Plan version 3 is stale for anna@example.com', retryable: false },
  });
  assert.deepEqual(describeError(conflict), {
    code: 'stale_version',
    server: 'VERSION_CONFLICT',
    status: 409,
    retryable: false,
  });
  assert.equal(errorLabel(conflict), 'stale_version (VERSION_CONFLICT)');

  const auth = new ApiError('invalid_credentials', 'Wrong password.', {
    cause: { name: 'AuthApiError', code: 'invalid_credentials', message: 'Invalid login credentials', status: 400 },
  });
  assert.deepEqual(describeError(auth), {
    code: 'invalid_credentials',
    cause: 'invalid_credentials',
    retryable: false,
  });

  // Redirect parameters carry a one-time code: never read from a plain cause.
  const link = new ApiError('unauthorized', 'Link expired.', {
    cause: { code: REQUEST_ID, error: 'otp_expired', errorDescription: 'Email link is invalid' },
  });
  assert.ok(!JSON.stringify(describeError(link)).includes('1a2b3c4d'));
  assert.equal(errorLabel(new TypeError('Network request failed')), 'TypeError');
  assert.deepEqual(describeError('boom'), { error: 'string' });
});
