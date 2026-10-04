import type { ApiClient } from '../client';
import { ApiError, type AuthProviders, type AuthSession } from '../types';
import type { RemoteContext } from './context';
import type { AuthErrorLike, AuthPort, AuthSessionData, RemoteDeps } from './deps';
import { defaultErrorMessage } from './http';

/** Deep-link paths the Auth emails and Google return to (`deps.redirectUrl`). */
export const CALLBACK_PATH = 'auth/callback';
export const RESET_PATH = 'auth/reset';

const MIN_PASSWORD_LENGTH = 8;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SETTINGS_TIMEOUT_MS = 8_000;

const EMAIL_FORMAT = 'Enter an email address like name@example.com.';
const CONFIRM_FIRST = 'Confirm your email first. Open the link we sent you, then sign in.';
const LINK_EXPIRED = 'This link has expired or was opened on another device. Ask for a new one.';
const TOO_MANY_TRIES = 'Too many tries for now. Wait a minute, then try again.';
const NOT_FINISHED = "Sign-in didn't finish. Try again.";

/**
 * The person closed the Google sheet or declined on Google's page. Not a
 * failure: the hooks turn it into "nothing happened", so no error is shown.
 */
export class SignInCancelled extends ApiError {
  constructor() {
    super('unknown', 'Sign-in was cancelled.', { retryable: false });
    this.name = 'SignInCancelled';
  }
}

export const isSignInCancelled = (error: unknown): error is SignInCancelled => error instanceof SignInCancelled;

/* -------------------------------------------------------------- Mapping */

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value.trim() : null);

/** A Supabase session as the app's AuthSession: the name comes from Google's metadata, if any. */
export function toAuthSession(session: AuthSessionData): AuthSession {
  const { user } = session;
  return {
    user: {
      id: user.id,
      email: user.email ?? '',
      name: text(user.user_metadata.full_name) ?? text(user.user_metadata.name),
      provider: user.app_metadata.provider === 'google' ? 'google' : 'email',
      created_at: user.created_at,
    },
    access_token: session.access_token,
  };
}

const LINK_CODES = new Set([
  'flow_state_not_found',
  'flow_state_expired',
  'bad_code_verifier',
  'otp_expired',
  'bad_oauth_state',
  'bad_oauth_callback',
]);
const SESSION_CODES = new Set([
  'session_not_found',
  'session_expired',
  'refresh_token_not_found',
  'refresh_token_already_used',
  'bad_jwt',
  'no_authorization',
  'user_not_found',
  'reauthentication_needed',
]);
const LINK_ERRORS = new Set(['AuthPKCECodeVerifierMissingError', 'AuthPKCEGrantCodeExchangeError']);

function isAuthErrorLike(error: unknown): error is AuthErrorLike {
  return typeof error === 'object' && error !== null && typeof (error as { message?: unknown }).message === 'string';
}

/** supabase-js couldn't reach Auth (as opposed to Auth answering no). */
const isNetworkError = (error: AuthErrorLike | null | undefined) =>
  !!error && (error.name === 'AuthRetryableFetchError' || error.status === 0 || error.name === 'TypeError');

/**
 * A supabase-js AuthError (or a thrown network failure) as an ApiError the
 * screens understand. Codes come from Supabase Auth's `error.code`; older
 * answers without a code are matched by status and message.
 */
export function mapAuthError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  const make = (code: ApiError['code'], message = defaultErrorMessage(code), retryable?: boolean) =>
    new ApiError(code, message, { cause: error, retryable });
  if (!isAuthErrorLike(error)) return make('unknown');
  const { name, code, status, message } = error;

  if (isNetworkError(error)) return make('offline');
  if (code === 'invalid_credentials' || (!code && /invalid login credentials/i.test(message))) {
    return make('invalid_credentials');
  }
  if (code === 'weak_password' || name === 'AuthWeakPasswordError') return make('weak_password');
  if (code === 'user_already_exists' || code === 'email_exists' || code === 'identity_already_exists') {
    return make('email_taken');
  }
  if (code === 'email_not_confirmed') return make('confirmation_required', CONFIRM_FIRST);
  if (code === 'same_password') return make('validation', "That's your current password. Pick a new one.");
  if (code === 'email_address_invalid' || code === 'validation_failed') return make('validation', EMAIL_FORMAT);
  if (code === 'email_address_not_authorized') return make('validation', "We can't send email to this address yet.");
  if ((code && LINK_CODES.has(code)) || (name && LINK_ERRORS.has(name))) return make('unauthorized', LINK_EXPIRED);
  if ((code && SESSION_CODES.has(code)) || name === 'AuthSessionMissingError') return make('unauthorized');
  if (code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit' || status === 429) {
    return make('unknown', TOO_MANY_TRIES, true);
  }
  if (code === 'signup_disabled' || code === 'email_provider_disabled') {
    return make('unknown', "New accounts can't be created right now.");
  }
  return make('unknown', defaultErrorMessage('unknown'), status !== undefined && status >= 500);
}

/** Runs an Auth call; a rejection (network failure, missing config) becomes an ApiError. */
async function call<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    throw mapAuthError(error);
  }
}

/**
 * The stored session (supabase-js refreshes it when it is about to expire),
 * or null when signed out. Offline with an expired token it rejects with
 * offline rather than reading as signed out.
 */
export async function readSession(auth: AuthPort): Promise<AuthSession | null> {
  const { data, error } = await call(() => auth.getSession());
  if (isNetworkError(error)) throw mapAuthError(error);
  return data.session ? toAuthSession(data.session) : null;
}

/* ------------------------------------------------------------ Redirects */

export interface AuthRedirectParams {
  code: string | null;
  /** `error` or `error_code` from Supabase or Google, e.g. access_denied, otp_expired. */
  error: string | null;
  errorDescription: string | null;
}

/** Reads the PKCE code or the error from a redirect URL (query or fragment). */
export function authRedirectParams(url: string): AuthRedirectParams {
  const hashAt = url.indexOf('#');
  const beforeHash = hashAt >= 0 ? url.slice(0, hashAt) : url;
  const queryAt = beforeHash.indexOf('?');
  const parts = [queryAt >= 0 ? beforeHash.slice(queryAt + 1) : '', hashAt >= 0 ? url.slice(hashAt + 1) : ''];
  const lists = parts.map((part) => new URLSearchParams(part));
  const read = (key: string) => lists.map((list) => list.get(key)).find((value) => !!value) ?? null;
  return {
    code: read('code'),
    error: read('error_code') ?? read('error'),
    errorDescription: read('error_description'),
  };
}

/** Which auth screen a deep link opens, if any: `…/auth/callback` or `…/auth/reset`. */
export function authLinkKind(url: string): 'callback' | 'reset' | null {
  const match = /(?:^|[/:])auth\/(callback|reset)\/?(?:[?#]|$)/.exec(url);
  return match ? (match[1] as 'callback' | 'reset') : null;
}

const exchanges = new WeakMap<AuthPort, Map<string, Promise<AuthSessionData>>>();

/**
 * Trades a PKCE code for a session, once per code: Google's return, the deep
 * link listener and the callback screen may all see the same code, and a code
 * works only once. On web, supabase-js may already have traded it while
 * loading the page (detectSessionInUrl); the session it saved then counts.
 */
export function exchangeAuthCode(
  auth: AuthPort,
  code: string,
  platform: RemoteDeps['platform'],
): Promise<AuthSessionData> {
  const byCode = exchanges.get(auth) ?? new Map<string, Promise<AuthSessionData>>();
  exchanges.set(auth, byCode);
  const running = byCode.get(code);
  if (running) return running;

  const exchange = (async () => {
    const { data, error } = await call(() => auth.exchangeCodeForSession(code));
    if (!error && data.session) return data.session;
    if (platform === 'web') {
      const current = await call(() => auth.getSession());
      if (current.data.session) return current.data.session;
    }
    throw mapAuthError(error ?? { name: 'AuthSessionMissingError', message: 'No session' });
  })();
  byCode.set(code, exchange);
  // Offline, the code is still unused: let a later attempt try it again.
  exchange.catch(() => byCode.delete(code));
  return exchange;
}

/**
 * Finishes an Auth redirect (Google, email confirmation, password recovery)
 * from its URL parameters. Without a code, a session saved meanwhile (web)
 * still counts.
 */
export async function completeAuthRedirect(
  auth: AuthPort,
  params: AuthRedirectParams,
  platform: RemoteDeps['platform'],
): Promise<AuthSession> {
  if (params.error === 'access_denied') throw new SignInCancelled();
  if (params.error) {
    const expired = LINK_CODES.has(params.error);
    throw new ApiError(expired ? 'unauthorized' : 'unknown', expired ? LINK_EXPIRED : NOT_FINISHED, {
      cause: params,
    });
  }
  if (params.code) return toAuthSession(await exchangeAuthCode(auth, params.code, platform));
  const { data, error } = await call(() => auth.getSession());
  if (isNetworkError(error)) throw mapAuthError(error);
  if (data.session) return toAuthSession(data.session);
  throw new ApiError('unauthorized', LINK_EXPIRED);
}

/* ------------------------------------------------------------- Settings */

/** GET {supabaseUrl}/auth/v1/settings: which providers the project has switched on. */
async function readProviders(deps: RemoteDeps): Promise<AuthProviders | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SETTINGS_TIMEOUT_MS);
  try {
    const response = await deps.fetch(`${deps.supabaseUrl}/auth/v1/settings`, {
      method: 'GET',
      headers: { apikey: deps.publishableKey },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const body = JSON.parse(await response.text()) as { external?: { google?: unknown } };
    const google = body.external?.google;
    return typeof google === 'boolean' ? { google } : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/* --------------------------------------------------------------- Client */

function validEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!EMAIL.test(normalized)) throw new ApiError('validation', EMAIL_FORMAT);
  return normalized;
}

function checkPassword(password: string) {
  if (password.length < MIN_PASSWORD_LENGTH) throw new ApiError('weak_password', defaultErrorMessage('weak_password'));
}

/**
 * Supabase Auth (`ctx.deps.auth`): email and password, Google through PKCE
 * (`deps.openAuthSession`, `deps.redirectUrl('auth/callback')`), password
 * reset and the new password, providers from GET {supabaseUrl}/auth/v1/settings
 * (`deps.fetch` with the publishable key), and sign-out, which also
 * `ctx.data.reset()`s.
 */
export function createRemoteAuth(ctx: RemoteContext): ApiClient['auth'] {
  const { deps } = ctx;
  const { auth } = deps;
  let providers: AuthProviders | null = null;

  return {
    getSession: () => readSession(auth),

    // Supabase can't tell whether an email has an account without revealing it
    // to anyone, so everyone is asked for a password first; the password
    // screen offers "Create an account" after a failed sign-in.
    async lookupEmail(email) {
      return { email: validEmail(email), exists: true };
    },

    async signInWithEmail(email, password) {
      const { data, error } = await call(() => auth.signInWithPassword({ email: validEmail(email), password }));
      if (error) throw mapAuthError(error);
      if (!data.session) throw new ApiError('confirmation_required', CONFIRM_FIRST);
      return toAuthSession(data.session);
    },

    async signUpWithEmail(email, password) {
      const normalized = validEmail(email);
      checkPassword(password);
      const { data, error } = await call(() =>
        auth.signUp({ email: normalized, password, options: { emailRedirectTo: deps.redirectUrl(CALLBACK_PATH) } }),
      );
      if (error) throw mapAuthError(error);
      // With email confirmation on, a taken email comes back as a user with no identities.
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        throw new ApiError('email_taken', defaultErrorMessage('email_taken'));
      }
      if (!data.session) throw new ApiError('confirmation_required', defaultErrorMessage('confirmation_required'));
      return toAuthSession(data.session);
    },

    async signInWithGoogle() {
      const redirectTo = deps.redirectUrl(CALLBACK_PATH);
      if (deps.platform === 'web') {
        // supabase-js sends the whole page to Google; /auth/callback finishes
        // after the page loads again, so this never settles.
        const { error } = await call(() => auth.signInWithOAuth({ provider: 'google', options: { redirectTo } }));
        if (error) throw mapAuthError(error);
        return new Promise<never>(() => undefined);
      }
      const { data, error } = await call(() =>
        auth.signInWithOAuth({ provider: 'google', options: { redirectTo, skipBrowserRedirect: true } }),
      );
      if (error || !data.url) throw mapAuthError(error);
      const result = await deps.openAuthSession(data.url, redirectTo);
      if (result.type !== 'success') throw new SignInCancelled();
      const params = authRedirectParams(result.url);
      if (!params.code && !params.error) throw new ApiError('unknown', NOT_FINISHED);
      return completeAuthRedirect(auth, params, deps.platform);
    },

    async sendPasswordReset(email) {
      const normalized = validEmail(email);
      const { error } = await call(() =>
        auth.resetPasswordForEmail(normalized, { redirectTo: deps.redirectUrl(RESET_PATH) }),
      );
      if (error) throw mapAuthError(error);
    },

    async updatePassword(password) {
      checkPassword(password);
      const { error } = await call(() => auth.updateUser({ password }));
      if (error) throw mapAuthError(error);
    },

    async getProviders() {
      if (providers) return providers;
      const read = await readProviders(deps);
      // Unknown (offline, an old server): offer Google; a failed sign-in says why.
      if (!read) return { google: true };
      providers = read;
      return read;
    },

    async signOut() {
      let failed: boolean;
      try {
        failed = !!(await auth.signOut()).error;
      } catch {
        failed = true;
      }
      // Offline the server can't be told; still sign out on this device.
      if (failed) {
        const local = await call(() => auth.signOut({ scope: 'local' }));
        if (local.error) throw mapAuthError(local.error);
      }
      ctx.data.reset();
    },
  };
}
