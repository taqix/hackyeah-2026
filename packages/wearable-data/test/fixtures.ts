import type { Connection, SourceEventV1, SyncRequest } from '@hackyeah/contracts/wearables';

export const now = '2026-10-03T12:00:00.000Z';
export function connection(overrides: Partial<Connection> = {}): Connection {
  return {
    id: 'connection',
    user_id: 'alice',
    provider: 'garmin',
    provider_subject: 'account-1',
    transport: 'garmin_api',
    state: 'active',
    generation: 1,
    reader: null,
    consent: {
      datasets: ['workouts', 'sleep', 'observations', 'daily_summaries'],
      hrv: true,
      detailed_sensors: true,
      ai_context: false,
      policy_version: 'v1',
    },
    capabilities: Object.fromEntries(
      ['workouts', 'sleep', 'observations', 'daily_summaries'].map((dataset) => [
        dataset,
        { availability: 'available', evidence: 'synthetic-fixture', version: 'v1' },
      ]),
    ),
    ...overrides,
  };
}
export function event(overrides: Partial<SourceEventV1> = {}): SourceEventV1 {
  return {
    schema_version: '1.0',
    connection_id: 'connection',
    connection_generation: 1,
    provider: 'garmin',
    dataset: 'workouts',
    external_id: 'workout:1',
    ingest_event_id: 'event-1',
    operation: 'upsert',
    observed_at: now,
    source_updated_at: '2026-10-03T10:00:00.000Z',
    revision: null,
    raw_object_ref: null,
    payload: {
      kind: 'workout',
      start_at: '2026-10-02T10:00:00.000Z',
      end_at: '2026-10-02T10:10:00.000Z',
      source_sport: 'running',
      normalized_sport: null,
      elapsed_seconds: 600,
      timer_seconds: null,
      moving_seconds: null,
      distance_meters: 1000,
      source_timezone: null,
      source_utc_offset_seconds: null,
      field_availability: {
        elapsed_seconds: 'available',
        timer_seconds: 'unknown',
        moving_seconds: 'unknown',
        distance_meters: 'available',
      },
      provenance: {
        adapter_version: 'fixture-v1',
        transform_version: 'workout-v1',
        import_mode: 'official_api',
        source_identifiers: { activity_id: '1' },
        timezone_origin: 'unknown',
      },
    },
    ...overrides,
  };
}
export function changedEvent(overrides: Partial<SourceEventV1> = {}): SourceEventV1 {
  const result = event({
    ingest_event_id: 'event-2',
    source_updated_at: '2026-10-03T11:00:00.000Z',
    ...overrides,
  });
  if (result.payload?.kind === 'workout') result.payload.distance_meters = 2000;
  return result;
}
export const request: SyncRequest = {
  connection_id: 'connection',
  connection_generation: 1,
  dataset: 'workouts',
  query_id: 'recent-v1',
  start_at: '2026-10-01T00:00:00.000Z',
  end_at: '2026-10-04T00:00:00.000Z',
};
export const range = {
  dataset: 'workouts' as const,
  start_at: request.start_at,
  end_at: request.end_at,
};
