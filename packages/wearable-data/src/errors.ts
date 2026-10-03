export type ErrorCode =
  | 'invalid_input'
  | 'not_found'
  | 'stale_generation'
  | 'consent_required'
  | 'unsupported'
  | 'idempotency_conflict'
  | 'sequence_gap'
  | 'schema_changed'
  | 'invalid_response'
  | 'reauth_required'
  | 'restricted'
  | 'rate_limited'
  | 'unavailable'
  | 'invalid_file'
  | 'too_large'
  | 'sync_in_progress';

export class WearableError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly retry_after_seconds: number | null = null,
  ) {
    super(code); // Never propagate provider bodies, signed URLs or health values into logs.
    this.name = 'WearableError';
  }
}

export function parse<T>(
  schema: { safeParse(value: unknown): { success: true; data: T } | { success: false } },
  value: unknown,
): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new WearableError('invalid_input');
  return result.data;
}
