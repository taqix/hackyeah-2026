/**
 * Google Calendar from the app: free/busy for planning and an opt-in "Movo"
 * calendar for planned sessions, called directly with the person's Google
 * access token. Pure TypeScript with relative imports only: the calendar test
 * runner compiles these files.
 */

/**
 * The only Google scopes the app asks for: free/busy (never event titles or
 * details) and calendars the app creates itself (the "Movo" export calendar).
 */
export const GOOGLE_CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.freebusy',
  'https://www.googleapis.com/auth/calendar.app.created',
] as const;

/** The scopes as Supabase's `scopes` option wants them: space-separated. */
export const GOOGLE_CALENDAR_SCOPE = GOOGLE_CALENDAR_SCOPES.join(' ');

/** The title of the secondary Google calendar the export creates. */
export const GOOGLE_MOVO_CALENDAR_TITLE = 'Movo';

export type GoogleCalendarErrorCode =
  /** No Google tokens are stored for this account. */
  | 'not_connected'
  /** Google no longer accepts the tokens, or refresh is unavailable: the person reconnects. */
  | 'reconnect_required'
  /** No answer: offline or timed out. */
  | 'offline'
  /** The calendar or event is gone (404 or 410). */
  | 'not_found'
  /** Any other answer from Google (5xx, 429, a 4xx that reconnecting cannot fix). */
  | 'google';

export class GoogleCalendarError extends Error {
  readonly code: GoogleCalendarErrorCode;
  /** HTTP status when Google or the product API answered. */
  readonly status: number | null;
  /** A short machine reason (Google's `reason` or the API's code), safe to log. */
  readonly reason: string | null;

  constructor(
    code: GoogleCalendarErrorCode,
    message: string,
    options: { status?: number | null; reason?: string | null; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = 'GoogleCalendarError';
    this.code = code;
    this.status = options.status ?? null;
    this.reason = options.reason ?? null;
  }
}

export const isGoogleCalendarError = (error: unknown, code?: GoogleCalendarErrorCode): error is GoogleCalendarError =>
  error instanceof GoogleCalendarError && (code === undefined || error.code === code);

/** The string API of AsyncStorage and of the secure store wrapper. */
export interface StringStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/** The part of a fetch Response the Google client reads. */
export interface GoogleFetchResponse {
  status: number;
  ok: boolean;
  text(): Promise<string>;
}

export interface GoogleFetchInit {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  headers: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
}

/** The global fetch, narrowed. Rejects on network failure and with an AbortError on abort. */
export type GoogleFetch = (url: string, init: GoogleFetchInit) => Promise<GoogleFetchResponse>;

/** A busy interval read from Google, as instants. */
export interface BusyInterval {
  startDate: Date;
  endDate: Date;
}
