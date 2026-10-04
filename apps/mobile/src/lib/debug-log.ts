/**
 * Debug-only logging for the Metro terminal and React Native DevTools: one
 * readable line per event, `[movo:<scope>] <message>`, with an optional
 * compact details object after it. On only in development builds (`__DEV__`)
 * unless `EXPO_PUBLIC_DEBUG_LOGS=off`; release builds and Node tests get
 * no-op functions.
 *
 * Privacy (docs/development.md): never pass tokens, keys, Authorization
 * headers, passwords, full emails, chat text, feedback notes or calendar event
 * titles. Callers pass summaries (`summarizeBody`, `summarizeData`,
 * `describeError`, `maskEmail`, `shortId`); `sanitizeDetails` runs on every
 * details object as a safety net. Pure TypeScript with no React Native
 * imports, so Node tests and the calendar tests can compile it.
 */

/** Set by React Native and Expo web; undefined in Node. */
declare const __DEV__: boolean | undefined;

export type DebugScope =
  | 'http'
  | 'auth'
  | 'query'
  | 'mutation'
  | 'nav'
  | 'plan'
  | 'chat'
  | 'logs'
  | 'profile'
  | 'calendar'
  | 'app'
  | 'mock';

export type DebugDetails = Record<string, unknown>;
/** Details, or a function building them only when logging is on. */
export type DebugDetailsInput = DebugDetails | (() => DebugDetails);

export type DebugLevel = 'log' | 'warn' | 'error';
export type DebugSink = (level: DebugLevel, line: string, details?: DebugDetails) => void;

export interface DebugLogger {
  enabled: boolean;
  log(scope: DebugScope, message: string, details?: DebugDetailsInput): void;
  warn(scope: DebugScope, message: string, details?: DebugDetailsInput): void;
  error(scope: DebugScope, message: string, details?: DebugDetailsInput): void;
  /** Starts a stopwatch; the returned function gives the elapsed time, e.g. `812ms` or `12.3s`. */
  startTimer(): () => string;
}

const isDevBuild = typeof __DEV__ !== 'undefined' && __DEV__ === true;

/** True in a development build unless EXPO_PUBLIC_DEBUG_LOGS=off. Always false in release builds and Node. */
export const debugLogsEnabled =
  isDevBuild && (process.env.EXPO_PUBLIC_DEBUG_LOGS ?? '').trim().toLowerCase() !== 'off';

/* ------------------------------------------------------------- Formatting */

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const HAS_UUID = new RegExp(UUID.source, 'i');
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_INSIDE = /[^\s@/:]+@[^\s@/]+\.[^\s@/]+/g;
const JWT = /^eyJ[\w-]+\.[\w-]+/;
const JWT_INSIDE = /eyJ[\w-]+\.[\w-]+(?:\.[\w-]*)?/g;

export const linePrefix = (scope: DebugScope) => `[movo:${scope}]`;

/** The line as printed: emails masked, JWT-like tokens redacted and UUIDs shortened, whatever the caller wrote. */
export function formatLine(scope: DebugScope, message: string): string {
  const safe = shortenIds(message.replace(JWT_INSIDE, '[redacted]').replace(EMAIL_INSIDE, (email) => maskEmail(email)));
  return `${linePrefix(scope)} ${safe}`;
}

/** `812ms` below a second, `12.3s` above. */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '?ms';
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
}

/** UUIDs inside the value cut to their first 8 characters (`draft:1a2b3c4d`); other long values cut to 8. */
export function shortId(value: string | null | undefined): string {
  if (!value) return '-';
  const shortened = value.replace(UUID, (uuid) => uuid.slice(0, 8));
  if (shortened !== value) return shortened;
  return value.length > 16 ? `${value.slice(0, 8)}…` : value;
}

/** A route or URL path with every UUID shortened, e.g. `/session/1a2b3c4d`. */
export function shortenIds(path: string): string {
  return path.replace(UUID, (uuid) => uuid.slice(0, 8));
}

/** `anna@example.com` → `a***@example.com`; anything else → `***`. */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return '-';
  const trimmed = email.trim();
  if (!EMAIL.test(trimmed)) return '***';
  const at = trimmed.lastIndexOf('@');
  return `${trimmed[0]}***${trimmed.slice(at)}`;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const MAX_SHAPE_KEYS = 6;

/** A short shape: `null`, `array(7)`, `object{plan,version}`, `string(12)`, `number`. */
export function summarizeData(data: unknown): string {
  if (data === null) return 'null';
  if (data === undefined) return 'undefined';
  if (Array.isArray(data)) return `array(${data.length})`;
  if (typeof data === 'string') return `string(${data.length})`;
  if (isRecord(data)) {
    const keys = Object.keys(data);
    const shown = keys.slice(0, MAX_SHAPE_KEYS).join(',');
    return `object{${shown}${keys.length > MAX_SHAPE_KEYS ? ',…' : ''}}`;
  }
  return typeof data;
}

/** Body fields whose values are short IDs. */
const BODY_IDS = ['plan_id', 'activity_id', 'plan_version_id', 'completion_id'] as const;
/** Body fields whose values are safe scalars. */
const BODY_SCALARS = ['expected_version', 'week_start', 'sport_id', 'last_date', 'opinion'] as const;

/**
 * A request body as its keys and safe scalars only: short IDs, the expected
 * version, the week, the availability source and slot count, whether feedback
 * is given. Never a message, note, title, email or password.
 */
export function summarizeBody(body: unknown): DebugDetails {
  if (body === undefined) return {};
  if (!isRecord(body)) return { body: summarizeData(body) };
  const details: DebugDetails = { keys: Object.keys(body).join(',') };
  for (const key of BODY_IDS) {
    const value = body[key];
    if (typeof value === 'string') details[key] = shortId(value);
  }
  for (const key of BODY_SCALARS) {
    const value = body[key];
    if (value === null || typeof value === 'number' || typeof value === 'boolean') details[key] = value;
    else if (typeof value === 'string' && value.length <= 32) details[key] = value;
  }
  const availability = body.availability;
  if (isRecord(availability)) {
    const slots = Array.isArray(availability.slots) ? availability.slots.length : '?';
    details.availability = `${typeof availability.source === 'string' ? availability.source : '?'}×${slots}`;
  }
  if ('feedback' in body) details.feedback = body.feedback === null ? 'none' : 'given';
  if (Array.isArray(body.gym_log)) details.gym_sets = body.gym_log.length;
  if (isRecord(body.metrics)) details.metrics = Object.keys(body.metrics).join(',') || 'none';
  if (isRecord(body.preferences)) details.preferences = `object(${Object.keys(body.preferences).length} fields)`;
  return details;
}

/** A query string's values as `limit=100 offset=0 plan_id=1a2b3c4d`, IDs shortened. */
export function summarizeQuery(query: Record<string, string | number | undefined> | undefined): string {
  if (!query) return '';
  return Object.entries(query)
    .filter((entry): entry is [string, string | number] => entry[1] !== undefined)
    .map(([key, value]) => `${key}=${typeof value === 'number' ? value : shortId(value)}`)
    .join(' ');
}

/** A short error code, never an opaque one-time value such as a PKCE code. */
const looksLikeCode = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z][\w.-]{0,47}$/.test(value) && !HAS_UUID.test(value);

/**
 * What went wrong, as codes only: the app's ApiError code, the product API's
 * code and status, Supabase Auth's or the calendar's own code, and whether a
 * retry may help. Never the message of a server or Auth error.
 */
export function describeError(error: unknown): DebugDetails {
  if (!isRecord(error)) return { error: typeof error };
  const source = error;
  const details: DebugDetails = {};
  if (looksLikeCode(source.code)) details.code = source.code;
  const cause = source.cause;
  if (isRecord(cause) || cause instanceof Error) {
    const inner = cause as Record<string, unknown>;
    if (inner.kind === 'product-api') {
      if (looksLikeCode(inner.code)) details.server = inner.code;
      if (typeof inner.status === 'number') details.status = inner.status;
    } else if (cause instanceof Error || typeof inner.name === 'string') {
      // An Auth or calendar error; plain objects (redirect parameters) are skipped: they can carry a code.
      if (looksLikeCode(inner.code)) details.cause = inner.code;
      else if (looksLikeCode(inner.name)) details.cause = inner.name;
    }
  }
  if (typeof source.retryable === 'boolean') details.retryable = source.retryable;
  if (details.code === undefined && looksLikeCode(source.name)) details.error = source.name;
  return details;
}

/** The headline of an error for a log line: `ai_unavailable (AI_NOT_CONFIGURED)`. */
export function errorLabel(error: unknown): string {
  const { code, server, cause, error: name } = describeError(error);
  const main = typeof code === 'string' ? code : typeof name === 'string' ? name : 'error';
  const extra = typeof server === 'string' ? server : typeof cause === 'string' ? cause : null;
  return extra && extra !== main ? `${main} (${extra})` : main;
}

/* --------------------------------------------------------------- Redaction */

const SECRET_KEY = /token|secret|password|passwd|api_?key|authorization|cookie|credential|verifier|^session$/i;
const TEXT_KEY =
  /^(message|messages|text|notes?|title|description|body|content|summary|headline|name|username|full_name)$/i;
const EMAIL_KEY = /e-?mail/i;
const MAX_STRING = 120;
const MAX_LIST = 12;

function sanitizeString(value: string): string {
  if (JWT.test(value)) return '[redacted]';
  if (EMAIL.test(value.trim())) return maskEmail(value);
  const masked = shortenIds(value.replace(EMAIL_INSIDE, (email) => maskEmail(email)));
  return masked.length > MAX_STRING ? `${masked.slice(0, MAX_STRING)}…` : masked;
}

function sanitizeValue(key: string, value: unknown, depth: number): unknown {
  if (SECRET_KEY.test(key)) return '[redacted]';
  if (EMAIL_KEY.test(key)) return typeof value === 'string' ? maskEmail(value) : '[redacted]';
  if (TEXT_KEY.test(key)) return typeof value === 'string' ? `[text ${value.length}]` : summarizeData(value);
  if (value === null || value === undefined || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') return sanitizeString(value);
  if (Array.isArray(value)) {
    const scalars = value.every((item) => ['number', 'boolean', 'string'].includes(typeof item));
    if (!scalars || value.length > MAX_LIST) return `array(${value.length})`;
    return value.map((item) => sanitizeValue(key, item, depth + 1));
  }
  if (isRecord(value) && depth < 2) return sanitizeDetails(value, depth + 1);
  return summarizeData(value);
}

/**
 * Details made safe to print: secrets redacted, emails masked, free text as
 * its length, UUIDs shortened, long strings cut, nesting kept shallow.
 */
export function sanitizeDetails(details: DebugDetails, depth = 0): DebugDetails {
  const safe: DebugDetails = {};
  for (const [key, value] of Object.entries(details)) {
    if (value === undefined) continue;
    safe[key] = sanitizeValue(key, value, depth);
  }
  return safe;
}

/* ------------------------------------------------------------------ Logger */

/** The app's one console writer. */
const consoleSink: DebugSink = (level, line, details) => {
  const write = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  if (details) write(line, details);
  else write(line);
};

const noop = () => undefined;
const noTimer = () => '';

/** A logger writing to `sink` when `enabled`; disabled, every function is a no-op. */
export function createDebugLogger(options: { enabled: boolean; sink?: DebugSink; now?: () => number }): DebugLogger {
  if (!options.enabled) {
    return { enabled: false, log: noop, warn: noop, error: noop, startTimer: () => noTimer };
  }
  const sink = options.sink ?? consoleSink;
  const now = options.now ?? (() => Date.now());
  const write = (level: DebugLevel) => (scope: DebugScope, message: string, details?: DebugDetailsInput) => {
    let safe: DebugDetails | undefined;
    if (details) {
      try {
        safe = sanitizeDetails(typeof details === 'function' ? details() : details);
      } catch {
        safe = { details: 'unavailable' };
      }
    }
    sink(level, formatLine(scope, message), safe && Object.keys(safe).length ? safe : undefined);
  };
  return {
    enabled: true,
    log: write('log'),
    warn: write('warn'),
    error: write('error'),
    startTimer() {
      const started = now();
      return () => formatDuration(now() - started);
    },
  };
}

const logger = createDebugLogger({ enabled: debugLogsEnabled });

/** `[movo:<scope>] <message>` plus details, in development builds only. */
export const debugLog = logger.log;
/** A failure worth noticing (an API error, a retry); console.warn in development builds only. */
export const debugWarn = logger.warn;
/** Something unexpected; console.error in development builds only. */
export const debugError = logger.error;
/** A stopwatch for durations in log lines; returns '' in release builds. */
export const startTimer = logger.startTimer;
