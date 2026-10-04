/**
 * Google Calendar on Data and privacy: connect, the tokens behind it, the two
 * choices (plan around it, add sessions to it) and disconnect. Pure: Auth,
 * storage, fetch and the browser arrive in RemoteDeps, so Node tests use fakes.
 *
 * Connecting is a Google sign-in through Supabase Auth with the calendar
 * scopes and offline access: `signInWithOAuth` when the account already has a
 * Google identity, `linkIdentity` otherwise (an email account). Supabase hands
 * the Google tokens over once, on the session right after that sign-in;
 * `capture` stores them per user in the secure store. A pending marker ties
 * that session to the person who tapped Connect, so the tokens are kept on
 * every path that can finish the sign-in: the connect call itself, the deep
 * link (Android), and the web page that loads after Google.
 */
import { debugLog, debugWarn, describeError, errorLabel, shortId, startTimer } from '../../lib/debug-log';
import { deviceTimeZone, type FreeTimeSource } from '../../services/calendar/plan-availability';
import type { ExportRange, ExportResult, ExportSession } from '../../services/calendar/plan-export';
import {
  ASSUMED_TOKEN_LIFETIME_MS,
  createGoogleAccessTokens,
  createGoogleCalendarApi,
  createGoogleSettingsStore,
  createGoogleTokenStore,
  googleFreeTimeSource,
  GOOGLE_CALENDAR_SCOPE,
  GoogleCalendarError,
  isGoogleCalendarError,
  removeGoogleMovoCalendar,
  revokeGoogleToken,
  syncPlanToGoogleCalendar,
  type GoogleCalendarApi,
  type GoogleTokens,
  type MovoCalendarRef,
  type RefreshedToken,
} from '../../services/google-calendar';
import { ApiError, isApiError } from '../types';
import { authRedirectParams, CALLBACK_PATH, exchangeAuthCode, mapAuthError } from './auth';
import type { AuthErrorLike, AuthSessionData, AuthUser, OAuthOptions, RemoteDeps } from './deps';
import { serverError, type ProductApi } from './http';
import type { GoogleTokenResultDto } from './wire';

/* ----------------------------------------------------------------- Copy */

const CONNECT_FAILED = "Google Calendar didn't connect. Try again.";
const LINKING_OFF =
  "Connecting Google to an account made with email isn't switched on yet. Try again later.";
const GOOGLE_TAKEN = 'This Google account already belongs to another Movo account. Choose a different Google account.';
const NO_CALENDAR_ACCESS = "Google didn't share your calendar. Try again and allow calendar access.";
const GOOGLE_OFF = "Google isn't available right now. Try again later.";
const otherAccount = (email: string | null) =>
  email
    ? `That Google account belongs to another Movo account. Connect ${email} instead.`
    : 'That Google account belongs to another Movo account. Connect the Google account you sign in with.';

/* ---------------------------------------------------------------- Types */

export interface GoogleCalendarStatus {
  /** Tokens are stored for this account. */
  connected: boolean;
  /** The Google account's email, when known. */
  email: string | null;
  /** Google refused the tokens or refresh is unavailable: show Reconnect. */
  needsReconnect: boolean;
  useForPlanning: boolean;
  exportEnabled: boolean;
  /** A Movo calendar exists in Google for this account (Disconnect offers to remove it). */
  hasMovoCalendar: boolean;
}

export type GoogleConnectResult =
  | { status: 'connected'; email: string | null }
  /** Closed or declined: nothing changed. */
  | { status: 'cancelled' }
  /** Web: the page is going to Google; /auth/callback finishes on return. */
  | { status: 'redirecting' };

/** What `capture` did with a session. */
export type CaptureOutcome = 'stored' | 'ignored' | 'other_account';

export interface GoogleCalendarAccount {
  /** This account's connection and choices; null when signed out. */
  status(): Promise<GoogleCalendarStatus | null>;
  /** From an explicit tap on Connect or Reconnect. Rejects with an ApiError whose message is ready to show. */
  connect(): Promise<GoogleConnectResult>;
  /** Stores the Google tokens of a session that finished a pending connect. Never rejects. */
  capture(session: AuthSessionData): Promise<CaptureOutcome>;
  /** Deletes the tokens (and asks Google to revoke them); optionally removes the Movo calendar from Google first. */
  disconnect(options: { removeCalendar: boolean }): Promise<void>;
  setUseForPlanning(on: boolean): Promise<void>;
  /** Turning it off does not remove the calendar: call `removeExportCalendar` for that. */
  setExportEnabled(on: boolean): Promise<void>;
  /** Free/busy for planning while connected and "Use for planning" is on; null otherwise. */
  freeTimeSource(): Promise<FreeTimeSource | null>;
  /** Syncs the Movo calendar in Google while "Add sessions" is on; null when it is off or not connected. */
  syncExport(sessions: readonly ExportSession[], range: ExportRange): Promise<ExportResult | null>;
  /** Deletes the Movo calendar from Google. False when there was none. */
  removeExportCalendar(): Promise<boolean>;
  /** Whether /auth/callback belongs to a Google Calendar connect (go back to Data and privacy). */
  returnsToCalendar(): Promise<boolean>;
  /** A message for Data and privacy about a connect that finished away from it (web, another account). */
  notice(): string | null;
  /** Stores a notice for Data and privacy (a web connect that failed on /auth/callback); null clears it. */
  setNotice(message: string | null): void;
  /** Forgets a connect in progress (sign-out). */
  forgetPending(): Promise<void>;
  /** Called after any change to the connection or the choices. */
  subscribe(listener: () => void): () => void;
}

interface PendingConnect {
  user_id: string;
  started_at: number;
  /** The session to put back if Google signs in a different Movo account (signInWithOAuth path). */
  restore: { access_token: string; refresh_token: string } | null;
  /**
   * A fingerprint of the Google token the session already carried when the
   * connect started (an earlier Google sign-in, without the calendar scopes).
   * That one is never stored as the calendar's token, whatever event brings
   * it back (a reload, the app returning to the foreground).
   */
  stale: string | null;
}

export const PENDING_CONNECT_KEY = 'movo.google-calendar.connect.v1';
const PENDING_TTL_MS = 10 * 60_000;
/** After a dismissed sheet, how long a deep link may still finish the connect (Android). */
const CAPTURE_WAIT_MS = 3_000;
const CAPTURE_POLL_MS = 250;
const RECENT_MS = 2 * 60_000;

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value.trim() : null);

/** FNV-1a: tells two tokens apart without keeping either. */
export function tokenFingerprint(token: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < token.length; i += 1) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${token.length}:${hash.toString(16)}`;
}

/** The Google email on a user: its Google identity's, else the metadata's. */
export function googleEmailOf(user: AuthUser): string | null {
  for (const identity of Array.isArray(user.identities) ? user.identities : []) {
    const item = identity as { provider?: unknown; identity_data?: { email?: unknown } } | null;
    if (item?.provider === 'google') {
      const email = text(item.identity_data?.email);
      if (email) return email;
    }
  }
  return null;
}

/* --------------------------------------------------------------- Errors */

/** A Supabase Auth error during connect as an ApiError with copy for Data and privacy. */
export function mapConnectError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  const code = typeof (error as AuthErrorLike | null)?.code === 'string' ? (error as AuthErrorLike).code : null;
  const make = (message: string) => new ApiError('unknown', message, { cause: error, retryable: false });
  if (code === 'manual_linking_disabled') return make(LINKING_OFF);
  if (code === 'identity_already_exists') return make(GOOGLE_TAKEN);
  if (code === 'provider_disabled' || code === 'oauth_provider_not_supported') return make(GOOGLE_OFF);
  const mapped = mapAuthError(error);
  if (mapped.code === 'offline' || mapped.code === 'timeout') return mapped;
  if (mapped.code === 'unauthorized' && !code) return mapped;
  return make(CONNECT_FAILED);
}

/** An error Google or Supabase put on the redirect back (`error`, `error_code`). */
function redirectError(code: string): ApiError {
  return mapConnectError({ name: 'AuthRedirectError', message: code, code });
}

/** Copy for a connect that failed on /auth/callback (web): the redirect's own code first, else the failure. */
export function connectErrorMessage(error: unknown, redirectCode: string | null): string {
  if (redirectCode) return redirectError(redirectCode).message;
  if (isApiError(error, 'offline') || isApiError(error, 'timeout')) return error.message;
  return CONNECT_FAILED;
}

/** POST /google/token failures as Google Calendar errors: refused or unavailable means reconnect. */
function refreshError(error: unknown): GoogleCalendarError {
  const detail = serverError(error);
  const status = detail?.status ?? null;
  if (
    detail?.code === 'GOOGLE_RECONNECT_REQUIRED' ||
    detail?.code === 'GOOGLE_NOT_CONFIGURED' ||
    status === 404 ||
    status === 405
  ) {
    return new GoogleCalendarError('reconnect_required', 'Reconnect Google Calendar to keep using it.', {
      status,
      reason: detail?.code ?? `http_${status}`,
      cause: error,
    });
  }
  if (isApiError(error, 'offline') || isApiError(error, 'timeout')) {
    return new GoogleCalendarError('offline', "Couldn't reach the server.", { reason: error.code, cause: error });
  }
  return new GoogleCalendarError('google', "Couldn't refresh Google Calendar access.", {
    status,
    reason: detail?.code ?? 'refresh_failed',
    cause: error,
  });
}

/** Runs an Auth call; a rejection (network failure) becomes an ApiError. */
async function call<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    throw mapConnectError(error);
  }
}

/* --------------------------------------------------------------- Account */

export function createGoogleCalendarAccount(
  ctx: { deps: RemoteDeps; http: ProductApi },
  options: { sleep?: (ms: number) => Promise<void> } = {},
): GoogleCalendarAccount {
  const { deps, http } = ctx;
  const { auth } = deps;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const now = () => deps.now().getTime();
  const tokens = createGoogleTokenStore(deps.secureStorage);
  const settings = createGoogleSettingsStore(deps.storage);
  const listeners = new Set<() => void>();
  const captures = new Map<string, Promise<CaptureOutcome>>();
  let notice: string | null = null;
  let lastCapture = 0;

  const notify = () => {
    for (const listener of listeners) listener();
  };

  const refresh = async (refreshToken: string): Promise<RefreshedToken> => {
    try {
      return await http.post<GoogleTokenResultDto>('/google/token', { refresh_token: refreshToken });
    } catch (error) {
      throw refreshError(error);
    }
  };
  const accessTokens = createGoogleAccessTokens({ store: tokens, refresh, now });

  async function currentUserId(): Promise<string | null> {
    try {
      return (await auth.getSession()).data.session?.user.id ?? null;
    } catch {
      return null;
    }
  }

  /** Google refused the tokens during a call: remember it, so Data and privacy offers Reconnect. */
  async function watched<T>(userId: string, run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      if (isGoogleCalendarError(error, 'reconnect_required')) {
        const stored = await tokens.read(userId);
        if (stored && !stored.needs_reconnect) await tokens.write(userId, { ...stored, needs_reconnect: true });
        notify();
      }
      throw error;
    }
  }

  function apiFor(userId: string): GoogleCalendarApi {
    return createGoogleCalendarApi({
      fetch: deps.googleFetch,
      accessToken: async (force) => {
        try {
          return await accessTokens.get(userId, force);
        } catch (error) {
          if (isGoogleCalendarError(error, 'reconnect_required')) notify();
          throw error;
        }
      },
    });
  }

  function movoCalendar(userId: string): MovoCalendarRef {
    return {
      get: async () => (await settings.read(userId)).movoCalendarId,
      set: async (calendarId) => {
        await settings.update(userId, { movoCalendarId: calendarId });
        notify();
      },
    };
  }

  /* ---------------------------------------------------- Pending marker */

  async function readPending(): Promise<PendingConnect | null> {
    try {
      const raw = await deps.storage.getItem(PENDING_CONNECT_KEY);
      if (!raw) return null;
      const value = JSON.parse(raw) as PendingConnect;
      if (typeof value.user_id !== 'string' || typeof value.started_at !== 'number') return null;
      if (now() - value.started_at > PENDING_TTL_MS) return null;
      return value;
    } catch {
      return null;
    }
  }

  const writePending = (pending: PendingConnect) => deps.storage.setItem(PENDING_CONNECT_KEY, JSON.stringify(pending));
  const clearPending = () => deps.storage.removeItem(PENDING_CONNECT_KEY).catch(() => undefined);

  /* --------------------------------------------------------- Capture */

  async function store(session: AuthSessionData, providerToken: string): Promise<CaptureOutcome> {
    const pending = await readPending();
    if (!pending) return 'ignored';
    // The token from before this connect, brought back by a reload or a refresh event: not the calendar's.
    if (pending.stale && pending.stale === tokenFingerprint(providerToken)) return 'ignored';
    const userId = session.user.id;
    if (pending.user_id !== userId) {
      // Google signed in a different Movo account: put the person's own session back.
      await clearPending();
      debugWarn('calendar', `google calendar connect signed in another account (${shortId(userId)}): restoring ${shortId(pending.user_id)}`);
      if (pending.restore) {
        try {
          const { error } = await auth.setSession(pending.restore);
          if (error) debugWarn('auth', `✕ session restore ${errorLabel(error)}`, () => describeError(error));
        } catch (error) {
          debugWarn('auth', `✕ session restore ${errorLabel(error)}`, () => describeError(error));
        }
      }
      notice = otherAccount(null);
      notify();
      return 'other_account';
    }
    const stored: GoogleTokens = {
      access_token: providerToken,
      expires_at: now() + ASSUMED_TOKEN_LIFETIME_MS,
      refresh_token: text(session.provider_refresh_token) ?? null,
      email: googleEmailOf(session.user),
      connected_at: now(),
      needs_reconnect: false,
    };
    await tokens.write(userId, stored);
    await clearPending();
    lastCapture = now();
    debugLog(
      'calendar',
      `google calendar connected user=${shortId(userId)} refresh=${stored.refresh_token ? 'yes' : 'no (reconnect in about an hour)'}`,
    );
    notify();
    return 'stored';
  }

  function capture(session: AuthSessionData): Promise<CaptureOutcome> {
    const providerToken = text(session.provider_token);
    if (!providerToken) return Promise.resolve('ignored');
    // Listeners that see the same session at once (the connect call, the deep link, Auth events) share one capture.
    let running = captures.get(providerToken);
    if (!running) {
      running = store(session, providerToken)
        .catch((error: unknown) => {
          debugWarn('calendar', `✕ google calendar token capture ${errorLabel(error)}`, () => describeError(error));
          return 'ignored' as const;
        })
        .finally(() => captures.delete(providerToken));
      captures.set(providerToken, running);
    }
    return running;
  }

  /** Waits for another path (the Android deep link) to store tokens from this connect. */
  async function waitForCapture(userId: string, startedAt: number): Promise<boolean> {
    const captured = async () => {
      const stored = await tokens.read(userId);
      return !!stored && stored.connected_at >= startedAt;
    };
    for (let waited = 0; waited <= CAPTURE_WAIT_MS; waited += CAPTURE_POLL_MS) {
      if (await captured()) return true;
      // The marker goes once a capture finished (or found another account): look one last time.
      if (!(await readPending())) return captured();
      await sleep(CAPTURE_POLL_MS);
    }
    return false;
  }

  /* --------------------------------------------------------- Connect */

  async function connect(): Promise<GoogleConnectResult> {
    notice = null;
    const { data: current, error: sessionError } = await call(() => auth.getSession());
    if (sessionError) throw mapConnectError(sessionError);
    const session = current.session;
    if (!session) throw new ApiError('unauthorized', 'Sign in again, then connect Google Calendar.');
    const userId = session.user.id;

    const identities = await call(() => auth.getUserIdentities());
    if (identities.error) throw mapConnectError(identities.error);
    const google = identities.data?.identities.find((identity) => identity.provider === 'google') ?? null;
    const hint = text(google?.identity_data?.email);

    const web = deps.platform === 'web';
    const redirectTo = deps.redirectUrl(CALLBACK_PATH);
    const oauth: OAuthOptions = {
      redirectTo,
      scopes: GOOGLE_CALENDAR_SCOPE,
      // offline + consent: Google sends a refresh token every time, not only on the first grant.
      queryParams: { access_type: 'offline', prompt: 'consent', ...(hint ? { login_hint: hint } : {}) },
      // Web: supabase-js sends the whole page to Google; native: the in-app browser below.
      skipBrowserRedirect: !web,
    };
    const startedAt = now();
    const previousToken = text(session.provider_token);
    await writePending({
      user_id: userId,
      started_at: startedAt,
      restore: google ? { access_token: session.access_token, refresh_token: session.refresh_token } : null,
      stale: previousToken ? tokenFingerprint(previousToken) : null,
    });
    debugLog('calendar', `→ google calendar connect (${google ? 'google sign-in' : 'link google'}) on ${deps.platform}`);

    let start: Awaited<ReturnType<typeof auth.signInWithOAuth>>;
    try {
      start = google
        ? await auth.signInWithOAuth({ provider: 'google', options: oauth })
        : await auth.linkIdentity({ provider: 'google', options: oauth });
    } catch (error) {
      await clearPending();
      throw mapConnectError(error);
    }
    if (start.error || !start.data.url) {
      await clearPending();
      throw mapConnectError(start.error ?? { name: 'AuthUnknownError', message: 'No URL' });
    }
    if (web) return { status: 'redirecting' };

    const result = await deps.openAuthSession(start.data.url, redirectTo);
    if (result.type === 'success') {
      const params = authRedirectParams(result.url);
      if (params.error) {
        await clearPending();
        if (params.error === 'access_denied') {
          debugLog('calendar', 'google calendar connect declined');
          return { status: 'cancelled' };
        }
        throw redirectError(params.error);
      }
      if (params.code) {
        let finished: AuthSessionData;
        try {
          finished = await exchangeAuthCode(auth, params.code, deps.platform);
        } catch (error) {
          await clearPending();
          throw mapConnectError(error);
        }
        if (!text(finished.provider_token)) {
          await clearPending();
          throw new ApiError('unknown', NO_CALENDAR_ACCESS);
        }
        const outcome = await capture(finished);
        // Another listener may have seen the other account first; it left the notice.
        if (outcome === 'other_account' || notice) {
          notice = null;
          notify();
          throw new ApiError('unknown', otherAccount(hint));
        }
        const stored = await tokens.read(userId);
        if (stored && stored.connected_at >= startedAt) return { status: 'connected', email: stored.email };
        await clearPending();
        throw new ApiError('unknown', CONNECT_FAILED);
      }
    }
    // Closed, or Android reported a dismiss while the deep link carries the code: give that path a moment.
    if (await waitForCapture(userId, startedAt)) {
      return { status: 'connected', email: (await tokens.read(userId))?.email ?? null };
    }
    await clearPending();
    debugLog('calendar', 'google calendar connect closed');
    return { status: 'cancelled' };
  }

  /** Debug builds: the outcome and how long it took; codes only. */
  async function tracedConnect(): Promise<GoogleConnectResult> {
    const took = startTimer();
    try {
      const result = await connect();
      debugLog('calendar', `✓ google calendar connect: ${result.status} ${took()}`);
      return result;
    } catch (error) {
      debugWarn('calendar', `✕ google calendar connect ${took()} ${errorLabel(error)}`, () => describeError(error));
      throw error;
    }
  }

  /* --------------------------------------------------------- Account */

  async function status(): Promise<GoogleCalendarStatus | null> {
    const userId = await currentUserId();
    if (!userId) return null;
    const [stored, chosen] = await Promise.all([tokens.read(userId).catch(() => null), settings.read(userId)]);
    return {
      connected: !!stored,
      email: stored?.email ?? null,
      needsReconnect: !!stored?.needs_reconnect,
      useForPlanning: chosen.useForPlanning,
      exportEnabled: chosen.exportEnabled,
      hasMovoCalendar: !!chosen.movoCalendarId,
    };
  }

  async function signedInUser(): Promise<string> {
    const userId = await currentUserId();
    if (!userId) throw new ApiError('unauthorized', 'Sign in again to change Google Calendar.');
    return userId;
  }

  async function disconnect({ removeCalendar }: { removeCalendar: boolean }) {
    const userId = await signedInUser();
    const stored = await tokens.read(userId);
    if (removeCalendar && stored) {
      const removed = await watched(userId, () =>
        removeGoogleMovoCalendar({ api: apiFor(userId), calendar: movoCalendar(userId) }),
      );
      debugLog('calendar', `google movo calendar ${removed ? 'removed' : 'was already gone'}`);
    }
    if (stored) {
      // Best effort: Google forgets the grant; the tokens go from this phone either way.
      const revoked = await revokeGoogleToken(deps.googleFetch, stored.refresh_token ?? stored.access_token);
      debugLog('calendar', `google calendar disconnected user=${shortId(userId)} revoked=${revoked ? 'yes' : 'no'}`);
    }
    await tokens.remove(userId);
    await settings.update(userId, { exportEnabled: false, ...(removeCalendar ? { movoCalendarId: null } : {}) });
    notify();
  }

  async function freeTimeSource(): Promise<FreeTimeSource | null> {
    const userId = await currentUserId();
    if (!userId) return null;
    const [stored, chosen] = await Promise.all([tokens.read(userId).catch(() => null), settings.read(userId)]);
    if (!stored || stored.needs_reconnect || !chosen.useForPlanning) return null;
    const source = googleFreeTimeSource(apiFor(userId));
    return { freeSlots: (query) => watched(userId, () => source.freeSlots(query)) };
  }

  async function syncExport(sessions: readonly ExportSession[], range: ExportRange): Promise<ExportResult | null> {
    const userId = await currentUserId();
    if (!userId) return null;
    const [stored, chosen] = await Promise.all([tokens.read(userId).catch(() => null), settings.read(userId)]);
    if (!stored || stored.needs_reconnect || !chosen.exportEnabled) return null;
    return watched(userId, () =>
      syncPlanToGoogleCalendar(sessions, range, {
        api: apiFor(userId),
        calendar: movoCalendar(userId),
        timeZone: deviceTimeZone(),
      }),
    );
  }

  async function removeExportCalendar(): Promise<boolean> {
    const userId = await signedInUser();
    if (!(await tokens.read(userId))) return false;
    return watched(userId, () => removeGoogleMovoCalendar({ api: apiFor(userId), calendar: movoCalendar(userId) }));
  }

  return {
    status,
    connect: tracedConnect,
    capture,
    disconnect,
    async setUseForPlanning(on) {
      await settings.update(await signedInUser(), { useForPlanning: on });
      notify();
    },
    async setExportEnabled(on) {
      await settings.update(await signedInUser(), { exportEnabled: on });
      notify();
    },
    freeTimeSource,
    syncExport,
    removeExportCalendar,
    async returnsToCalendar() {
      return notice !== null || now() - lastCapture < RECENT_MS || !!(await readPending());
    },
    notice: () => notice,
    setNotice(message) {
      if (notice === message) return;
      notice = message;
      notify();
    },
    forgetPending: clearPending,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
