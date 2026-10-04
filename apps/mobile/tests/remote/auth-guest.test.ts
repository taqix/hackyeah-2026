import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CONFIRM_FIRST_DOMAIN, createBackend } from '../../src/api/mock/backend';
import { emptyDb, type MockDb } from '../../src/api/mock/model';
import { createRemoteAuth, isGuestModeUnavailable, mapAuthError, toAuthSession } from '../../src/api/remote/auth';
import { createRemoteRuntime } from '../../src/api/remote/client';
import type { RemoteContext } from '../../src/api/remote/context';
import type { AuthErrorLike, AuthPort, AuthSessionData, AuthUser, RemoteDeps } from '../../src/api/remote/deps';
import { webAppUrl } from '../../src/api/remote/redirect-url';
import { GUEST_NAME, isApiError, isGuest, type ApiErrorCode } from '../../src/api/types';
import { fakeAuth, fakeDeps, GUEST_ID, guestSession, session, USER_ID } from './fakes';

const NETWORK: AuthErrorLike = { name: 'AuthRetryableFetchError', message: 'Network request failed', status: 0 };
const rejectsWith = (code: ApiErrorCode) => (error: unknown) => isApiError(error, code);

/** An Auth section over a fake port (signed out unless `initial` says otherwise). */
function guestAuth(port: Partial<AuthPort> = {}, initial: AuthSessionData | null = null, deps: Partial<RemoteDeps> = {}) {
  const fake = fakeAuth(initial);
  const auth: AuthPort = { ...fake.auth, ...port };
  const ctx = {
    deps: fakeDeps({ auth, ...deps }),
    // The profile can't be read in these tests: the session's own name is used.
    data: { reset: () => undefined, profile: async () => null },
  } as unknown as RemoteContext;
  return { client: createRemoteAuth(ctx), state: fake.state };
}

/** The user Supabase answers updateUser with once the guest's email is confirmed (autoconfirm on). */
function savedUser(email: string): AuthUser {
  const { user } = guestSession();
  return { ...user, email, is_anonymous: false, app_metadata: { provider: 'email', providers: ['email'] } };
}

/* ------------------------------------------------------------ Mapping */

test('a guest is told apart by is_anonymous alone: no provider, an empty email, the Guest name', () => {
  const guest = toAuthSession(guestSession());
  assert.deepEqual(guest.user, {
    id: GUEST_ID,
    email: '',
    name: 'Guest',
    provider: 'guest',
    created_at: '2026-10-04T10:00:00Z',
  });
  assert.equal(isGuest(guest.user), true);

  // Saved with an email: no longer anonymous, even if the provider key never appears.
  const saved = guestSession();
  saved.user = { ...saved.user, email: 'sam@example.com', is_anonymous: false };
  assert.deepEqual([toAuthSession(saved).user.provider, isGuest(toAuthSession(saved).user)], ['email', false]);

  // Linked to Google (Google Calendar connect): a Google account from then on.
  const linked = guestSession();
  linked.user = { ...linked.user, is_anonymous: false, app_metadata: { provider: 'google' } };
  assert.equal(toAuthSession(linked).user.provider, 'google');

  // Accounts that never were guests are unchanged.
  assert.equal(toAuthSession(session()).user.provider, 'email');
  assert.equal(isGuest(null), false);
});

/* ------------------------------------------------------------ Sign in */

test('Continue as guest signs in anonymously with the Guest name as metadata', async () => {
  const sent: unknown[] = [];
  const { client } = guestAuth({
    signInAnonymously: async (credentials) => {
      sent.push(credentials);
      const s = guestSession();
      return { data: { user: s.user, session: s }, error: null };
    },
  });
  const signedIn = await client.signInAsGuest();
  assert.deepEqual(sent, [{ options: { data: { name: GUEST_NAME, full_name: GUEST_NAME } } }]);
  assert.deepEqual([signedIn.user.id, signedIn.user.provider, signedIn.user.name, signedIn.access_token], [
    GUEST_ID,
    'guest',
    'Guest',
    'guest-token',
  ]);
});

test('a session already in this browser is kept: no second guest is made', async () => {
  let created = 0;
  const signInAnonymously = async () => {
    created += 1;
    const s = guestSession();
    return { data: { user: s.user, session: s }, error: null };
  };
  const guest = guestAuth({ signInAnonymously }, guestSession());
  assert.equal((await guest.client.signInAsGuest()).user.id, GUEST_ID);
  const account = guestAuth({ signInAnonymously }, session());
  assert.equal((await account.client.signInAsGuest()).user.id, USER_ID);
  assert.equal(created, 0);
});

test('guests switched off on the server read as a clear, non-retryable message', async () => {
  const off = (error: AuthErrorLike) =>
    guestAuth({ signInAnonymously: async () => ({ data: { user: null, session: null }, error }) }).client;
  const coded = { name: 'AuthApiError', message: 'Anonymous sign-ins are disabled', code: 'anonymous_provider_disabled', status: 422 };
  const uncoded = { name: 'AuthApiError', message: 'Anonymous sign-ins are disabled', status: 422 };
  for (const error of [coded, uncoded]) {
    await assert.rejects(
      off(error).signInAsGuest(),
      (thrown) =>
        isGuestModeUnavailable(thrown) &&
        isApiError(thrown) &&
        thrown.retryable === false &&
        thrown.message === "Guest mode isn't available right now. Sign in with email instead.",
    );
    assert.equal(isGuestModeUnavailable(mapAuthError(error)), true);
  }
  // Other refusals keep their own copy.
  assert.equal(isGuestModeUnavailable(mapAuthError({ ...coded, code: 'signup_disabled' })), false);
});

test('a guest sign-in offline, or one that brings no session, fails as an ordinary error', async () => {
  const offline = guestAuth({ signInAnonymously: async () => ({ data: { user: null, session: null }, error: NETWORK }) });
  await assert.rejects(offline.client.signInAsGuest(), rejectsWith('offline'));
  const thrown = guestAuth({
    signInAnonymously: async () => {
      throw new TypeError('Network request failed');
    },
  });
  await assert.rejects(thrown.client.signInAsGuest(), rejectsWith('offline'));
  const empty = guestAuth({ signInAnonymously: async () => ({ data: { user: null, session: null }, error: null }) });
  await assert.rejects(empty.client.signInAsGuest(), (error) => isApiError(error, 'unknown') && /didn't finish/.test(error.message));
});

test('the runtime client keeps the guest signed in until sign-out', async () => {
  const { auth, state } = fakeAuth(null);
  const { client } = createRemoteRuntime(fakeDeps({ auth }));
  await client.auth.signInAsGuest();
  assert.equal(state.current?.user.is_anonymous, true);
  const stored = await client.auth.getSession();
  assert.deepEqual([stored?.user.provider, stored?.user.email], ['guest', '']);
  await client.auth.signOut();
  assert.equal(await client.auth.getSession(), null);
});

/* ------------------------------------------------------------ Upgrade */

test('saving a guest adds the email and password to the same user', async () => {
  const updates: unknown[] = [];
  const { client } = guestAuth(
    {
      updateUser: async (attributes, options) => {
        updates.push([attributes, options]);
        return { data: { user: savedUser('sam@example.com') }, error: null };
      },
    },
    guestSession(),
  );
  const saved = await client.upgradeGuest('  Sam@Example.com ', 'long enough');
  assert.deepEqual(updates, [
    [{ email: 'sam@example.com', password: 'long enough' }, { emailRedirectTo: 'hackyeah2026://auth/callback' }],
  ]);
  assert.deepEqual([saved.user.id, saved.user.provider, saved.user.email, saved.user.name, saved.access_token], [
    GUEST_ID,
    'email',
    'sam@example.com',
    'Guest',
    'guest-token',
  ]);
});

test('with email confirmation on, saving waits for the link and the account stays a guest', async () => {
  const { client } = guestAuth(
    {
      updateUser: async () => {
        const { user } = guestSession();
        return { data: { user: { ...user, new_email: 'sam@example.com' } }, error: null };
      },
    },
    guestSession(),
  );
  await assert.rejects(
    client.upgradeGuest('sam@example.com', 'long enough'),
    (error) =>
      isApiError(error, 'confirmation_required') &&
      error.message === 'Open the link we sent to sam@example.com to finish saving your account.',
  );
});

test('saving a guest maps a taken email and checks the email and password before asking', async () => {
  const taken = guestAuth(
    {
      updateUser: async () => ({
        data: { user: null },
        error: { name: 'AuthApiError', message: 'A user with this email address has already been registered', code: 'email_exists', status: 422 },
      }),
    },
    guestSession(),
  );
  await assert.rejects(taken.client.upgradeGuest('ana@example.com', 'long enough'), rejectsWith('email_taken'));

  let asked = 0;
  const counting = guestAuth(
    {
      updateUser: async () => {
        asked += 1;
        return { data: { user: savedUser('sam@example.com') }, error: null };
      },
    },
    guestSession(),
  );
  await assert.rejects(counting.client.upgradeGuest('sam@example.com', 'short'), rejectsWith('weak_password'));
  await assert.rejects(counting.client.upgradeGuest('sam@', 'long enough'), rejectsWith('validation'));
  assert.equal(asked, 0);
});

test('only a signed-in guest can be saved', async () => {
  const account = guestAuth({}, session());
  await assert.rejects(account.client.upgradeGuest('sam@example.com', 'long enough'), rejectsWith('validation'));
  const signedOut = guestAuth({}, null);
  await assert.rejects(signedOut.client.upgradeGuest('sam@example.com', 'long enough'), rejectsWith('unauthorized'));
});

/* -------------------------------------------------------- Redirect URLs */

test('web Auth links keep the base URL the app is served under', () => {
  assert.equal(
    webAppUrl('https://taqix.github.io', 'auth/callback', '/hackyeah-2026/app'),
    'https://taqix.github.io/hackyeah-2026/app/auth/callback',
  );
  assert.equal(
    webAppUrl('https://taqix.github.io/', '/auth/reset', 'hackyeah-2026/app/'),
    'https://taqix.github.io/hackyeah-2026/app/auth/reset',
  );
  assert.equal(webAppUrl('http://localhost:8081', 'auth/callback'), 'http://localhost:8081/auth/callback');
  assert.equal(webAppUrl('http://localhost:8081', 'auth/callback', ' '), 'http://localhost:8081/auth/callback');
});

/* ------------------------------------------------------------- The mock */

function mockBackend() {
  const db: MockDb = emptyDb();
  const backend = createBackend({ db: () => db, now: () => new Date(2026, 9, 7, 9, 0) });
  return { db, backend };
}

test('the mock signs in a fresh guest with no history, once per session', () => {
  const { db, backend } = mockBackend();
  const guest = backend.auth.signInAsGuest();
  assert.deepEqual([guest.user.provider, guest.user.email, guest.user.name], ['guest', '', 'Guest']);
  assert.equal(backend.preferences.get(), null, 'onboarding comes next');
  assert.equal(backend.plan.getState().status, 'none');
  assert.equal(backend.auth.signInAsGuest().user.id, guest.user.id, 'no second guest');
  assert.equal(db.accounts.length, 1);

  backend.auth.signOut();
  assert.notEqual(backend.auth.signInAsGuest().user.id, guest.user.id, 'leaving guest mode starts a new guest');
});

test('the mock saves a guest with an email it can sign in with later', () => {
  const { backend } = mockBackend();
  backend.auth.signUpWithEmail('ana@example.com', 'long enough', 'Ana');
  backend.auth.signOut();
  const guest = backend.auth.signInAsGuest();

  assert.throws(() => backend.auth.upgradeGuest('ana@example.com', 'long enough'), rejectsWith('email_taken'));
  assert.throws(() => backend.auth.upgradeGuest('sam@example.com', 'short'), rejectsWith('weak_password'));
  assert.throws(
    () => backend.auth.upgradeGuest(`sam@${CONFIRM_FIRST_DOMAIN}`, 'long enough'),
    rejectsWith('confirmation_required'),
  );
  assert.equal(backend.auth.getSession()?.user.provider, 'guest');

  const saved = backend.auth.upgradeGuest('Sam@Example.com', 'long enough');
  assert.deepEqual([saved.user.id, saved.user.provider, saved.user.email], [guest.user.id, 'email', 'sam@example.com']);
  assert.throws(() => backend.auth.upgradeGuest('other@example.com', 'long enough'), rejectsWith('validation'));

  backend.auth.signOut();
  assert.equal(backend.auth.signInWithEmail('sam@example.com', 'long enough').user.id, guest.user.id);
});
