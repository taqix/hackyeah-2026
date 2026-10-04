/**
 * `npm run start:hostname`: `expo start` with the Mac's LAN IP as a nip.io
 * hostname (`10.0.0.5` → `10.0.0.5.nip.io`, which public DNS resolves back to
 * `10.0.0.5`), so Expo Go's links become `exp://10.0.0.5.nip.io:8081/--/…`.
 *
 * Why: Supabase Auth refuses any redirect whose host is a raw IP address, even
 * one on the allowlist, and sends Google's answer to the Site URL
 * (`http://localhost:3000`) instead. A hostname passes the `exp://**`
 * allowlist entry. Extra arguments go to `expo start` (`-- --clear`).
 * Fallbacks: `npx expo start --tunnel`, or the development build
 * (`hackyeah2026://`).
 */
/* global __dirname */
const { spawn } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');

/** Wi-Fi and Ethernet on a Mac come first. */
const PREFERRED = ['en0', 'en1'];

const isIPv4 = (entry) => entry.family === 'IPv4' || entry.family === 4;
const isLinkLocal = (address) => address.startsWith('169.254.');

/**
 * The LAN IPv4 address other devices reach this computer on: en0, then en1,
 * then any other interface; never loopback, internal or link-local addresses.
 * Null when there is none (no network).
 */
function pickLanAddress(interfaces = os.networkInterfaces()) {
  const names = Object.keys(interfaces).sort((a, b) => {
    const rank = (name) => (PREFERRED.includes(name) ? PREFERRED.indexOf(name) : PREFERRED.length);
    return rank(a) - rank(b);
  });
  for (const name of names) {
    for (const entry of interfaces[name] ?? []) {
      if (isIPv4(entry) && !entry.internal && !isLinkLocal(entry.address)) return entry.address;
    }
  }
  return null;
}

/** `10.0.0.5` → `10.0.0.5.nip.io`. */
const nipHostname = (address) => `${address}.nip.io`;

function main(args) {
  const preset = process.env.REACT_NATIVE_PACKAGER_HOSTNAME?.trim();
  const address = preset ? null : pickLanAddress();
  const hostname = preset || (address && nipHostname(address));
  if (!hostname) {
    console.error(
      'No LAN address found. Connect to Wi-Fi, or run `npx expo start --tunnel` (or the dev build) for Google sign-in.',
    );
    process.exit(1);
  }
  console.log(
    `Expo Go on ${hostname}: Supabase refuses Google's redirect to a raw IP address, so Expo Go uses this hostname instead. If the phone can't load the app, use \`npx expo start --tunnel\` or the dev build.`,
  );

  const expo = require.resolve('expo/bin/cli', { paths: [path.resolve(__dirname, '..')] });
  const child = spawn(process.execPath, [expo, 'start', ...args], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, REACT_NATIVE_PACKAGER_HOSTNAME: hostname },
    stdio: 'inherit',
  });
  // Ctrl+C reaches Expo from the terminal itself; wait for it to shut down. Pass on a plain kill.
  process.on('SIGINT', () => undefined);
  process.on('SIGTERM', () => child.kill('SIGTERM'));
  child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
}

if (require.main === module) main(process.argv.slice(2));

module.exports = { pickLanAddress, nipHostname };
