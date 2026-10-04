import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  authLinkKind,
  authRedirectParams,
  completeAuthRedirect,
  createRemoteAuth,
  exchangeAuthCode,
  isSignInCancelled,
  mapAuthError,
  toAuthSession,
} from '../../src/api/remote/auth';
import { createRemoteRuntime } from '../../src/api/remote/client';
import type { RemoteContext } from '../../src/api/remote/context';
import type { AuthErrorLike, AuthPort, AuthResult, AuthSessionData, RemoteDeps } from '../../src/api/remote/deps';
import { isApiError, type ApiErrorCode } from '../../src/api/types';
import { fail, fakeAuth, fakeDeps, ok, scriptedFetch, session, USER_ID } from './fakes';

const authError = (code: string | undefined, extra: Partial<AuthErrorLike> = {}): AuthErrorLike => ({
  name: 'AuthApiError',
  message: `auth says ${code}`,
  code,
  status: 400,
  ...extra,
});
const NETWORK: AuthErrorLike = { name: 'AuthRetryableFetchError', message: 'Network request failed', status: 0 };

const answer = (s: AuthSessionData | null, error: AuthErrorLike | null = null): AuthResult => ({
  data: { user: s?.user ?? null, session: s },
  error,
});

/** An Auth section over a fake port; `reset` counts sign-out cache resets. */
function authSection(port: Partial<AuthPort> = {}, deps: Partial<RemoteDeps> = {}) {
  const auth: AuthPort = { ...fakeAuth().auth, ...port };
  const resets = { count: 0 };
  const ctx = {
    deps: fakeDeps({ auth, ...deps }),
    data: { reset: () => (resets.count += 1) },
  } as unknown as RemoteContext;
  return { client: createRemoteAuth(ctx), auth, resets };
}

const rejectsWith = (code: ApiErrorCode) => (error: unknown) => isApiError(error, code);

/* -------------------------------------------------------------- Session */

test('a Supabase session maps to the app session with Google name and provider', () => {
  const google = session();
  google.user.app_metadata = { provider: 'google' };
  google.user.user_metadata = { full_name: ' Sam Doe ', name: 'Sam' };
  assert.deepEqual(toAuthSession(google), {
    user: { id: USER_ID, email: 'ana@example.com', name: 'Sam Doe', provider: 'google', created_at: '2026-10-01T10:00:00Z' },
    access_token: 'token-1',
  });

  const named = session();
  named.user.user_metadata = { name: 'Ana' };
  assert.equal(toAuthSession(named).user.name, 'Ana');

  const plain = session();
  delete plain.user.email;
  plain.user.app_metadata = {};
  assert.deepEqual([toAuthSession(plain).user.name, toAuthSession(plain).user.provider, toAuthSession(plain).user.email], [
    null,
    'email',
    '',
  ]);
});

test('getSession returns the session, null when signed out, and offline on a network failure', async () => {
  assert.equal((await authSection().client.getSession())?.user.id, USER_ID);
  assert.equal(await authSection({ getSession: async () => ({ data: { session: null }, error: null }) }).client.getSession(), null);
  await assert.rejects(
    authSection({ getSession: async () => ({ data: { session: null }, error: NETWORK }) }).client.getSession(),
    rejectsWith('offline'),
  );
  await assert.rejects(
    authSection({
      getSession: async () => {
        throw new TypeError('Network request failed');
      },
    }).client.getSession(),
    rejectsWith('offline'),
  );
});

/* -------------------------------------------------------------- Errors */

test('Auth errors map to the codes the screens read', () => {
  const cases: [AuthErrorLike | unknown, ApiErrorCode][] = [
    [authError('invalid_credentials'), 'invalid_credentials'],
    [authError(undefined, { message: 'Invalid login credentials' }), 'invalid_credentials'],
    [authError('weak_password', { name: 'AuthWeakPasswordError', status: 422 }), 'weak_password'],
    [authError('user_already_exists', { status: 422 }), 'email_taken'],
    [authError('email_exists', { status: 422 }), 'email_taken'],
    [authError('email_not_confirmed'), 'confirmation_required'],
    [authError('email_address_invalid'), 'validation'],
    [authError('validation_failed'), 'validation'],
    [authError('same_password', { status: 422 }), 'validation'],
    [authError('flow_state_expired'), 'unauthorized'],
    [{ name: 'AuthPKCECodeVerifierMissingError', message: 'missing', status: 400 }, 'unauthorized'],
    [authError('session_not_found', { status: 403 }), 'unauthorized'],
    [NETWORK, 'offline'],
    [new TypeError('Network request failed'), 'offline'],
    [authError('over_email_send_rate_limit', { status: 429 }), 'unknown'],
    [authError('unexpected_failure', { status: 500 }), 'unknown'],
    ['not an error', 'unknown'],
  ];
  for (const [input, code] of cases) assert.equal(mapAuthError(input).code, code, JSON.stringify(input));

  assert.match(mapAuthError(authError('email_not_confirmed')).message, /Confirm your email first/);
  assert.equal(mapAuthError(authError('over_request_rate_limit', { status: 429 })).retryable, true);
  assert.equal(mapAuthError(authError('unexpected_failure', { status: 500 })).retryable, true);
  assert.equal(mapAuthError(authError('invalid_credentials')).retryable, false);
});

/* ---------------------------------------------------------- Email flows */

test('lookupEmail normalizes the email and never reveals whether it has an account', async () => {
  const { client } = authSection();
  assert.deepEqual(await client.lookupEmail('  Ana@Example.COM '), { email: 'ana@example.com', exists: true });
  await assert.rejects(client.lookupEmail('ana@'), rejectsWith('validation'));
});

test('sign-in sends the normalized email and maps a wrong password and an unconfirmed email', async () => {
  const sent: string[] = [];
  const ok = authSection({
    signInWithPassword: async ({ email }) => {
      sent.push(email);
      return answer(session());
    },
  });
  assert.equal((await ok.client.signInWithEmail('Ana@Example.com', 'long enough')).access_token, 'token-1');
  assert.deepEqual(sent, ['ana@example.com']);

  const wrong = authSection({ signInWithPassword: async () => answer(null, authError('invalid_credentials')) });
  await assert.rejects(wrong.client.signInWithEmail('ana@example.com', 'nope nope'), rejectsWith('invalid_credentials'));

  const unconfirmed = authSection({ signInWithPassword: async () => answer(null, authError('email_not_confirmed')) });
  await assert.rejects(
    unconfirmed.client.signInWithEmail('ana@example.com', 'long enough'),
    rejectsWith('confirmation_required'),
  );
});

test('sign-up checks the length first, detects a taken email, and asks for confirmation without a session', async () => {
  let calls = 0;
  const { client: short } = authSection({
    signUp: async () => {
      calls += 1;
      return answer(session());
    },
  });
  await assert.rejects(short.signUpWithEmail('ana@example.com', 'short', 'Ana'), rejectsWith('weak_password'));
  assert.equal(calls, 0, 'a short password never reaches the server');

  const taken = authSection({ signUp: async () => answer(null, authError('user_already_exists', { status: 422 })) });
  await assert.rejects(taken.client.signUpWithEmail('ana@example.com', 'long enough', 'Ana'), rejectsWith('email_taken'));

  const hidden = session();
  hidden.user.identities = [];
  const obfuscated = authSection({ signUp: async () => ({ data: { user: hidden.user, session: null }, error: null }) });
  await assert.rejects(obfuscated.client.signUpWithEmail('ana@example.com', 'long enough', 'Ana'), rejectsWith('email_taken'));

  const pending = session();
  pending.user.identities = [{ provider: 'email' }];
  const confirm = authSection({ signUp: async () => ({ data: { user: pending.user, session: null }, error: null }) });
  await assert.rejects(confirm.client.signUpWithEmail('ana@example.com', 'long enough', 'Ana'), rejectsWith('confirmation_required'));

  let options: object | undefined;
  const fine = authSection({
    signUp: async (credentials) => {
      options = credentials.options;
      return answer(session());
    },
  });
  assert.equal((await fine.client.signUpWithEmail('Ana@example.com', 'long enough', 'Ana')).user.id, USER_ID);
  assert.deepEqual(options, {
    emailRedirectTo: 'hackyeah2026://auth/callback',
    data: { name: 'Ana', full_name: 'Ana' },
  });
});

test('password reset links back to the reset screen; a new password must be long enough', async () => {
  const resets: [string, unknown][] = [];
  let updated: unknown;
  const { client } = authSection({
    resetPasswordForEmail: async (email, options) => {
      resets.push([email, options]);
      return { error: null };
    },
    updateUser: async (attributes) => {
      updated = attributes;
      return { data: { user: session().user }, error: null };
    },
  });
  await client.sendPasswordReset(' Ana@example.com');
  assert.deepEqual(resets, [['ana@example.com', { redirectTo: 'hackyeah2026://auth/reset' }]]);
  await assert.rejects(client.sendPasswordReset('nope'), rejectsWith('validation'));

  await assert.rejects(client.updatePassword('short'), rejectsWith('weak_password'));
  assert.equal(updated, undefined);
  await client.updatePassword('a new password');
  assert.deepEqual(updated, { password: 'a new password' });

  const same = authSection({
    updateUser: async () => ({ data: { user: null }, error: authError('same_password', { status: 422 }) }),
  });
  await assert.rejects(same.client.updatePassword('a new password'), rejectsWith('validation'));
});

test('sign-out resets the remote cache, and still signs out on the device when offline', async () => {
  const scopes: unknown[] = [];
  const online = authSection({
    signOut: async (options) => {
      scopes.push(options?.scope ?? 'global');
      return { error: null };
    },
  });
  await online.client.signOut();
  assert.deepEqual(scopes, ['global']);
  assert.equal(online.resets.count, 1);

  scopes.length = 0;
  const offline = authSection({
    signOut: async (options) => {
      scopes.push(options?.scope ?? 'global');
      return { error: options?.scope === 'local' ? null : NETWORK };
    },
  });
  await offline.client.signOut();
  assert.deepEqual(scopes, ['global', 'local']);
  assert.equal(offline.resets.count, 1);
});

test('the runtime client signs out through the same section', async () => {
  const { auth, state } = fakeAuth();
  const { client } = createRemoteRuntime(fakeDeps({ auth }));
  await client.auth.signOut();
  assert.equal(state.current, null);
  assert.equal(await client.auth.getSession(), null);
});

/* --------------------------------------------------------------- Google */

function googlePort(exchanges: string[], oauthOptions: unknown[]) {
  return {
    signInWithOAuth: async (credentials: Parameters<AuthPort['signInWithOAuth']>[0]) => {
      oauthOptions.push(credentials);
      return { data: { url: 'https://example.supabase.co/auth/v1/authorize?provider=google' }, error: null };
    },
    exchangeCodeForSession: async (code: string) => {
      exchanges.push(code);
      const s = session();
      s.user.app_metadata = { provider: 'google' };
      s.user.user_metadata = { full_name: 'Sam Doe' };
      return answer(s);
    },
  } satisfies Partial<AuthPort>;
}

test('Google on a phone opens the browser and trades the returned code for a session', async () => {
  const exchanges: string[] = [];
  const oauth: unknown[] = [];
  const opened: [string, string][] = [];
  const { client } = authSection(googlePort(exchanges, oauth), {
    openAuthSession: async (url, redirectUrl) => {
      opened.push([url, redirectUrl]);
      return { type: 'success', url: 'hackyeah2026://auth/callback?code=abc123' };
    },
  });
  const signedIn = await client.signInWithGoogle();
  assert.deepEqual(oauth, [
    { provider: 'google', options: { redirectTo: 'hackyeah2026://auth/callback', skipBrowserRedirect: true } },
  ]);
  assert.deepEqual(opened, [['https://example.supabase.co/auth/v1/authorize?provider=google', 'hackyeah2026://auth/callback']]);
  assert.deepEqual(exchanges, ['abc123']);
  assert.deepEqual([signedIn.user.provider, signedIn.user.name], ['google', 'Sam Doe']);
});

test('closing Google or declining on its page rejects quietly as a cancellation', async () => {
  for (const reply of [
    { type: 'cancel' as const },
    { type: 'dismiss' as const },
    { type: 'success' as const, url: 'hackyeah2026://auth/callback?error=access_denied&error_description=denied' },
  ]) {
    const exchanges: string[] = [];
    const { client } = authSection(googlePort(exchanges, []), { openAuthSession: async () => reply });
    await assert.rejects(client.signInWithGoogle(), (error) => isSignInCancelled(error) && isApiError(error));
    assert.deepEqual(exchanges, []);
  }

  const { client } = authSection(googlePort([], []), {
    openAuthSession: async () => ({ type: 'success', url: 'hackyeah2026://auth/callback' }),
  });
  await assert.rejects(client.signInWithGoogle(), (error) => isApiError(error, 'unknown') && !isSignInCancelled(error));
});

test('Google on the web hands the page to supabase-js and never settles', async () => {
  const oauth: unknown[] = [];
  const { client } = authSection(googlePort([], oauth), { platform: 'web', redirectUrl: (path) => `http://localhost:8081/${path}` });
  const settled = await Promise.race([
    client.signInWithGoogle().then(() => 'settled'),
    new Promise((resolve) => setTimeout(() => resolve('pending'), 10)),
  ]);
  assert.equal(settled, 'pending');
  assert.deepEqual(oauth, [{ provider: 'google', options: { redirectTo: 'http://localhost:8081/auth/callback' } }]);
});

/* ------------------------------------------------------------ Redirects */

test('redirect URLs give their code or error, and auth links are recognized', () => {
  assert.deepEqual(authRedirectParams('hackyeah2026://auth/callback?code=abc&state=1'), {
    code: 'abc',
    error: null,
    errorDescription: null,
  });
  assert.deepEqual(authRedirectParams('http://localhost:8081/auth/reset#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid'), {
    code: null,
    error: 'otp_expired',
    errorDescription: 'Email link is invalid',
  });
  assert.equal(authLinkKind('hackyeah2026://auth/callback?code=abc'), 'callback');
  assert.equal(authLinkKind('exp://127.0.0.1:8081/--/auth/reset?code=abc'), 'reset');
  assert.equal(authLinkKind('http://localhost:8081/auth/reset'), 'reset');
  assert.equal(authLinkKind('hackyeah2026://session/abc'), null);
  assert.equal(authLinkKind('hackyeah2026://auth/callbacks'), null);
});

test('a code is exchanged once even when several listeners see it', async () => {
  const exchanges: string[] = [];
  const { auth } = authSection(googlePort(exchanges, []));
  const [a, b] = await Promise.all([exchangeAuthCode(auth, 'once', 'android'), exchangeAuthCode(auth, 'once', 'android')]);
  assert.equal(a, b);
  await completeAuthRedirect(auth, { code: 'once', error: null, errorDescription: null }, 'android');
  assert.deepEqual(exchanges, ['once']);
});

test('on the web a code supabase-js already traded still counts; on a phone it fails', async () => {
  const used = { exchangeCodeForSession: async () => answer(null, { name: 'AuthPKCECodeVerifierMissingError', message: 'missing', status: 400 }) };
  const web = authSection(used).auth;
  assert.equal((await completeAuthRedirect(web, { code: 'web-code', error: null, errorDescription: null }, 'web')).user.id, USER_ID);

  const phone = authSection(used).auth;
  await assert.rejects(
    completeAuthRedirect(phone, { code: 'phone-code', error: null, errorDescription: null }, 'ios'),
    rejectsWith('unauthorized'),
  );
});

test('an expired link says so; a link without a code needs a saved session', async () => {
  const { auth } = authSection();
  await assert.rejects(
    completeAuthRedirect(auth, { code: null, error: 'otp_expired', errorDescription: null }, 'ios'),
    (error) => isApiError(error, 'unauthorized') && /expired/.test(error.message),
  );
  assert.equal((await completeAuthRedirect(auth, { code: null, error: null, errorDescription: null }, 'web')).user.id, USER_ID);
  const signedOut = authSection({ getSession: async () => ({ data: { session: null }, error: null }) }).auth;
  await assert.rejects(
    completeAuthRedirect(signedOut, { code: null, error: null, errorDescription: null }, 'web'),
    rejectsWith('unauthorized'),
  );
});

/* ------------------------------------------------------------ Providers */

test('Google shows only when Auth settings switch it on, and the answer is kept', async () => {
  const fetch = scriptedFetch(() => ({ status: 200, body: { external: { google: false, email: true } } }));
  const { client } = authSection({}, { fetch: fetch.fetch });
  assert.deepEqual(await client.getProviders(), { google: false });
  assert.deepEqual(await client.getProviders(), { google: false });
  assert.equal(fetch.calls.length, 1);
  assert.equal(fetch.calls[0].url, 'https://example.supabase.co/auth/v1/settings');
  assert.deepEqual(fetch.calls[0].init.headers, { apikey: 'sb_publishable_test' });

  const on = scriptedFetch(() => ({ status: 200, body: { external: { google: true } } }));
  assert.deepEqual(await authSection({}, { fetch: on.fetch }).client.getProviders(), { google: true });
});

test('when the settings cannot be read, Google is offered and asked again later', async () => {
  let failing = true;
  const fetch = scriptedFetch(() => (failing ? { throws: new TypeError('Network request failed') } : ok({})));
  const { client } = authSection({}, { fetch: fetch.fetch });
  assert.deepEqual(await client.getProviders(), { google: true });
  failing = false;
  // An answer without the provider list (here a product API envelope) is also unknown.
  assert.deepEqual(await client.getProviders(), { google: true });
  assert.equal(fetch.calls.length, 2);

  const broken = scriptedFetch(() => fail(500, 'INTERNAL_ERROR'));
  assert.deepEqual(await authSection({}, { fetch: broken.fetch }).client.getProviders(), { google: true });
});

/* -------------------------------------------------------------- Account */

test('the account is the signed-in user with the timezone from preferences, else the device', async () => {
  const profile = (preferences: unknown) => scriptedFetch(() => ok({ id: USER_ID, username: null, created_at: null, preferences }));
  const withZone = createRemoteRuntime(fakeDeps({ fetch: profile({ timezone: 'America/New_York' }).fetch }));
  const account = await withZone.client.account.get();
  assert.deepEqual([account.user.email, account.timezone], ['ana@example.com', 'America/New_York']);

  const device = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const noPrefs = createRemoteRuntime(fakeDeps({ fetch: profile(null).fetch }));
  assert.equal((await noPrefs.client.account.get()).timezone, device);

  const signedOut = createRemoteRuntime(fakeDeps({ auth: fakeAuth(null).auth }));
  await assert.rejects(signedOut.client.account.get(), rejectsWith('unauthorized'));
});
