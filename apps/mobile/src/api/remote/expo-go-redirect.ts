/**
 * Google can't send the person back to Expo Go on an IP address.
 *
 * Expo Go builds the app's links from the dev server's host
 * (`Linking.createURL('auth/callback')` → `exp://<host>:8081/--/auth/callback`).
 * A plain `expo start` uses the computer's LAN IP as that host. Supabase Auth
 * refuses any redirect whose host is a raw IP address, even one written out
 * exactly in the allowlist, and sends the browser to the Site URL instead
 * (`http://localhost:3000`): "This site can't be reached". The same link with
 * a hostname passes the `exp://**` allowlist entry: `npm run start:hostname`
 * (`<ip>.nip.io`), `expo start --tunnel` (`*.exp.direct`), or a development
 * build (`hackyeah2026://`). So Google sign-in and the Google Calendar connect
 * stop before opening the browser and say how to start the app instead.
 *
 * Pure: no React Native, so Node tests import it.
 */
import { ApiError } from '../types';

const HOW_TO_FIX = 'Start the app with npm run start:hostname, use --tunnel, or use the dev build.';

/** Continue with Google, from Expo Go on an IP address. */
export const EXPO_GO_IP_SIGN_IN = `Google sign-in can't return to Expo Go on an IP address. ${HOW_TO_FIX}`;
/** Connect Google Calendar, from Expo Go on an IP address. */
export const EXPO_GO_IP_CALENDAR = `Google Calendar can't return to Expo Go on an IP address. ${HOW_TO_FIX}`;

const OCTET = '(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)';
const IPV4 = new RegExp(`^${OCTET}(?:\\.${OCTET}){3}$`);
/** Hex groups and colons, maybe an IPv4 tail (`::ffff:10.0.0.1`) and a zone (`%en0`). */
const IPV6 = /^[0-9a-f:.]*:[0-9a-f:.]*(?:%[\w.-]+)?$/i;

/** Whether a URL host is an IP literal: IPv4 (`10.0.0.5`) or IPv6, bracketed (`[::1]`) or not. */
export function isIpLiteral(host: string): boolean {
  const bare = host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
  return IPV4.test(bare) || (bare.includes(':') && IPV6.test(bare));
}

/** The host of an Expo Go link (`exp://` or `exps://`), without its port; null for any other URL. */
export function expoGoHost(url: string): string | null {
  const match = /^exps?:\/\/([^/?#]*)/i.exec(url.trim());
  if (!match) return null;
  const authority = match[1].slice(match[1].lastIndexOf('@') + 1);
  if (authority.startsWith('[')) {
    const end = authority.indexOf(']');
    return end >= 0 ? authority.slice(0, end + 1) : authority;
  }
  const colons = authority.split(':').length - 1;
  // More than one colon without brackets can only be a bare IPv6 address.
  if (colons > 1) return authority;
  return colons === 1 ? authority.slice(0, authority.indexOf(':')) : authority;
}

/** Whether a redirect is Expo Go's on an IP address: one Supabase Auth refuses. */
export function isExpoGoIpRedirect(url: string): boolean {
  const host = expoGoHost(url);
  return host !== null && isIpLiteral(host);
}

/** Google can't come back to this Expo Go link. Not retryable: the app has to be started differently. */
export class ExpoGoIpRedirectError extends ApiError {
  constructor(message: string) {
    super('validation', message, { retryable: false });
    this.name = 'ExpoGoIpRedirectError';
  }
}

export const isExpoGoIpRedirectError = (error: unknown): error is ExpoGoIpRedirectError =>
  error instanceof ExpoGoIpRedirectError;

/** Rejects before the browser opens when Google could not return to `redirectTo`. */
export function checkGoogleRedirect(redirectTo: string, message: string): void {
  if (isExpoGoIpRedirect(redirectTo)) throw new ExpoGoIpRedirectError(message);
}
