/**
 * The name people are greeted by: given at sign-up (Auth metadata), kept as the
 * profile's username, read back for older accounts, and changed in Settings.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { apiSchemas } from '../../../../packages/contracts/src/product';
import { createRemoteAuth, keepKnownName, toAuthSession } from '../../src/api/remote/auth';
import { createRemoteRuntime } from '../../src/api/remote/client';
import type { RemoteContext } from '../../src/api/remote/context';
import type { AuthErrorLike, AuthPort, AuthResult, AuthSessionData } from '../../src/api/remote/deps';
import { isApiError, type ApiErrorCode, type Preferences } from '../../src/api/types';
import { NAME_MISSING, NAME_TOO_LONG } from '../../src/lib/person-name';
import { fakeAuth, fakeDeps, session, USER_ID } from './fakes';
import { fakeServer, PREFERENCES } from './plan-fakes';

const rejectsWith = (code: ApiErrorCode, message?: string) => (error: unknown) =>
  isApiError(error, code) && (message === undefined || error.message === message);

const answer = (s: AuthSessionData): AuthResult => ({ data: { user: s.user, session: s }, error: null });

/** A session whose user metadata holds `metadata`. */
function sessionWith(metadata: Record<string, unknown>, userId = USER_ID): AuthSessionData {
  const s = session(userId);
  s.user.user_metadata = metadata;
  return s;
}

/** A runtime over the fake product API and a fake Auth that records updateUser calls. */
function runtimeWith(server: ReturnType<typeof fakeServer>, current: AuthSessionData = session()) {
  const { auth, state } = fakeAuth(current);
  const updates: unknown[] = [];
  auth.updateUser = async (attributes) => {
    updates.push(attributes);
    if (state.current && attributes.data) {
      state.current.user.user_metadata = { ...state.current.user.user_metadata, ...attributes.data };
    }
    return { data: { user: state.current?.user ?? null }, error: null };
  };
  const runtime = createRemoteRuntime(fakeDeps({ auth, fetch: server.fetch }));
  return { ...runtime, auth, updates, server };
}

const profileReads = (server: ReturnType<typeof fakeServer>) =>
  server.requests.filter((r) => r.method === 'GET' && r.path === '/profile').length;

/* -------------------------------------------------------------- Sign-up */

test('sign-up puts the trimmed name in the Auth metadata, and the session greets by it', async () => {
  const sent: Parameters<AuthPort['signUp']>[0][] = [];
  const { auth } = fakeAuth();
  auth.signUp = async (credentials) => {
    sent.push(credentials);
    return answer(sessionWith({ ...(credentials.options?.data ?? {}) }));
  };
  const client = createRemoteAuth({ deps: fakeDeps({ auth }), data: {} } as unknown as RemoteContext);

  const signedUp = await client.signUpWithEmail('ana@example.com', 'long enough', '  Ana Kowalska ');
  assert.deepEqual(sent[0].options, {
    emailRedirectTo: 'hackyeah2026://auth/callback',
    data: { name: 'Ana Kowalska', full_name: 'Ana Kowalska' },
  });
  assert.equal(signedUp.user.name, 'Ana Kowalska');
});

test('sign-up rejects an empty or too long name with validation before calling Auth', async () => {
  let calls = 0;
  const { auth } = fakeAuth();
  auth.signUp = async () => {
    calls += 1;
    return answer(session());
  };
  const client = createRemoteAuth({ deps: fakeDeps({ auth }), data: {} } as unknown as RemoteContext);

  await assert.rejects(client.signUpWithEmail('ana@example.com', 'long enough', ''), rejectsWith('validation', NAME_MISSING));
  await assert.rejects(client.signUpWithEmail('ana@example.com', 'long enough', '   '), rejectsWith('validation', NAME_MISSING));
  await assert.rejects(
    client.signUpWithEmail('ana@example.com', 'long enough', 'a'.repeat(51)),
    rejectsWith('validation', NAME_TOO_LONG),
  );
  // 50 characters as people count them: an emoji is one, though it takes two code units.
  await client.signUpWithEmail('ana@example.com', 'long enough', '🙂'.repeat(50));
  assert.equal(calls, 1);
});

/* ------------------------------------------------------ Session mapping */

test('the session prefers the metadata name and reads no profile for it', async () => {
  assert.equal(toAuthSession(sessionWith({ name: 'Ana' })).user.name, 'Ana');
  assert.equal(toAuthSession(sessionWith({ full_name: 'Ana Kowalska', name: 'Ana' })).user.name, 'Ana Kowalska');

  const server = fakeServer();
  const { client } = runtimeWith(server, sessionWith({ name: 'Ola' }));
  assert.equal((await client.auth.getSession())?.user.name, 'Ola');
  assert.equal(profileReads(server), 0);
});

test('without a metadata name, the session and the account fall back to the profile username', async () => {
  const server = fakeServer();
  server.state.profile = { id: USER_ID, username: ' Ana ', created_at: null, preferences: PREFERENCES };
  const { client } = runtimeWith(server);
  assert.equal((await client.auth.getSession())?.user.name, 'Ana');
  assert.equal((await client.account.get()).user.name, 'Ana');
  assert.equal((await client.auth.signInWithEmail('ana@example.com', 'long enough')).user.name, 'Ana');
});

test('a profile that cannot be read leaves the session without a name instead of failing', async () => {
  const missing = runtimeWith(fakeServer({ profile: null }));
  assert.equal((await missing.client.auth.getSession())?.user.name, null);

  const { auth } = fakeAuth();
  const offline = createRemoteRuntime(
    fakeDeps({
      auth,
      fetch: async () => {
        throw new TypeError('Network request failed');
      },
    }),
  );
  const s = await offline.client.auth.getSession();
  assert.deepEqual([s?.user.id, s?.user.name], [USER_ID, null]);
});

test('an Auth event keeps the name already shown for the same person only', () => {
  const shown = { ...toAuthSession(session()), user: { ...toAuthSession(session()).user, name: 'Ana' } };
  assert.equal(keepKnownName(toAuthSession(session()), shown).user.name, 'Ana', 'token refresh keeps it');
  assert.equal(keepKnownName(toAuthSession(sessionWith({ name: 'Ola' })), shown).user.name, 'Ola', 'new metadata wins');
  const other = toAuthSession(session('00000000-0000-4000-8000-000000000099'));
  assert.equal(keepKnownName(other, shown).user.name, null, 'another account never inherits it');
  assert.equal(keepKnownName(toAuthSession(session()), null).user.name, null);
});

/* ---------------------------------------------- Profile username on save */

const APP_PREFERENCES: Preferences = {
  timezone: 'Europe/Warsaw',
  starting_comfort: 'starting_out',
  sessions_per_week: 3,
  session_minutes: 20,
  preferred_window: [7, 11],
  activity_interests: ['walking'],
  discovery_preference: 'occasional',
  available_locations: ['outdoors'],
  available_equipment: [],
  avoidances: [],
  starting_obstacles: ['time'],
  excluded_activity_types: [],
};

test('the first save of the answers writes the sign-up name as the username; a saved one is kept', async () => {
  const fresh = fakeServer();
  fresh.state.profile = { id: USER_ID, username: null, created_at: null, preferences: null };
  const { client } = runtimeWith(fresh, sessionWith({ name: 'Ana', full_name: 'Ana' }));
  await client.preferences.save(APP_PREFERENCES);
  const put = fresh.requests.find((r) => r.method === 'PUT' && r.path === '/profile');
  assert.equal((put?.body as { username: unknown }).username, 'Ana');
  assert.ok(apiSchemas.UpdateProfileDto.safeParse(put?.body).success);

  const kept = fakeServer();
  await runtimeWith(kept, sessionWith({ name: 'Someone else' })).client.preferences.save(APP_PREFERENCES);
  const keptPut = kept.requests.find((r) => r.method === 'PUT' && r.path === '/profile');
  assert.equal((keptPut?.body as { username: unknown }).username, 'ana');

  const nameless = fakeServer();
  nameless.state.profile = { id: USER_ID, username: null, created_at: null, preferences: null };
  await runtimeWith(nameless).client.preferences.save(APP_PREFERENCES);
  const namelessPut = nameless.requests.find((r) => r.method === 'PUT' && r.path === '/profile');
  assert.equal((namelessPut?.body as { username: unknown }).username, null);
});

/* ------------------------------------- Google and a server-filled username */

/** A Google session: provider google, Google's names in the metadata. */
function googleSessionWith(metadata: Record<string, unknown>): AuthSessionData {
  const s = sessionWith(metadata);
  s.user.app_metadata = { provider: 'google' };
  return s;
}

const usernameSent = (server: ReturnType<typeof fakeServer>) =>
  (server.requests.find((r) => r.method === 'PUT' && r.path === '/profile')?.body as { username: unknown } | undefined)
    ?.username;

test("a Google account is greeted by Google's name, and the first save stores it when the profile has none", async () => {
  const server = fakeServer();
  server.state.profile = { id: USER_ID, username: null, created_at: null, preferences: null };
  const { client } = runtimeWith(server, googleSessionWith({ full_name: 'Sam Doe', name: 'Sam', avatar_url: 'x' }));
  const signedIn = await client.auth.getSession();
  assert.deepEqual([signedIn?.user.provider, signedIn?.user.name], ['google', 'Sam Doe']);
  assert.equal(profileReads(server), 0, "Google's name needs no profile read");

  await client.preferences.save(APP_PREFERENCES);
  assert.equal(usernameSent(server), 'Sam Doe');
  assert.equal(server.state.profile?.username, 'Sam Doe');
});

test('a username the server filled in at sign-up is kept on every save, never replaced or nulled', async () => {
  // The server copied the metadata name into the profile at sign-up; the metadata may differ or be gone since.
  for (const metadata of [{ full_name: 'Samuel Doe' }, {}]) {
    const server = fakeServer();
    server.state.profile = { id: USER_ID, username: 'Sam Doe', created_at: null, preferences: null };
    const { client } = runtimeWith(server, googleSessionWith(metadata));
    await client.preferences.save(APP_PREFERENCES);
    assert.equal(usernameSent(server), 'Sam Doe', JSON.stringify(metadata));

    // Later saves (Profile › Edit, switching a sport off) keep it too.
    await client.preferences.save({ ...APP_PREFERENCES, sessions_per_week: 2 });
    await client.profile.setSportExcluded('walking', true);
    const puts = server.requests.filter((r) => r.method === 'PUT' && r.path === '/profile');
    assert.deepEqual(
      puts.map((r) => (r.body as { username: unknown }).username),
      ['Sam Doe', 'Sam Doe', 'Sam Doe'],
    );
    for (const put of puts) assert.ok(apiSchemas.UpdateProfileDto.safeParse(put.body).success);
    assert.equal(server.state.profile?.username, 'Sam Doe');
  }
});

test('a blank stored username gives way to the session name; a long one is cut to fit, never dropped', async () => {
  const blank = fakeServer();
  blank.state.profile = { id: USER_ID, username: '   ', created_at: null, preferences: null };
  await runtimeWith(blank, googleSessionWith({ name: 'Sam' })).client.preferences.save(APP_PREFERENCES);
  assert.equal(usernameSent(blank), 'Sam');

  const long = fakeServer();
  long.state.profile = { id: USER_ID, username: `  ${'a'.repeat(199)}🙂🙂 `, created_at: null, preferences: null };
  await runtimeWith(long).client.preferences.save(APP_PREFERENCES);
  const sent = usernameSent(long);
  assert.equal(sent, 'a'.repeat(199), 'cut before the emoji it would split');
  const put = long.requests.find((r) => r.method === 'PUT' && r.path === '/profile');
  assert.ok(apiSchemas.UpdateProfileDto.safeParse(put?.body).success);

  const googleLong = fakeServer();
  googleLong.state.profile = { id: USER_ID, username: null, created_at: null, preferences: null };
  await runtimeWith(googleLong, googleSessionWith({ full_name: 'B'.repeat(250) })).client.preferences.save(APP_PREFERENCES);
  assert.equal(usernameSent(googleLong), 'B'.repeat(200));
});

/* ------------------------------------------------------------- Settings */

test('updateName saves the username with the whole profile document, then the Auth metadata', async () => {
  const server = fakeServer();
  const { client, updates } = runtimeWith(server);
  assert.equal(await client.account.updateName('  Ola  '), 'Ola');

  const puts = server.requests.filter((r) => r.method === 'PUT' && r.path === '/profile');
  assert.deepEqual(
    puts.map((r) => r.body),
    [{ username: 'Ola', preferences: PREFERENCES }],
  );
  assert.ok(apiSchemas.UpdateProfileDto.safeParse(puts[0].body).success);
  assert.deepEqual(updates, [{ data: { name: 'Ola', full_name: 'Ola' } }]);
  assert.equal((await client.auth.getSession())?.user.name, 'Ola');
  assert.equal((await client.account.get()).user.name, 'Ola');
  assert.equal(server.state.profile?.username, 'Ola');
});

test('before onboarding there is no document to replace: updateName sets the metadata only', async () => {
  const server = fakeServer();
  server.state.profile = { id: USER_ID, username: null, created_at: null, preferences: null };
  const { client, updates } = runtimeWith(server);
  await client.account.updateName('Ola');
  assert.equal(server.requests.filter((r) => r.method === 'PUT').length, 0);
  assert.deepEqual(updates, [{ data: { name: 'Ola', full_name: 'Ola' } }]);
});

test('updateName rejects an empty or too long name with validation and changes nothing', async () => {
  const server = fakeServer();
  const { client, updates } = runtimeWith(server);
  await assert.rejects(client.account.updateName(' '), rejectsWith('validation', NAME_MISSING));
  await assert.rejects(client.account.updateName('x'.repeat(51)), rejectsWith('validation', NAME_TOO_LONG));
  assert.equal(server.requests.length, 0);
  assert.equal(updates.length, 0);
});

test('updateName rejects when Auth refuses or is unreachable', async () => {
  const refused: AuthErrorLike = { name: 'AuthApiError', message: 'expired', code: 'session_not_found', status: 403 };
  const server = fakeServer();
  const { client, auth } = runtimeWith(server);
  auth.updateUser = async () => ({ data: { user: null }, error: refused });
  await assert.rejects(client.account.updateName('Ola'), rejectsWith('unauthorized'));

  auth.updateUser = async () => {
    throw new TypeError('Network request failed');
  };
  await assert.rejects(client.account.updateName('Ola'), rejectsWith('offline'));
});
