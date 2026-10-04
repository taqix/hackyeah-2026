import assert from 'node:assert/strict';
import { test } from 'node:test';

import { apiSchemas } from '../../../../packages/contracts/src/product';
import { createRemoteRuntime } from '../../src/api/remote/client';
import type { AuthErrorLike, AuthPort, AuthSessionData, RemoteDeps } from '../../src/api/remote/deps';
import {
  createGoogleCalendarAccount,
  mapConnectError,
  PENDING_CONNECT_KEY,
} from '../../src/api/remote/google-calendar';
import { EXPO_GO_IP_CALENDAR, isExpoGoIpRedirectError } from '../../src/api/remote/expo-go-redirect';
import { createProductApi } from '../../src/api/remote/http';
import { isApiError } from '../../src/api/types';
import { googleSettingsKey } from '../../src/services/google-calendar/settings';
import { googleTokenKey, type GoogleTokens } from '../../src/services/google-calendar/tokens';
import type { GoogleFetch } from '../../src/services/google-calendar/types';
import { fakeGoogleCalendar } from '../google-calendar-fake';
import { fail, fakeAuth, fakeDeps, memoryStorage, ok, type Reply, scriptedFetch, session, USER_ID } from './fakes';

const OTHER_USER = '00000000-0000-4000-8000-000000000099';
const SCOPES = 'https://www.googleapis.com/auth/calendar.freebusy https://www.googleapis.com/auth/calendar.app.created';
const AUTHORIZE = 'https://example.supabase.co/auth/v1/authorize?provider=google';

/** The session Supabase returns right after the Google sign-in: with Google's tokens, once. */
function googleSession(userId = USER_ID, overrides: Partial<AuthSessionData> = {}): AuthSessionData {
  const s = session(userId, 'token-after-google');
  s.provider_token = 'google-access-1';
  s.provider_refresh_token = 'google-refresh-1';
  s.user.identities = [
    { provider: 'email', identity_data: { email: 'ana@example.com' } },
    { provider: 'google', identity_data: { email: 'ana.google@example.com' } },
  ];
  return { ...s, ...overrides };
}

interface Setup {
  /** Linked identities before connecting. */
  identities?: string[];
  port?: Partial<AuthPort>;
  deps?: Partial<RemoteDeps>;
  product?: (path: string, body: unknown) => Reply;
}

/** A Google Calendar account over fake Auth, storage, product API and Google. */
function setup(options: Setup = {}) {
  const { auth: base, state } = fakeAuth();
  const oauth: { method: string; credentials: Parameters<AuthPort['signInWithOAuth']>[0] }[] = [];
  const exchanged: string[] = [];
  const restored: unknown[] = [];
  const auth: AuthPort = {
    ...base,
    getUserIdentities: async () => ({
      data: {
        identities: (options.identities ?? ['email']).map((provider) => ({
          provider,
          identity_data: { email: provider === 'google' ? 'ana.google@example.com' : 'ana@example.com' },
        })),
      },
      error: null,
    }),
    signInWithOAuth: async (credentials) => {
      oauth.push({ method: 'signInWithOAuth', credentials });
      return { data: { url: AUTHORIZE }, error: null };
    },
    linkIdentity: async (credentials) => {
      oauth.push({ method: 'linkIdentity', credentials });
      return { data: { url: `${AUTHORIZE}&link=1` }, error: null };
    },
    exchangeCodeForSession: async (code) => {
      exchanged.push(code);
      const s = googleSession();
      return { data: { user: s.user, session: s }, error: null };
    },
    setSession: async (tokens) => {
      restored.push(tokens);
      return { data: { user: state.current?.user ?? null, session: state.current }, error: null };
    },
    ...options.port,
  };
  const google = fakeGoogleCalendar();
  const product = scriptedFetch((call) => {
    const path = new URL(call.url).pathname.replace(/^.*\/product-api/, '');
    const body: unknown = call.init.body ? JSON.parse(call.init.body) : undefined;
    return (options.product ?? (() => ok({ access_token: 'google-access-1', expires_in: 3599 })))(path, body);
  });
  const revoked: { url: string; body: string | undefined }[] = [];
  const googleFetch: GoogleFetch = async (url, init) => {
    if (url.startsWith('https://oauth2.googleapis.com/revoke')) {
      revoked.push({ url, body: init.body });
      return { status: 200, ok: true, text: async () => '' };
    }
    return google.fetch(url, init);
  };
  const storage = memoryStorage();
  const secureStorage = memoryStorage();
  let clock = new Date('2026-10-05T08:00:00Z').getTime();
  let codes = 0;
  const deps = fakeDeps({
    auth,
    storage,
    secureStorage,
    googleFetch,
    fetch: product.fetch,
    now: () => new Date(clock),
    openAuthSession: async () => ({ type: 'success', url: `hackyeah2026://auth/callback?code=google-code-${(codes += 1)}` }),
    ...options.deps,
  });
  const http = createProductApi({
    fetch: deps.fetch,
    baseUrl: deps.productApiUrl,
    publishableKey: deps.publishableKey,
    getAccessToken: async () => 'token-1',
    sleep: async () => undefined,
  });
  const slept: number[] = [];
  const account = createGoogleCalendarAccount(
    { deps, http },
    {
      sleep: async (ms) => {
        slept.push(ms);
        clock += ms;
      },
    },
  );
  const tick = (ms: number) => {
    clock += ms;
  };
  const tokens = () => {
    const raw = secureStorage.items.get(googleTokenKey(USER_ID));
    return raw ? (JSON.parse(raw) as GoogleTokens) : null;
  };
  return { account, auth, state, oauth, exchanged, restored, google, product, revoked, storage, secureStorage, tokens, tick, slept };
}

const authError = (code: string): AuthErrorLike => ({ name: 'AuthApiError', message: `auth says ${code}`, code, status: 422 });

/* --------------------------------------------------------- Connect flow */

test('an email account links Google with the calendar scopes and offline access', async () => {
  const s = setup({ identities: ['email'] });
  assert.deepEqual(await s.account.connect(), { status: 'connected', email: 'ana.google@example.com' });
  assert.deepEqual(s.oauth, [
    {
      method: 'linkIdentity',
      credentials: {
        provider: 'google',
        options: {
          redirectTo: 'hackyeah2026://auth/callback',
          scopes: SCOPES,
          queryParams: { access_type: 'offline', prompt: 'consent' },
          skipBrowserRedirect: true,
        },
      },
    },
  ]);
  assert.deepEqual(s.exchanged, ['google-code-1']);
  const stored = s.tokens();
  assert.deepEqual(
    [stored?.access_token, stored?.refresh_token, stored?.email, stored?.needs_reconnect],
    ['google-access-1', 'google-refresh-1', 'ana.google@example.com', false],
  );
  // Tokens live in the secure store only, never in AsyncStorage.
  for (const value of s.storage.items.values()) assert.doesNotMatch(value, /google-access-1|google-refresh-1/);
  assert.equal(s.storage.items.has(PENDING_CONNECT_KEY), false, 'the pending marker is cleared');
  assert.deepEqual(await s.account.status(), {
    connected: true,
    email: 'ana.google@example.com',
    needsReconnect: false,
    useForPlanning: true,
    exportEnabled: false,
    hasMovoCalendar: false,
  });
});

test('an account that already signs in with Google signs in again, hinting its Google email', async () => {
  const s = setup({ identities: ['google'] });
  assert.equal((await s.account.connect()).status, 'connected');
  assert.equal(s.oauth[0]?.method, 'signInWithOAuth');
  assert.deepEqual(s.oauth[0]?.credentials.options?.queryParams, {
    access_type: 'offline',
    prompt: 'consent',
    login_hint: 'ana.google@example.com',
  });
  assert.equal(s.oauth[0]?.credentials.options?.scopes, SCOPES);
  assert.equal(s.restored.length, 0);
});

test('on the web the page goes to Google, and the session that comes back is captured', async () => {
  const s = setup({ identities: ['email'], deps: { platform: 'web', redirectUrl: (path) => `http://localhost:8081/${path}` } });
  assert.deepEqual(await s.account.connect(), { status: 'redirecting' });
  assert.equal(s.oauth[0]?.credentials.options?.skipBrowserRedirect, false);
  assert.equal(s.oauth[0]?.credentials.options?.redirectTo, 'http://localhost:8081/auth/callback');
  assert.equal(await s.account.returnTo(), 'privacy', '/auth/callback goes back to Data and privacy');

  // The page loads again; supabase-js reports the session from the URL.
  const session = googleSession();
  const [first, second] = await Promise.all([s.account.capture(session), s.account.capture(session)]);
  assert.deepEqual([first, second], ['stored', 'stored'], 'two listeners share one capture');
  assert.equal(await s.account.capture(session), 'ignored', 'once stored, the marker is gone');
  assert.equal(s.tokens()?.access_token, 'google-access-1');
  assert.equal(await s.account.returnTo(), 'privacy');
});

test('a connect started on Review goes back to Review, even after its marker is gone', async () => {
  const s = setup({ identities: ['google'], deps: { platform: 'web', redirectUrl: (path) => `http://localhost:8081/${path}` } });
  assert.deepEqual(await s.account.connect({ from: 'review' }), { status: 'redirecting' });
  assert.equal(JSON.parse(s.storage.items.get(PENDING_CONNECT_KEY)!).from, 'review');
  assert.equal(await s.account.returnTo(), 'review');
  assert.equal(await s.account.capture(googleSession()), 'stored');
  assert.equal(s.storage.items.has(PENDING_CONNECT_KEY), false);
  assert.equal(await s.account.returnTo(), 'review', 'a capture a moment ago still counts');
  s.tick(5 * 60_000);
  assert.equal(await s.account.returnTo(), null, 'later callbacks are ordinary sign-ins');

  // A marker written by an older build has no screen: Data and privacy.
  const older = setup();
  await older.storage.setItem(
    PENDING_CONNECT_KEY,
    JSON.stringify({ user_id: USER_ID, started_at: new Date('2026-10-05T08:00:00Z').getTime(), restore: null, stale: null }),
  );
  assert.equal(await older.account.returnTo(), 'privacy');
});

test('a plain Google sign-in never stores calendar tokens', async () => {
  const s = setup();
  assert.equal(await s.account.capture(googleSession()), 'ignored');
  assert.equal(s.tokens(), null);
  assert.equal(await s.account.returnTo(), null);
});

test("the Google token from before the connect (an earlier sign-in) is never taken for the calendar's", async () => {
  const s = setup({ identities: ['google'], deps: { platform: 'web', redirectUrl: (path) => `http://localhost:8081/${path}` } });
  // Signed in with Google earlier: the stored session still carries that sign-in's token.
  s.state.current = googleSession(USER_ID, { provider_token: 'google-sign-in-token' });
  assert.deepEqual(await s.account.connect(), { status: 'redirecting' });
  // The person comes back without finishing (Back button): the reload reports the old session.
  assert.equal(await s.account.capture(googleSession(USER_ID, { provider_token: 'google-sign-in-token' })), 'ignored');
  assert.equal(s.tokens(), null);
  // The real return from Google carries a new token.
  assert.equal(await s.account.capture(googleSession(USER_ID, { provider_token: 'google-calendar-token' })), 'stored');
  assert.equal(s.tokens()?.access_token, 'google-calendar-token');
  // Nothing about the tokens is kept in AsyncStorage.
  for (const value of s.storage.items.values()) assert.doesNotMatch(value, /google-sign-in-token|google-calendar-token/);
});

test('a connect that signs in another Movo account puts the original session back', async () => {
  const s = setup({
    identities: ['google'],
    port: {
      exchangeCodeForSession: async () => {
        const other = googleSession(OTHER_USER);
        return { data: { user: other.user, session: other }, error: null };
      },
    },
  });
  await assert.rejects(s.account.connect(), (error) => isApiError(error) && /another Movo account/.test(error.message));
  assert.deepEqual(s.restored, [{ access_token: 'token-1', refresh_token: 'refresh' }]);
  assert.equal(s.tokens(), null);
  assert.equal(s.secureStorage.items.has(googleTokenKey(OTHER_USER)), false);
});

test('declining, closing or a sign-in error leaves nothing connected', async () => {
  const declined = setup({
    deps: {
      openAuthSession: async () => ({
        type: 'success',
        url: 'hackyeah2026://auth/callback?error=access_denied&error_code=access_denied&error_description=denied',
      }),
    },
  });
  assert.deepEqual(await declined.account.connect(), { status: 'cancelled' });
  assert.deepEqual(declined.exchanged, []);

  const closed = setup({ deps: { openAuthSession: async () => ({ type: 'dismiss' }) } });
  assert.deepEqual(await closed.account.connect(), { status: 'cancelled' });
  assert.equal(closed.tokens(), null);
  assert.equal(closed.storage.items.has(PENDING_CONNECT_KEY), false);

  const noToken = setup({
    port: {
      exchangeCodeForSession: async () => {
        const s = googleSession(USER_ID, { provider_token: null });
        return { data: { user: s.user, session: s }, error: null };
      },
    },
  });
  await assert.rejects(noToken.account.connect(), (error) => isApiError(error) && /calendar access/.test(error.message));
});

test('Android: a dismissed sheet still connects when the deep link finishes the sign-in', async () => {
  let s: ReturnType<typeof setup>;
  s = setup({
    deps: {
      openAuthSession: async () => {
        // The deep link listener exchanges the code and captures the session meanwhile.
        void s.account.capture(googleSession());
        return { type: 'dismiss' };
      },
    },
  });
  assert.deepEqual(await s.account.connect(), { status: 'connected', email: 'ana.google@example.com' });
  assert.equal(s.tokens()?.access_token, 'google-access-1');
});

test('connect errors read clearly: manual linking off, a Google account taken, offline', async () => {
  const linkingOff = setup({
    port: { linkIdentity: async () => ({ data: { url: null }, error: authError('manual_linking_disabled') }) },
  });
  await assert.rejects(linkingOff.account.connect(), (error) => isApiError(error) && /isn't switched on yet/.test(error.message));
  assert.equal(linkingOff.storage.items.has(PENDING_CONNECT_KEY), false);

  const taken = setup({
    deps: {
      openAuthSession: async () => ({
        type: 'success',
        url: 'hackyeah2026://auth/callback?error=server_error&error_code=identity_already_exists&error_description=Identity+is+already+linked',
      }),
    },
  });
  await assert.rejects(taken.account.connect(), (error) => isApiError(error) && /already belongs to another Movo account/.test(error.message));

  const offline = setup({
    port: {
      getUserIdentities: async () => ({ data: null, error: { name: 'AuthRetryableFetchError', message: 'Network request failed', status: 0 } }),
    },
  });
  await assert.rejects(offline.account.connect(), (error) => isApiError(error, 'offline'));

  assert.equal(mapConnectError(authError('unexpected_failure')).message, "Google Calendar didn't connect. Try again.");
});

test('Expo Go on an IP address stops before Google, since Supabase could not return there', async () => {
  for (const host of ['10.250.163.235', '[fe80::1]']) {
    const s = setup({ deps: { redirectUrl: (path) => `exp://${host}:8081/--/${path}` } });
    await assert.rejects(
      s.account.connect({ from: 'review' }),
      (error) => isExpoGoIpRedirectError(error) && isApiError(error, 'validation') && error.message === EXPO_GO_IP_CALENDAR,
    );
    assert.deepEqual(s.oauth, [], 'Google never opens');
    assert.equal(s.storage.items.has(PENDING_CONNECT_KEY), false, 'no connect is pending');
    assert.equal(await s.account.returnTo(), null);
  }

  for (const host of ['10.250.163.235.nip.io', 'abc-anonymous-8081.exp.direct']) {
    const s = setup({ deps: { redirectUrl: (path) => `exp://${host}:8081/--/${path}` } });
    assert.equal((await s.account.connect()).status, 'connected', host);
    assert.equal(s.oauth[0]?.credentials.options?.redirectTo, `exp://${host}:8081/--/auth/callback`);
  }
});

/* -------------------------------------------------------------- Refresh */

async function connected(options: Setup = {}) {
  const s = setup(options);
  await s.account.connect();
  return s;
}

test('refresh: the product API swaps the refresh token, and a refusal asks for a reconnect', async () => {
  const s = await connected({
    product: (path, body) => {
      assert.equal(path, '/google/token');
      assert.ok(apiSchemas.GoogleTokenDto.safeParse(body).success, JSON.stringify(body));
      return ok({ access_token: 'google-access-2', expires_in: 3599 });
    },
  });
  s.google.state.validTokens = new Set(['google-access-2']);
  s.tick(55 * 60_000);
  const source = await s.account.freeTimeSource();
  assert.ok(source);
  const free = await source.freeSlots({
    startDate: new Date('2026-10-05T09:00:00Z'),
    endDate: new Date('2026-10-06T09:00:00Z'),
    timeZone: 'Europe/Warsaw',
  });
  assert.equal(free.length, 1);
  assert.equal(s.product.calls.length, 1);
  assert.deepEqual(JSON.parse(s.product.calls[0]!.init.body!), { refresh_token: 'google-refresh-1' });
  assert.equal(s.tokens()?.access_token, 'google-access-2');

  for (const reply of [fail(409, 'GOOGLE_RECONNECT_REQUIRED'), fail(501, 'GOOGLE_NOT_CONFIGURED'), fail(404, 'NOT_FOUND')]) {
    const refused = await connected({ product: () => reply });
    refused.tick(55 * 60_000);
    let changes = 0;
    refused.account.subscribe(() => (changes += 1));
    const google = await refused.account.freeTimeSource();
    assert.ok(google);
    await assert.rejects(
      google.freeSlots({ startDate: new Date('2026-10-05T09:00:00Z'), endDate: new Date('2026-10-06T09:00:00Z'), timeZone: 'UTC' }),
    );
    assert.equal((await refused.account.status())?.needsReconnect, true, JSON.stringify(reply));
    assert.ok(changes > 0, 'Data and privacy hears about it');
    assert.equal(await refused.account.freeTimeSource(), null, 'planning stops asking Google until a reconnect');
  }

  const offline = await connected({ product: () => ({ throws: new TypeError('Network request failed') }) });
  offline.tick(55 * 60_000);
  const google = await offline.account.freeTimeSource();
  await assert.rejects(
    google!.freeSlots({ startDate: new Date('2026-10-05T09:00:00Z'), endDate: new Date('2026-10-06T09:00:00Z'), timeZone: 'UTC' }),
  );
  assert.equal((await offline.account.status())?.needsReconnect, false, 'offline is not a reason to reconnect');
});

test('reconnecting clears the reconnect state', async () => {
  const s = await connected({ product: () => fail(409, 'GOOGLE_RECONNECT_REQUIRED') });
  s.tick(55 * 60_000);
  const source = await s.account.freeTimeSource();
  await assert.rejects(source!.freeSlots({ startDate: new Date('2026-10-05T09:00:00Z'), endDate: new Date('2026-10-06T09:00:00Z'), timeZone: 'UTC' }));
  assert.equal((await s.account.status())?.needsReconnect, true);
  s.tick(60_000);
  assert.equal((await s.account.connect()).status, 'connected');
  assert.equal((await s.account.status())?.needsReconnect, false);
});

/* ------------------------------------------------------------- Choices */

test('planning reads Google only while connected with "Use for planning" on', async () => {
  const s = setup();
  assert.equal(await s.account.freeTimeSource(), null, 'not connected');
  await s.account.connect();
  assert.ok(await s.account.freeTimeSource());
  await s.account.setUseForPlanning(false);
  assert.equal(await s.account.freeTimeSource(), null);
  assert.equal(JSON.parse(s.storage.items.get(googleSettingsKey(USER_ID))!).useForPlanning, false);

  // Signed out: nothing.
  s.state.current = null;
  assert.equal(await s.account.status(), null);
  assert.equal(await s.account.freeTimeSource(), null);
});

test('the export syncs only while "Add sessions" is on, and disconnect can remove the Movo calendar', async () => {
  const s = await connected();
  const sessions = [
    {
      id: 'a',
      title: 'Walk',
      description: 'An easy walk.',
      start: new Date('2026-10-05T16:00:00Z'),
      end: new Date('2026-10-05T16:30:00Z'),
      timezone: 'Europe/Warsaw',
    },
  ];
  const range = { start: new Date('2026-10-05T00:00:00Z'), end: new Date('2026-10-12T00:00:00Z') };
  assert.equal(await s.account.syncExport(sessions, range), null);
  await s.account.setExportEnabled(true);
  assert.deepEqual(await s.account.syncExport(sessions, range), { created: 1, updated: 0, deleted: 0 });
  assert.equal((await s.account.status())?.hasMovoCalendar, true);
  assert.equal(s.google.state.calendars.size, 1);

  await s.account.disconnect({ removeCalendar: true });
  assert.equal(s.google.state.calendars.size, 0);
  assert.equal(s.tokens(), null);
  assert.deepEqual(await s.account.status(), {
    connected: false,
    email: null,
    needsReconnect: false,
    useForPlanning: true,
    exportEnabled: false,
    hasMovoCalendar: false,
  });
  // Revoked with the refresh token in the form body, never in the URL.
  assert.deepEqual(s.revoked, [{ url: 'https://oauth2.googleapis.com/revoke', body: 'token=google-refresh-1' }]);
});

test('disconnect keeps the Movo calendar when asked to, and works offline', async () => {
  const s = await connected();
  await s.account.setExportEnabled(true);
  await s.account.syncExport(
    [{ id: 'a', title: 'Walk', description: '', start: new Date('2026-10-05T16:00:00Z'), end: new Date('2026-10-05T16:30:00Z') }],
    { start: new Date('2026-10-05T00:00:00Z'), end: new Date('2026-10-12T00:00:00Z') },
  );
  await s.account.disconnect({ removeCalendar: false });
  assert.equal(s.google.state.calendars.size, 1);
  assert.equal(s.tokens(), null);
});

test('the runtime carries the account, wired to the same deps', async () => {
  const { auth } = fakeAuth();
  const runtime = createRemoteRuntime(fakeDeps({ auth }));
  assert.deepEqual(await runtime.googleCalendar.status(), {
    connected: false,
    email: null,
    needsReconnect: false,
    useForPlanning: true,
    exportEnabled: false,
    hasMovoCalendar: false,
  });
});
