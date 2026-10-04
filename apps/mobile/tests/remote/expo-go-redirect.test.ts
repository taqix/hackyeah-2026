/**
 * Supabase Auth refuses redirects to a raw IP address, so Google can't return
 * to Expo Go started on a LAN IP. The app spots those links before opening Google.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  checkGoogleRedirect,
  EXPO_GO_IP_SIGN_IN,
  expoGoHost,
  isExpoGoIpRedirect,
  isExpoGoIpRedirectError,
  isIpLiteral,
} from '../../src/api/remote/expo-go-redirect';
import { isApiError } from '../../src/api/types';

test('IPv4 and IPv6 literals are IP addresses; hostnames are not', () => {
  for (const host of ['10.250.163.235', '127.0.0.1', '192.168.1.20', '0.0.0.0', '[::1]', '::1', '[fe80::1%en0]', '[::ffff:10.0.0.1]', '2001:db8::7']) {
    assert.equal(isIpLiteral(host), true, host);
  }
  for (const host of [
    '10.250.163.235.nip.io',
    'abc-anonymous-8081.exp.direct',
    'localhost',
    'my-mac.local',
    '256.1.1.1',
    '10.0.0',
    '010.0.0.1',
    '',
  ]) {
    assert.equal(isIpLiteral(host), false, host);
  }
});

test("an Expo Go link's host leaves out the port and any user info; other schemes have none", () => {
  assert.equal(expoGoHost('exp://10.250.163.235:8081/--/auth/callback'), '10.250.163.235');
  assert.equal(expoGoHost('exps://abc.exp.direct/--/auth/callback'), 'abc.exp.direct');
  assert.equal(expoGoHost('EXP://[fe80::1]:8081/--/auth/callback'), '[fe80::1]');
  assert.equal(expoGoHost('exp://user@10.0.0.5:8081/--/auth/callback'), '10.0.0.5');
  assert.equal(expoGoHost('hackyeah2026://auth/callback'), null);
  assert.equal(expoGoHost('http://localhost:8081/auth/callback'), null);
});

test('only Expo Go links on an IP address are refused', () => {
  const refused = [
    'exp://10.250.163.235:8081/--/auth/callback',
    'exp://127.0.0.1:8081/--/auth/callback',
    'exps://192.168.0.2/--/auth/callback',
    'exp://[::1]:8081/--/auth/callback',
    'exp://[2001:db8::7]:8081/--/auth/callback',
  ];
  const accepted = [
    'exp://10.250.163.235.nip.io:8081/--/auth/callback',
    'exp://abc-anonymous-8081.exp.direct/--/auth/callback',
    'exp://localhost:8081/--/auth/callback',
    'hackyeah2026://auth/callback',
    'http://localhost:8081/auth/callback',
    // An IP on the web or in a build is not Expo Go's problem.
    'http://192.168.1.20:8081/auth/callback',
  ];
  for (const url of refused) assert.equal(isExpoGoIpRedirect(url), true, url);
  for (const url of accepted) assert.equal(isExpoGoIpRedirect(url), false, url);
});

test('the check rejects with a validation error that says how to start the app', () => {
  assert.doesNotThrow(() => checkGoogleRedirect('exp://10.0.0.5.nip.io:8081/--/auth/callback', EXPO_GO_IP_SIGN_IN));
  assert.throws(
    () => checkGoogleRedirect('exp://10.0.0.5:8081/--/auth/callback', EXPO_GO_IP_SIGN_IN),
    (error) =>
      isExpoGoIpRedirectError(error) &&
      isApiError(error, 'validation') &&
      !error.retryable &&
      /npm run start:hostname/.test(error.message) &&
      /--tunnel/.test(error.message) &&
      /dev build/.test(error.message),
  );
});
