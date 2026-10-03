import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createProductApi, errorFromResponse, serverErrorCode, type ProductApiOptions } from '../../src/api/remote/http';
import { isApiError } from '../../src/api/types';
import { fail, ok, scriptedFetch, type Reply } from './fakes';

function api(script: Reply[], overrides: Partial<ProductApiOptions> = {}) {
  const fetch = scriptedFetch(script);
  const tokens: (boolean | undefined)[] = [];
  const client = createProductApi({
    fetch: fetch.fetch,
    baseUrl: 'https://example.supabase.co/functions/v1/product-api',
    publishableKey: 'sb_publishable_test',
    getAccessToken: async (force) => {
      tokens.push(force);
      return force ? 'fresh-token' : 'old-token';
    },
    sleep: async () => undefined,
    ...overrides,
  });
  return { client, calls: fetch.calls, tokens };
}

test('sends the handoff headers and unwraps data', async () => {
  const { client, calls } = api([ok({ id: 'p' }), ok(['x'])]);
  assert.deepEqual(await client.put('/profile', { username: null }), { id: 'p' });
  assert.deepEqual(await client.get('/plans/history', { limit: 100, offset: 0, skip: undefined }), ['x']);
  const [put, get] = calls;
  assert.equal(put.url, 'https://example.supabase.co/functions/v1/product-api/profile');
  assert.equal(put.init.method, 'PUT');
  assert.equal(put.init.headers.Authorization, 'Bearer old-token');
  assert.equal(put.init.headers.apikey, 'sb_publishable_test');
  assert.equal(put.init.headers['Content-Type'], 'application/json');
  assert.equal(put.init.body, '{"username":null}');
  assert.equal(get.url, 'https://example.supabase.co/functions/v1/product-api/plans/history?limit=100&offset=0');
  assert.equal(get.init.headers['Content-Type'], undefined);
  assert.equal(get.init.body, undefined);
});

test('maps every product API error to the plan table', () => {
  const cases: [number, string, string, boolean][] = [
    [400, 'INVALID_REQUEST', 'validation', false],
    [405, 'METHOD_NOT_ALLOWED', 'validation', false],
    [413, 'PAYLOAD_TOO_LARGE', 'validation', false],
    [401, 'UNAUTHENTICATED', 'unauthorized', false],
    [404, 'NOT_FOUND', 'not_found', false],
    [409, 'VERSION_CONFLICT', 'stale_version', false],
    [409, 'REQUEST_CONFLICT', 'conflict', false],
    [409, 'ALREADY_COMPLETED', 'conflict', false],
    [409, 'UNDO_LOCKED', 'conflict', false],
    [501, 'AI_NOT_CONFIGURED', 'ai_unavailable', false],
    [502, 'INVALID_AI_OUTPUT', 'generation_failed', true],
    [503, 'PROVIDER_UNAVAILABLE', 'generation_failed', true],
    [503, 'DATA_UNAVAILABLE', 'unknown', true],
    [500, 'INTERNAL_ERROR', 'unknown', false],
  ];
  for (const [status, code, mapped, retryable] of cases) {
    const reply = fail(status, code, retryable);
    const error = errorFromResponse(status, 'body' in reply ? reply.body : null);
    assert.equal(error.code, mapped, code);
    assert.equal(error.retryable, retryable, `${code} retryable`);
    assert.equal(serverErrorCode(error), code);
    assert.ok(error.message.length > 0 && !error.message.includes('server says'), 'user-facing message');
  }
  // AI_NOT_CONFIGURED never retries, whatever the server says.
  assert.equal(errorFromResponse(501, { error: { code: 'AI_NOT_CONFIGURED', message: '', retryable: true }, meta: {} }).retryable, false);
});

test('normalizes gateway errors without an envelope', () => {
  const invalidJwt = errorFromResponse(401, { msg: 'Invalid JWT' });
  assert.equal(invalidJwt.code, 'unauthorized');
  assert.equal(serverErrorCode(invalidJwt), null);
  assert.equal(errorFromResponse(404, { message: 'Requested function was not found' }).code, 'not_found');
  const badGateway = errorFromResponse(502, null, '<html>Bad gateway</html>');
  assert.equal(badGateway.code, 'unknown');
  assert.equal(badGateway.retryable, true);
  assert.equal(errorFromResponse(504, null).code, 'timeout');
  assert.equal(errorFromResponse(429, null).retryable, true);
});

test('a network failure is offline, an abort is a timeout, and a non-envelope 200 is unknown', async () => {
  const offline = api([{ throws: new TypeError('Network request failed') }]);
  await assert.rejects(offline.client.get('/profile'), (error) => isApiError(error, 'offline') && error.retryable);

  const slow = api([{ hang: true }], { timeoutMs: 10 });
  await assert.rejects(slow.client.get('/profile'), (error) => isApiError(error, 'timeout'));

  const html = api([{ status: 200, text: '<html></html>' }]);
  await assert.rejects(html.client.get('/profile'), (error) => isApiError(error, 'unknown') && !error.retryable);
});

test('a 401 refreshes the token once and resends once, then gives up as unauthorized', async () => {
  const recovered = api([fail(401, 'UNAUTHENTICATED'), ok('fine')]);
  assert.equal(await recovered.client.get('/profile'), 'fine');
  assert.deepEqual(recovered.tokens, [false, true]);
  assert.equal(recovered.calls[1].init.headers.Authorization, 'Bearer fresh-token');

  const expired = api([fail(401, 'UNAUTHENTICATED'), fail(401, 'UNAUTHENTICATED')]);
  await assert.rejects(expired.client.get('/profile'), (error) => isApiError(error, 'unauthorized'));
  assert.equal(expired.calls.length, 2);
});

test('signed out (no token) rejects as unauthorized without a request', async () => {
  const { client, calls } = api([], { getAccessToken: async () => null });
  await assert.rejects(client.get('/profile'), (error) => isApiError(error, 'unauthorized'));
  assert.equal(calls.length, 0);
});

test('retryTransport resends the identical body after offline and timeout, at most twice', async () => {
  const body = { request_id: 'r-1', availability: { captured_at: '2026-10-05T07:00:00+02:00' } };
  const flaky = api([{ throws: new TypeError('offline') }, { hang: true }, ok({ done: true })], { timeoutMs: 10 });
  assert.deepEqual(await flaky.client.post('/plans/generate', body, { retryTransport: true }), { done: true });
  assert.equal(flaky.calls.length, 3);
  assert.ok(flaky.calls.every((call) => call.init.body === JSON.stringify(body)));

  const down = api([1, 2, 3].map(() => ({ throws: new TypeError('offline') })));
  await assert.rejects(down.client.post('/chat', body, { retryTransport: true }), (error) => isApiError(error, 'offline'));
  assert.equal(down.calls.length, 3);

  const plain = api([{ throws: new TypeError('offline') }]);
  await assert.rejects(plain.client.post('/chat', body), (error) => isApiError(error, 'offline'));
  assert.equal(plain.calls.length, 1, 'no retry without retryTransport');

  const rejected = api([fail(409, 'VERSION_CONFLICT')]);
  await assert.rejects(rejected.client.post('/chat', body, { retryTransport: true }), (error) => isApiError(error, 'stale_version'));
  assert.equal(rejected.calls.length, 1, 'server answers are never retried');
});
