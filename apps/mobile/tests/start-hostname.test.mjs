import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const { pickLanAddress, nipHostname } = require('../scripts/start-hostname.cjs');

const v4 = (address, internal = false) => ({ address, family: 'IPv4', internal, netmask: '255.255.255.0', mac: '', cidr: null });
const v6 = (address) => ({ address, family: 'IPv6', internal: false, netmask: 'ffff::', mac: '', cidr: null, scopeid: 0 });

test("start:hostname serves Expo Go on the Mac's Wi-Fi or Ethernet address first", () => {
  assert.equal(
    pickLanAddress({
      lo0: [v4('127.0.0.1', true), v6('::1')],
      utun3: [v4('100.64.0.7')],
      en1: [v4('192.168.1.40')],
      en0: [v6('fe80::1'), v4('10.250.163.235')],
    }),
    '10.250.163.235',
  );
  assert.equal(pickLanAddress({ bridge100: [v4('192.168.64.1')], en1: [v4('192.168.1.40')] }), '192.168.1.40');
});

test('start:hostname skips loopback, link-local and IPv6 addresses, and finds none offline', () => {
  assert.equal(pickLanAddress({ en0: [v4('169.254.10.2'), v6('2001:db8::7')], en5: [v4('172.20.10.3')] }), '172.20.10.3');
  assert.equal(pickLanAddress({ lo0: [v4('127.0.0.1', true)], en0: [v4('169.254.1.1')] }), null);
  assert.equal(pickLanAddress({}), null);
  // Older Node reports the family as a number.
  assert.equal(pickLanAddress({ en0: [{ ...v4('10.0.0.5'), family: 4 }] }), '10.0.0.5');
});

test('the hostname is the address under nip.io, which resolves back to it', () => {
  assert.equal(nipHostname('10.250.163.235'), '10.250.163.235.nip.io');
});
