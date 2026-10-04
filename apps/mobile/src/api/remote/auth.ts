import {
  debugLog,
  debugLogsEnabled,
  debugWarn,
  describeError,
  errorLabel,
  maskEmail,
  shortId,
  startTimer,
} from '../../lib/debug-log';
import type { ApiClient } from '../client';
import { checkName } from '../../lib/person-name';
import { ApiError, isApiError, type AuthProviders, type AuthSession } from '../types';
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
const GOOGLE_NOT_FINISHED = "Google sign-in didn't finish. Try again.";

/** Asks Google to show its account chooser, so a phone with several Google accounts can pick one. */
export const GOOGLE_SIGN_IN_PARAMS = { prompt: 'select_account' } as const;

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

/**
 * A Supabase session as the app's AuthSession. The name comes from the user
 * metadata: Google's, or the one given at sign-up or in Settings (both write
 * `full_name` and `name`).
 */
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

/** The session with `name` filled in, when it has none. */
const named = (session: AuthSession, name: string | null): AuthSession =>
  session.user.name || !name ? session : { ...session, user: { ...session.user, name } };

/**
 * An account whose metadata has no name (made before sign-up asked for one,
 * or named elsewhere) is greeted by its profile's username. Best effort: the
 * session comes back unchanged when the profile can't be read.
 */
export async function withProfileName(ctx: Pick<RemoteContext, 'data'>, session: AuthSession): Promise<AuthSession> {
  if (session.user.name) return session;
  try {
    return named(session, text((await ctx.data.profile())?.username));
  } catch {
    return session;
  }
}

/**
 * An Auth event's session (token refresh, focus) carries only the metadata:
 * keep the name already shown for the same person when it has none.
 */
export function keepKnownName(next: AuthSession, previous: AuthSession | null | undefined): AuthSession {
  return previous?.user.id === next.user.id ? named(next, previous.user.name) : next;
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
  /**
   * `error_code`, else `error`. Supabase sets `error_code` for its own
   * refusals (otp_expired, signup_disabled), often with `error=access_denied`;
   * a bare `error=access_denied` is Google's: the person declined.
   */
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
    // Auth's own codes keep their copy (an expired link, sign-ups switched off); anything else didn't finish.
    const known = mapAuthError({ name: 'AuthRedirectError', message: params.error, code: params.error });
    const plain = known.code === 'unknown' && known.message === defaultErrorMessage('unknown');
    throw new ApiError(plain ? 'unknown' : known.code, plain ? NOT_FINISHED : known.message, { cause: params });
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

/* ---------------------------------------------------------- Debug logs */

/** Debug builds: one line per Auth attempt and its outcome; codes only, never a password, token or full email. */
async function traced<T>(action: string, email: string | null, run: () => Promise<T>, outcome?: (result: T) => string) {
  const took = startTimer();
  debugLog('auth', `→ ${action}${email ? ` ${maskEmail(email)}` : ''}`);
  try {
    const result = await run();
    debugLog('auth', `✓ ${action} ${took()}${outcome ? ` ${outcome(result)}` : ''}`);
    return result;
  } catch (error) {
    if (isSignInCancelled(error)) debugLog('auth', `${action} cancelled ${took()}`);
    else debugWarn('auth', `✕ ${action} ${took()} ${errorLabel(error)}`, () => describeError(error));
    throw error;
  }
}

const sessionTag = (session: AuthSession | null) =>
  session ? `user=${shortId(session.user.id)} provider=${session.user.provider}` : 'no session';

/** The Auth section with its attempts logged; unchanged when debug logs are off. */
function withAuthLogging(client: ApiClient['auth']): ApiClient['auth'] {
  if (!debugLogsEnabled) return client;
  return {
    ...client,
    signInWithEmail: (email, password) =>
      traced('sign-in (email)', email, () => client.signInWithEmail(email, password), sessionTag),
    signUpWithEmail: (email, password, name) =>
      traced('sign-up (email)', email, () => client.signUpWithEmail(email, password, name), sessionTag),
    signInWithGoogle: () => traced('sign-in (google)', null, () => client.signInWithGoogle(), sessionTag),
    sendPasswordReset: (email) => traced('password reset email', email, () => client.sendPasswordReset(email)),
    updatePassword: (password) => traced('new password', null, () => client.updatePassword(password)),
    getProviders: () =>
      traced('providers', null, () => client.getProviders(), (found) => `google=${found.google ? 'on' : 'off'}`),
    signOut: () => traced('sign-out', null, () => client.signOut()),
  };
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

  const client: ApiClient['auth'] = {
    async getSession() {
      const session = await readSession(auth);
      return session ? withProfileName(ctx, session) : null;
    },

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
      return withProfileName(ctx, toAuthSession(data.session));
    },

    async signUpWithEmail(email, password, name) {
      const normalized = validEmail(email);
      const fullName = checkName(name);
      checkPassword(password);
      // The session's user carries the name at once. PUT /profile needs the
      // whole answers document, so the first onboarding save writes it as the
      // profile's username (see preferences.save).
      const { data, error } = await call(() =>
        auth.signUp({
          email: normalized,
          password,
          options: {
            emailRedirectTo: deps.redirectUrl(CALLBACK_PATH),
            data: { name: fullName, full_name: fullName },
          },
        }),
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
      // Linking.createURL: hackyeah2026://auth/callback in a build, exp://…/--/auth/callback
      // in Expo Go, http://localhost:8081/auth/callback on the web; all are allowlisted.
      const redirectTo = deps.redirectUrl(CALLBACK_PATH);
      const queryParams = { ...GOOGLE_SIGN_IN_PARAMS };
      if (deps.platform === 'web') {
        // supabase-js sends the whole page to Google; /auth/callback finishes
        // after the page loads again, so this never settles.
        const { error } = await call(() =>
          auth.signInWithOAuth({ provider: 'google', options: { redirectTo, queryParams } }),
        );
        if (error) throw mapAuthError(error);
        return new Promise<never>(() => undefined);
      }
      const { data, error } = await call(() =>
        auth.signInWithOAuth({ provider: 'google', options: { redirectTo, skipBrowserRedirect: true, queryParams } }),
      );
      if (error || !data.url) throw mapAuthError(error ?? { name: 'AuthUnknownError', message: 'No URL' });
      const result = await deps.openAuthSession(data.url, redirectTo);
      // Closed or dismissed. On Android a dismiss can race the deep link: if
      // that carried a code, AuthSessionSync and /auth/callback finish it.
      if (result.type !== 'success') throw new SignInCancelled();
      const params = authRedirectParams(result.url);
      if (!params.code && !params.error) throw new ApiError('unknown', GOOGLE_NOT_FINISHED);
      try {
        return await completeAuthRedirect(auth, params, deps.platform);
      } catch (failure) {
        // A refused or expired code here means Google took too long: trying again is the fix.
        if (isApiError(failure, 'unauthorized')) {
          throw new ApiError('unauthorized', GOOGLE_NOT_FINISHED, { cause: failure });
        }
        throw failure;
      }
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
        debugLog('auth', 'sign-out: the server could not be told; signing out on this device only');
        const local = await call(() => auth.signOut({ scope: 'local' }));
        if (local.error) throw mapAuthError(local.error);
      }
      ctx.data.reset();
    },
  };
  return withAuthLogging(client);
}
