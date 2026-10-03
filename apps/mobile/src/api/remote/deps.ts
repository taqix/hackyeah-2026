/**
 * Everything the remote adapter needs from the outside world, injected so the
 * adapter stays pure TypeScript: Node tests pass fakes, and only `default.ts`
 * wires React Native, Expo and supabase-js. Keep this file free of runtime
 * imports.
 */
import type { CaptureAvailability } from '../../services/calendar/plan-availability';

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
    options?: { redirectTo?: string; skipBrowserRedirect?: boolean; queryParams?: { [key: string]: string } };
  }): Promise<{ data: { url: string | null }; error: AuthErrorLike | null }>;
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
}
