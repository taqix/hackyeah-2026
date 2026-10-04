/**
 * The person's Google tokens, kept per Supabase user in the secure store
 * (keychain or keystore; see `secureStorage` in api/remote/default.ts), and
 * fresh access tokens from them. Supabase hands the Google tokens over once,
 * right after the Google sign-in that connected the calendar; refreshing goes
 * through the product API, which holds the OAuth client secret.
 */
import { debugLog, debugWarn, errorLabel, describeError } from '../../lib/debug-log';
import { GoogleCalendarError, isGoogleCalendarError, type StringStorage } from './types';

export interface GoogleTokens {
  access_token: string;
  /** Epoch milliseconds. */
  expires_at: number;
  /** Null when Google sent none: the access token then works until it expires, then the person reconnects. */
  refresh_token: string | null;
  /** The Google account's email, shown on Data and privacy. */
  email: string | null;
  /** Epoch milliseconds of the sign-in that stored these tokens. */
  connected_at: number;
  /** Refresh failed for good (or is unavailable): Data and privacy offers Reconnect. */
  needs_reconnect: boolean;
}

/** A new access token from POST /google/token. */
export interface RefreshedToken {
  access_token: string;
  /** Seconds. */
  expires_in: number;
}

/**
 * Trades the refresh token for a new access token. Rejects with a
 * GoogleCalendarError: `reconnect_required` when Google refuses the token or
 * refresh is unavailable, `offline` or `google` for a passing failure.
 */
export type RefreshGoogleToken = (refreshToken: string) => Promise<RefreshedToken>;

/** Google access tokens last an hour; Supabase does not say exactly when this one was issued. */
export const ASSUMED_TOKEN_LIFETIME_MS = 50 * 60_000;
/** Refresh this long before the stored expiry. */
const EXPIRY_MARGIN_MS = 60_000;

/** Secure store keys allow letters, digits, `.`, `-` and `_` only. */
export const googleTokenKey = (userId: string) => `movo.google-calendar.tokens.v1.${userId}`;

function parse(raw: string | null): GoogleTokens | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<GoogleTokens>;
    if (typeof value.access_token !== 'string' || !value.access_token) return null;
    return {
      access_token: value.access_token,
      expires_at: typeof value.expires_at === 'number' ? value.expires_at : 0,
      refresh_token: typeof value.refresh_token === 'string' && value.refresh_token ? value.refresh_token : null,
      email: typeof value.email === 'string' && value.email ? value.email : null,
      connected_at: typeof value.connected_at === 'number' ? value.connected_at : 0,
      needs_reconnect: value.needs_reconnect === true,
    };
  } catch {
    return null;
  }
}

export interface GoogleTokenStore {
  read(userId: string): Promise<GoogleTokens | null>;
  write(userId: string, tokens: GoogleTokens): Promise<void>;
  remove(userId: string): Promise<void>;
}

/** Tokens per Supabase user, so another account on the same phone never uses them. */
export function createGoogleTokenStore(storage: StringStorage): GoogleTokenStore {
  return {
    async read(userId) {
      return parse(await storage.getItem(googleTokenKey(userId)));
    },
    write: (userId, tokens) => storage.setItem(googleTokenKey(userId), JSON.stringify(tokens)),
    remove: (userId) => storage.removeItem(googleTokenKey(userId)),
  };
}

export interface GoogleAccessTokens {
  /**
   * A usable access token for this user: the stored one while it is fresh,
   * else a refreshed one. `forceRefresh` after Google answered 401.
   */
  get(userId: string, forceRefresh?: boolean): Promise<string>;
}

const reconnect = (reason: string) =>
  new GoogleCalendarError('reconnect_required', 'Reconnect Google Calendar to keep using it.', { reason });

/**
 * Fresh access tokens with one refresh in flight per user. A refresh that
 * Google refuses (or that the server cannot do) marks the tokens
 * `needs_reconnect`, so the app asks the person to reconnect instead of failing
 * quietly; a passing failure (offline) leaves them as they are.
 */
export function createGoogleAccessTokens(options: {
  store: GoogleTokenStore;
  refresh: RefreshGoogleToken;
  now: () => number;
}): GoogleAccessTokens {
  const { store, refresh, now } = options;
  const running = new Map<string, Promise<string>>();

  async function renew(userId: string, tokens: GoogleTokens): Promise<string> {
    if (!tokens.refresh_token) {
      await store.write(userId, { ...tokens, needs_reconnect: true });
      debugLog('calendar', 'google token expired and there is no refresh token: reconnect needed');
      throw reconnect('no_refresh_token');
    }
    try {
      const fresh = await refresh(tokens.refresh_token);
      const next: GoogleTokens = {
        ...tokens,
        access_token: fresh.access_token,
        expires_at: now() + fresh.expires_in * 1000,
        needs_reconnect: false,
      };
      // Disconnected meanwhile: do not bring the tokens back.
      if (!(await store.read(userId))) throw new GoogleCalendarError('not_connected', 'Google Calendar is not connected.');
      await store.write(userId, next);
      debugLog('calendar', `google token refreshed, valid ${Math.round(fresh.expires_in / 60)} min`);
      return next.access_token;
    } catch (error) {
      if (isGoogleCalendarError(error, 'reconnect_required')) {
        const current = await store.read(userId);
        if (current) await store.write(userId, { ...current, needs_reconnect: true });
        debugWarn('calendar', `✕ google token refresh: reconnect needed (${error.reason ?? 'refused'})`);
      } else {
        debugWarn('calendar', `✕ google token refresh ${errorLabel(error)}`, () => describeError(error));
      }
      throw error;
    }
  }

  return {
    async get(userId, forceRefresh = false) {
      const tokens = await store.read(userId);
      if (!tokens) throw new GoogleCalendarError('not_connected', 'Google Calendar is not connected.');
      if (tokens.needs_reconnect) throw reconnect('marked');
      if (!forceRefresh && tokens.expires_at - EXPIRY_MARGIN_MS > now()) return tokens.access_token;
      const pending = running.get(userId);
      if (pending) return pending;
      const next = renew(userId, tokens).finally(() => running.delete(userId));
      running.set(userId, next);
      return next;
    },
  };
}
