/**
 * Everything the remote adapter needs from the outside world, injected so the
 * adapter stays pure TypeScript: Node tests pass fakes, and only `default.ts`
 * wires React Native, Expo and supabase-js. Keep this file free of runtime
 * imports.
 */
import type { CaptureAvailability } from '../../services/calendar/plan-availability';
import type { GoogleFetch } from '../../services/google-calendar/types';

/* ---------------------------------------------------------------- Fetch */

export interface FetchInit {
  method: 'GET' | 'PUT' | 'POST';
  headers: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
}

/** The part of a fetch Response the adapter reads. */
export interface FetchResponse {
  status: number;
  ok: boolean;
  text(): Promise<string>;
}

/** The global fetch, narrowed. Rejects with a TypeError on network failure and an AbortError on abort. */
export type FetchLike = (url: string, init: FetchInit) => Promise<FetchResponse>;

/* ----------------------------------------------------------------- Auth */

/** The supabase-js error shape the adapter reads (AuthError and subclasses). */
export interface AuthErrorLike {
  message: string;
  name?: string;
  /** Supabase Auth error code, e.g. invalid_credentials, user_already_exists, weak_password. */
  code?: string | undefined;
  status?: number | undefined;
}

export interface AuthUser {
  id: string;
  email?: string;
  created_at: string;
  /** `provider` is `email` or `google`. */
  app_metadata: { provider?: string; [key: string]: unknown };
  /** Google fills `full_name`/`name`. */
  user_metadata: { [key: string]: unknown };
  /** Empty after signUp with an email that already has an account (confirmation on). */
  identities?: unknown[];
}

export interface AuthSessionData {
  access_token: string;
  refresh_token: string;
  /** Seconds since epoch. */
  expires_at?: number;
  user: AuthUser;
  /**
   * Google's access token, present only on the session right after a Google
   * sign-in or identity link (gone after the next refresh). Google Calendar
   * stores it on connect.
   */
  provider_token?: string | null;
  /** Google's refresh token, with `access_type=offline` and `prompt=consent`; same lifetime as `provider_token`. */
  provider_refresh_token?: string | null;
}

/** One sign-in method linked to the user (`email`, `google`). */
export interface AuthIdentity {
  provider: string;
  /** Google fills `email`, `full_name`, `name`, `sub`. */
  identity_data?: { [key: string]: unknown };
}

/** The OAuth options the app passes to Google (sign-in, linking). */
export interface OAuthOptions {
  redirectTo?: string;
  /** Space-separated extra scopes, e.g. Google Calendar's. */
  scopes?: string;
  skipBrowserRedirect?: boolean;
  queryParams?: { [key: string]: string };
}

export type AuthEvent =
  | 'INITIAL_SESSION'
  | 'PASSWORD_RECOVERY'
  | 'SIGNED_IN'
  | 'SIGNED_OUT'
  | 'TOKEN_REFRESHED'
  | 'USER_UPDATED'
  | 'MFA_CHALLENGE_VERIFIED';

export interface AuthResult {
  data: { user: AuthUser | null; session: AuthSessionData | null };
  error: AuthErrorLike | null;
}

/**
 * The supabase.auth methods the app uses, structurally (`getSupabase().auth`
 * satisfies it; `default.ts` checks that). Every method resolves with
 * `{data, error}` and does not throw for Auth errors, except network failures,
 * which may reject.
 */
export interface AuthPort {
  getSession(): Promise<{ data: { session: AuthSessionData | null }; error: AuthErrorLike | null }>;
  signInWithPassword(credentials: { email: string; password: string }): Promise<AuthResult>;
  signUp(credentials: {
    email: string;
    password: string;
    options?: { emailRedirectTo?: string; data?: object };
  }): Promise<AuthResult>;
  signInWithOAuth(credentials: {
    provider: 'google';
    options?: OAuthOptions;
  }): Promise<{ data: { url: string | null }; error: AuthErrorLike | null }>;
  /**
   * Links Google to the signed-in user (PKCE). Needs manual linking switched
   * on in Supabase Auth, else `manual_linking_disabled`.
   */
  linkIdentity(credentials: {
    provider: 'google';
    options?: OAuthOptions;
  }): Promise<{ data: { url: string | null }; error: AuthErrorLike | null }>;
  /** The signed-in user's linked identities. */
  getUserIdentities(): Promise<{ data: { identities: AuthIdentity[] } | null; error: AuthErrorLike | null }>;
  /** Puts a known session back (a Google Calendar connect that signed in another account). */
  setSession(tokens: { access_token: string; refresh_token: string }): Promise<AuthResult>;
  exchangeCodeForSession(authCode: string): Promise<AuthResult>;
  resetPasswordForEmail(email: string, options?: { redirectTo?: string }): Promise<{ error: AuthErrorLike | null }>;
  updateUser(attributes: { password?: string; data?: object }): Promise<{
    data: { user: AuthUser | null };
    error: AuthErrorLike | null;
  }>;
  signOut(options?: { scope?: 'global' | 'local' | 'others' }): Promise<{ error: AuthErrorLike | null }>;
  refreshSession(): Promise<AuthResult>;
  onAuthStateChange(callback: (event: AuthEvent, session: AuthSessionData | null) => void): {
    data: { subscription: { unsubscribe(): void } };
  };
  startAutoRefresh(): Promise<void>;
  stopAutoRefresh(): Promise<void>;
}

/* -------------------------------------------------------------- Storage */

/** AsyncStorage's string API. */
export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/* ----------------------------------------------------------------- Deps */

export type AuthSessionResult = { type: 'success'; url: string } | { type: 'cancel' | 'dismiss' };

export interface RemoteDeps {
  fetch: FetchLike;
  /** The product API base URL, without a trailing slash. */
  productApiUrl: string;
  /** `https://<ref>.supabase.co`, for Auth endpoints such as GET /auth/v1/settings. */
  supabaseUrl: string;
  publishableKey: string;
  auth: AuthPort;
  storage: KeyValueStorage;
  /** The device clock. Never the mock's time-travel override. */
  now(): Date;
  /** A new v4 UUID (request IDs, draft IDs). */
  newId(): string;
  /** Free time for generate and chat (device calendar, else the preferred window). */
  captureAvailability: CaptureAvailability;
  platform: 'ios' | 'android' | 'web';
  /** Opens the system browser for OAuth and resolves when it returns to `redirectUrl`. */
  openAuthSession(url: string, redirectUrl: string): Promise<AuthSessionResult>;
  /** A deep link back into the app, e.g. `redirectUrl('auth/callback')` → `hackyeah2026://auth/callback`. */
  redirectUrl(path: string): string;
  /**
   * The keychain or keystore (expo-secure-store) for the Google tokens. On
   * web, where there is none, AsyncStorage (localStorage).
   */
  secureStorage: KeyValueStorage;
  /** fetch for Google's own APIs: Calendar and token revocation. */
  googleFetch: GoogleFetch;
}
