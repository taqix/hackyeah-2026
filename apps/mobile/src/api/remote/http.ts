/**
 * The product API transport: headers, timeouts, the `{data, meta}` envelope
 * and one error model. Every failure, from the API, the Supabase gateway or
 * the network, becomes an `ApiError` with a calm, user-facing message; the
 * server's own code and message stay on `error.cause` (see `serverError`).
 */
import { ApiError, type ApiErrorCode } from '../types';
import type { FetchLike } from './deps';
import type { WireErrorCode } from './wire';

/** Reads and writes. */
export const DEFAULT_TIMEOUT_MS = 20_000;
/** Plan generation and chat wait for the AI; pass this as `timeoutMs`. */
export const AI_TIMEOUT_MS = 120_000;
/** Waits before the transport retries of `retryTransport`. */
const RETRY_BACKOFF_MS = [600, 1_800];

export type QueryValue = string | number | undefined;

export interface PostOptions {
  /** Defaults to the client's timeout (20 s). Use AI_TIMEOUT_MS for generate and chat. */
  timeoutMs?: number;
  /**
   * On offline or timeout, resend the identical body up to two more times with
   * a short backoff. Only for idempotent writes (a body with a request_id).
   */
  retryTransport?: boolean;
}

export interface ProductApi {
  /** GET `path` (e.g. '/plans/history') with query values; resolves with the envelope's data. */
  get<T>(path: string, query?: Record<string, QueryValue>): Promise<T>;
  put<T>(path: string, body: unknown, options?: PostOptions): Promise<T>;
  post<T>(path: string, body: unknown, options?: PostOptions): Promise<T>;
}

export interface ProductApiOptions {
  fetch: FetchLike;
  /** Without a trailing slash, e.g. https://<ref>.supabase.co/functions/v1/product-api. */
  baseUrl: string;
  publishableKey: string;
  /**
   * The session's access token, or null when signed out. `forceRefresh` asks
   * Auth for a new one (after a 401). May reject on a network failure.
   */
  getAccessToken(forceRefresh?: boolean): Promise<string | null>;
  timeoutMs?: number;
  /** Tests pass a no-op. */
  sleep?: (ms: number) => Promise<void>;
}

/** What the server said, kept on `ApiError.cause` for callers that need the exact code. */
export interface ServerErrorDetail {
  kind: 'product-api';
  /** Null for network failures and timeouts. */
  status: number | null;
  /** The envelope's code, or null for gateway and network failures. */
  code: WireErrorCode | null;
  message: string | null;
}

/** The server's error detail behind an ApiError from this client, or null. */
export function serverError(error: unknown): ServerErrorDetail | null {
  if (!(error instanceof ApiError)) return null;
  const cause = error.cause;
  return typeof cause === 'object' && cause !== null && (cause as { kind?: unknown }).kind === 'product-api'
    ? (cause as ServerErrorDetail)
    : null;
}

/** Shortcut: the envelope code (e.g. 'ALREADY_COMPLETED') behind an error, or null. */
export function serverErrorCode(error: unknown): WireErrorCode | null {
  return serverError(error)?.code ?? null;
}

const MESSAGES: Record<ApiErrorCode, string> = {
  offline: "You're offline. Check your connection and try again.",
  timeout: 'That took too long. Check your connection and try again.',
  unauthorized: "You've been signed out. Sign in again to continue.",
  invalid_credentials: "That password doesn't match this email.",
  email_taken: 'An account already uses this email.',
  weak_password: 'Use at least 8 characters.',
  not_found: "We couldn't find that. It may have changed meanwhile.",
  validation: "Something in that wasn't right, so nothing was saved.",
  generation_failed: "Something went wrong on our side. Your plan hasn't changed.",
  stale_version: 'Your plan changed meanwhile, so nothing was overwritten.',
  conflict: 'That clashes with something already saved. Reload and try again.',
  ai_unavailable: "Planning isn't switched on yet. Your answers are saved.",
  confirmation_required: 'Check your inbox to confirm your email, then sign in.',
  not_configured: "This build isn't connected to a server yet.",
  unknown: 'Something went wrong on our side. Try again in a moment.',
};

/** Wire codes whose meaning is more specific than their mobile code. */
const SERVER_MESSAGES: Partial<Record<WireErrorCode, string>> = {
  ALREADY_COMPLETED: 'This session is already logged.',
  NOTHING_TO_UNDO: 'There is nothing to undo.',
  UNDO_LOCKED: "This change can't be undone, because a session in it is already done.",
};

/** The app's default message for a code. */
export function defaultErrorMessage(code: ApiErrorCode): string {
  return MESSAGES[code];
}

const detail = (status: number | null, code: WireErrorCode | null, message: string | null): ServerErrorDetail => ({
  kind: 'product-api',
  status,
  code,
  message,
});

function isErrorEnvelope(body: unknown): body is { error: { code: WireErrorCode; message: string; retryable: boolean } } {
  if (typeof body !== 'object' || body === null || !('error' in body)) return false;
  const error = (body as { error: unknown }).error;
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as { code?: unknown }).code === 'string' &&
    typeof (error as { retryable?: unknown }).retryable === 'boolean'
  );
}

/** A gateway's own message (`{msg}`, `{message}`), for the error's cause only. */
function gatewayMessage(body: unknown, text: string): string | null {
  if (typeof body === 'object' && body !== null) {
    const { msg, message } = body as { msg?: unknown; message?: unknown };
    if (typeof message === 'string') return message;
    if (typeof msg === 'string') return msg;
  }
  return text ? text.slice(0, 200) : null;
}

/**
 * An HTTP error response as an ApiError, following the plan's mapping table:
 * 400/405/413 validation, 401 unauthorized, 404 not_found, VERSION_CONFLICT
 * stale_version, other 409 conflict, 501 AI_NOT_CONFIGURED ai_unavailable,
 * 502/503 AI failures generation_failed, other 5xx unknown. The server's
 * retryable flag is kept; gateway errors (no envelope) get a sensible default.
 */
export function errorFromResponse(status: number, body: unknown, text = ''): ApiError {
  const envelope = isErrorEnvelope(body) ? body.error : null;
  const wire = envelope?.code ?? null;
  const cause = detail(status, wire, envelope?.message ?? gatewayMessage(body, text));
  const make = (code: ApiErrorCode, retryable: boolean) =>
    new ApiError(code, (wire && SERVER_MESSAGES[wire]) ?? MESSAGES[code], { retryable, cause });
  const serverRetryable = (fallback: boolean) => envelope?.retryable ?? fallback;

  if (wire === 'AI_NOT_CONFIGURED') return make('ai_unavailable', false);
  if (wire === 'VERSION_CONFLICT') return make('stale_version', serverRetryable(false));
  if (wire === 'INVALID_AI_OUTPUT' || wire === 'PROVIDER_UNAVAILABLE') return make('generation_failed', serverRetryable(true));
  if (status === 400 || status === 405 || status === 413 || status === 422) return make('validation', false);
  if (status === 401 || status === 403) return make('unauthorized', false);
  if (status === 404) return make('not_found', false);
  if (status === 409) return make('conflict', serverRetryable(false));
  if (status === 408 || status === 504) return make('timeout', true);
  if (status === 429) return make('unknown', true);
  // Gateway and platform failures without an envelope (502, 503, 546) are usually brief.
  if (status >= 500) return make('unknown', serverRetryable(!envelope));
  return make('unknown', serverRetryable(false));
}

/** A thrown fetch or token failure as an ApiError: abort is a timeout, anything else is the network. */
export function transportError(error: unknown, timedOut: boolean): ApiError {
  if (error instanceof ApiError) return error;
  if (timedOut || (error instanceof Error && error.name === 'AbortError')) {
    return new ApiError('timeout', MESSAGES.timeout, { cause: detail(null, null, null) });
  }
  return new ApiError('offline', MESSAGES.offline, {
    cause: detail(null, null, error instanceof Error ? error.message : null),
  });
}

function buildUrl(baseUrl: string, path: string, query?: Record<string, QueryValue>): string {
  const params = Object.entries(query ?? {})
    .filter((entry): entry is [string, string | number] => entry[1] !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  return `${baseUrl}${path}${params.length ? `?${params.join('&')}` : ''}`;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function createProductApi(options: ProductApiOptions): ProductApi {
  const sleep = options.sleep ?? defaultSleep;

  async function accessToken(forceRefresh: boolean): Promise<string> {
    let token: string | null;
    try {
      token = await options.getAccessToken(forceRefresh);
    } catch (error) {
      throw transportError(error, false);
    }
    if (!token) throw new ApiError('unauthorized', MESSAGES.unauthorized, { cause: detail(401, null, null) });
    return token;
  }

  /** One HTTP exchange, body read included, within the timeout. */
  async function exchange(
    method: 'GET' | 'PUT' | 'POST',
    url: string,
    token: string,
    body: string | undefined,
    timeoutMs: number,
  ): Promise<{ status: number; ok: boolean; text: string }> {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        apikey: options.publishableKey,
        Accept: 'application/json',
      };
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      const response = await options.fetch(url, { method, headers, body, signal: controller.signal });
      const text = await response.text();
      return { status: response.status, ok: response.ok, text };
    } catch (error) {
      throw transportError(error, timedOut);
    } finally {
      clearTimeout(timer);
    }
  }

  async function request<T>(
    method: 'GET' | 'PUT' | 'POST',
    path: string,
    body: unknown,
    query: Record<string, QueryValue> | undefined,
    post: PostOptions,
  ): Promise<T> {
    const url = buildUrl(options.baseUrl, path, query);
    // Serialized once: a retry resends exactly the same bytes (same request_id, same captured_at).
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const timeoutMs = post.timeoutMs ?? options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    let token: string | null = null;
    let refreshed = false;
    let transportRetries = 0;

    for (;;) {
      try {
        token ??= await accessToken(false);
        const response = await exchange(method, url, token, payload, timeoutMs);
        if (response.status === 401 && !refreshed) {
          // The access token may have expired between reads: refresh once and resend once.
          refreshed = true;
          token = await accessToken(true);
          continue;
        }
        let parsed: unknown = null;
        try {
          parsed = response.text ? JSON.parse(response.text) : null;
        } catch {
          parsed = null;
        }
        if (!response.ok) throw errorFromResponse(response.status, parsed, response.text);
        if (typeof parsed !== 'object' || parsed === null || !('data' in parsed)) {
          throw new ApiError('unknown', MESSAGES.unknown, {
            retryable: false,
            cause: detail(response.status, null, 'The response had no data envelope.'),
          });
        }
        // The envelope is trusted to match the contract: mobile does not validate responses at runtime.
        return (parsed as { data: T }).data;
      } catch (error) {
        const failure = transportError(error, false);
        const transport = failure.code === 'offline' || failure.code === 'timeout';
        if (post.retryTransport && transport && transportRetries < RETRY_BACKOFF_MS.length) {
          await sleep(RETRY_BACKOFF_MS[transportRetries]);
          transportRetries += 1;
          continue;
        }
        throw failure;
      }
    }
  }

  return {
    get: (path, query) => request('GET', path, undefined, query, {}),
    put: (path, body, post) => request('PUT', path, body, undefined, post ?? {}),
    post: (path, body, post) => request('POST', path, body, undefined, post ?? {}),
  };
}
