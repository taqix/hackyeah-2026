import { z } from 'zod';
import {
  instantSchema,
  payloadSchema,
  type Payload,
  type Provenance,
} from '@hackyeah/contracts/wearables';
import { parse } from '../errors.js';

// Internal native-reader boundary, not an Apple cloud API or Health Auto Export schema.
const common = {
  uuid: z.string().min(1).max(200),
  start_at: instantSchema,
  end_at: instantSchema,
  source_application: z.string().min(1).max(256),
  source_device: z.string().min(1).max(256).optional(),
};
export const healthKitSampleSchema = z.discriminatedUnion('type', [
  z.strictObject({
    ...common,
    type: z.literal('workout'),
    sport: z.string().min(1),
    distance_meters: z.number().finite().nonnegative().nullable(),
  }),
  z.strictObject({ ...common, type: z.literal('sleep'), stage: z.string().min(1) }),
  z.strictObject({
    ...common,
    type: z.literal('hrv_sdnn'),
    value: z.number().finite().nonnegative(),
    unit: z.enum(['s', 'ms']),
  }),
  z.strictObject({
    ...common,
    type: z.literal('resting_heart_rate'),
    value: z.number().finite().nonnegative(),
    unit: z.literal('bpm'),
  }),
]);

export function normalizeHealthKitSample(input: unknown): {
  external_id: string;
  payload: Payload;
} {
  const sample = parse(healthKitSampleSchema, input);
  const provenance: Provenance = {
    adapter_version: 'apple-health-v1',
    transform_version: 'apple-health-v1',
    import_mode: 'native_healthkit',
    source_identifiers: { sample_uuid: sample.uuid },
    timezone_origin: 'unknown',
    source_application: sample.source_application,
    ...(sample.source_device ? { source_device: sample.source_device } : {}),
  };
  const time = { source_timezone: null, source_utc_offset_seconds: null };
  const interval = { start_at: sample.start_at, end_at: sample.end_at };
  let payload: Payload;
  if (sample.type === 'workout') {
    payload = parse(payloadSchema, {
      kind: 'workout',
      ...interval,
      ...time,
      provenance,
      source_sport: sample.sport,
      normalized_sport: null,
      elapsed_seconds: (Date.parse(sample.end_at) - Date.parse(sample.start_at)) / 1000,
      timer_seconds: null,
      moving_seconds: null,
      distance_meters: sample.distance_meters,
      field_availability: {
        elapsed_seconds: 'available',
        timer_seconds: 'unknown',
        moving_seconds: 'unknown',
        distance_meters: sample.distance_meters === null ? 'unknown' : 'available',
      },
    });
  } else if (sample.type === 'sleep') {
    const stages: Record<string, string> = {
      inBed: 'in_bed',
      awake: 'awake',
      asleepCore: 'light',
      asleepDeep: 'deep',
      asleepREM: 'rem',
      asleepUnspecified: 'asleep_unspecified',
      asleep: 'asleep_unspecified',
    };
    payload = parse(payloadSchema, {
      kind: 'sleep_segment',
      ...interval,
      provenance,
      stage: stages[sample.stage] ?? 'unknown',
      source_stage: sample.stage,
    });
  } else {
    payload = parse(payloadSchema, {
      kind: 'observation',
      ...interval,
      ...time,
      provenance,
      metric: sample.type === 'hrv_sdnn' ? 'hrv' : 'resting_heart_rate',
      value: sample.value * (sample.unit === 's' ? 1000 : 1),
      unit: sample.type === 'hrv_sdnn' ? 'ms' : 'bpm',
      method: sample.type === 'hrv_sdnn' ? 'sdnn' : 'source_reported',
      aggregation: 'source_sample',
      source_local_date: null,
      availability: 'available',
    });
  }
  return { external_id: `${payload.kind}:${sample.uuid}`, payload };
}
