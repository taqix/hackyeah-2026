import assert from 'node:assert/strict';
import { test } from 'node:test';
import { apiSchemas } from '../../packages/contracts/src/product.ts';
import { ApiError } from '../functions/product-api/errors.ts';
import { createGoogleTokenRefresher, GOOGLE_TOKEN_URL } from '../functions/product-api/google.ts';
import { createProductApi } from '../functions/product-api/handler.ts';
import type { GoogleTokenRefresher, ProductStore } from '../functions/product-api/ports.ts';
import { unavailableGenerator } from '../functions/product-api/provider.ts';
import { googleToken, owner } from './fixtures.ts';

// The Google route never reads the database: any store call fails the test.
const untouchedStore = new Proxy({} as ProductStore, {
  get: (_target, name) => () => {
    throw new Error(`The Google token route must not call store.${String(name)}`);
  },
});

function api(google?: GoogleTokenRefresher) {
  const handler = createProductApi({
    authenticate: async (token) => {
      if (token !== 'placeholder-session') throw new ApiError('UNAUTHENTICATED', 401, 'Sign in.');
      return { id: owner };
    },
    store: () => untouchedStore,
    generator: unavailableGenerator,
    ...(google ? { google } : {}),
  });
  return (body: unknown, authorization = 'Bearer placeholder-session', method = 'POST') =>
    handler(
      new Request('https://example.test/functions/v1/product-api/google/token', {
        method,
        headers: { authorization, 'content-type': 'application/json' },
        body: method === 'GET' ? undefined : JSON.stringify(body),
      }),
    );
}

/** A fake Google token endpoint that records what it was sent. */
function googleFetch(reply: { status: number; body: unknown } | Error) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetcher = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    if (reply instanceof Error) throw reply;
    return new Response(JSON.stringify(reply.body), {
      status: reply.status,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
  return { fetcher, calls };
}

const config = (logs: string[] = []) => ({
  clientId: 'synthetic-client-id.apps.googleusercontent.com',
  clientSecret: 'synthetic-client-secret',
  log: (line: string) => logs.push(line),
});

test('POST /google/token trades the refresh token with the server-side client secret', async () => {
  const { fetcher, calls } = googleFetch({
    status: 200,
    body: {
      ...googleToken.result,
      scope: 'https://www.googleapis.com/auth/calendar.freebusy',
      token_type: 'Bearer',
    },
  });
  const response = await api(createGoogleTokenRefresher(config(), fetcher))(googleToken.request);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.ok(apiSchemas.GoogleTokenResponse.safeParse(body).success);
  assert.deepEqual(body.data, googleToken.result);

  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.url, GOOGLE_TOKEN_URL);
  assert.equal(calls[0]!.init.method, 'POST');
  const sent = new URLSearchParams(String(calls[0]!.init.body));
  assert.deepEqual(Object.fromEntries(sent), {
    grant_type: 'refresh_token',
    refresh_token: googleToken.request.refresh_token,
    client_id: 'synthetic-client-id.apps.googleusercontent.com',
    client_secret: 'synthetic-client-secret',
  });
  // The token travels in the body, never in the URL.
  assert.doesNotMatch(calls[0]!.url, /refresh_token|synthetic/);
});

test('without the two function secrets the route answers 501 GOOGLE_NOT_CONFIGURED', async () => {
  for (const google of [
    undefined,
    createGoogleTokenRefresher({}),
    createGoogleTokenRefresher({ clientId: 'only-the-id' }),
    createGoogleTokenRefresher({ clientSecret: 'only-the-secret' }),
  ]) {
    const response = await api(google)(googleToken.request);
    assert.equal(response.status, 501);
    const body = await response.json();
    assert.ok(apiSchemas.ErrorResponse.safeParse(body).success);
    assert.equal(body.error.code, 'GOOGLE_NOT_CONFIGURED');
    assert.equal(body.error.retryable, false);
  }
});

test('invalid_grant asks the person to reconnect, without logging the token', async () => {
  const logs: string[] = [];
  const { fetcher } = googleFetch({
    status: 400,
    body: { error: 'invalid_grant', error_description: 'Token has been expired or revoked.' },
  });
  const response = await api(createGoogleTokenRefresher(config(logs), fetcher))(
    googleToken.request,
  );
  assert.equal(response.status, 409);
  const body = await response.json();
  assert.equal(body.error.code, 'GOOGLE_RECONNECT_REQUIRED');
  assert.equal(body.error.retryable, false);
  assert.deepEqual(logs, ['google token refresh: 400 invalid_grant']);
  for (const line of logs) assert.doesNotMatch(line, /synthetic|revoked/);
});

test('a rejected client reads as not configured; outages and odd answers are retryable', async () => {
  const cases: [{ status: number; body: unknown } | Error, number, string, boolean][] = [
    [{ status: 401, body: { error: 'invalid_client' } }, 501, 'GOOGLE_NOT_CONFIGURED', false],
    [{ status: 503, body: { error: 'backend_error' } }, 502, 'PROVIDER_UNAVAILABLE', true],
    [{ status: 200, body: { token_type: 'Bearer' } }, 502, 'PROVIDER_UNAVAILABLE', true],
    [new TypeError('fetch failed'), 502, 'PROVIDER_UNAVAILABLE', true],
  ];
  for (const [reply, status, code, retryable] of cases) {
    const { fetcher } = googleFetch(reply);
    const response = await api(createGoogleTokenRefresher(config(), fetcher))(googleToken.request);
    assert.equal(response.status, status, code);
    const body = await response.json();
    assert.equal(body.error.code, code);
    assert.equal(body.error.retryable, retryable);
  }
});

test('the route needs a session, a JSON body with only the refresh token, and POST', async () => {
  const { fetcher, calls } = googleFetch({ status: 200, body: googleToken.result });
  const call = api(createGoogleTokenRefresher(config(), fetcher));
  assert.equal((await call(googleToken.request, '')).status, 401);
  assert.equal((await call({})).status, 400);
  assert.equal((await call({ refresh_token: '' })).status, 400);
  assert.equal((await call({ ...googleToken.request, user_id: owner })).status, 400);
  assert.equal((await call(undefined, 'Bearer placeholder-session', 'GET')).status, 405);
  assert.equal(calls.length, 0, 'Google is never called for a rejected request');
});
