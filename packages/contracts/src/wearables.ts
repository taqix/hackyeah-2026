import { z } from 'zod';

export const providerSchema = z.enum(['garmin', 'coros', 'apple_health']);
export const datasetSchema = z.enum(['workouts', 'sleep', 'observations', 'daily_summaries']);
export const availabilitySchema = z.enum([
  'available',
  'no_data',
  'unsupported',
  'unknown',
  'restricted',
  'error',
]);
export const freshnessSchema = z.enum(['fresh', 'stale', 'unknown']);
export const identifierSchema = z.string().min(1).max(256);
export const instantSchema = z.iso
  .datetime({ offset: true })
  .transform((value) => new Date(value).toISOString());
export const localDateSchema = z.iso.date();
const finite = z.number().finite();
const nonnegative = finite.nonnegative();
const timezone = z
  .string()
  .max(100)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat('en', { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, 'Invalid IANA timezone');
const sourceTime = {
  source_timezone: timezone.nullable(),
  source_utc_offset_seconds: z.number().int().min(-86400).max(86400).nullable(),
};
export const provenanceSchema = z.strictObject({
  adapter_version: identifierSchema,
  transform_version: identifierSchema,
  import_mode: z.enum([
    'manual',
    'export_bridge',
    'official_api',
    'official_mcp',
    'native_healthkit',
  ]),
  source_identifiers: z.record(identifierSchema, identifierSchema),
  timezone_origin: identifierSchema,
  source_application: identifierSchema.optional(),
  source_device: identifierSchema.optional(),
});
const provenance = { provenance: provenanceSchema };
const fieldAvailability = z.record(z.string(), availabilitySchema);
const durations = {
  elapsed_seconds: nonnegative.nullable(),
  timer_seconds: nonnegative.nullable(),
  moving_seconds: nonnegative.nullable(),
  distance_meters: nonnegative.nullable(),
};
const parent = {
  parent_external_id: identifierSchema.regex(/^workout:.+/),
  parent_kind: z.literal('workout'),
};
const workout = z.strictObject({
  kind: z.literal('workout'),
  start_at: instantSchema,
  end_at: instantSchema.nullable(),
  source_sport: identifierSchema,
  normalized_sport: identifierSchema.nullable(),
  ...durations,
  ...sourceTime,
  ...provenance,
  field_availability: fieldAvailability,
});
const lap = z.strictObject({
  kind: z.literal('workout_lap'),
  ...parent,
  source_lap_id: identifierSchema,
  order: z.number().int().nonnegative(),
  start_at: instantSchema,
  end_at: instantSchema,
  ...durations,
  ...provenance,
});
const sleepSession = z.strictObject({
  kind: z.literal('sleep_session'),
  start_at: instantSchema,
  end_at: instantSchema,
  episode_type: z.enum(['night', 'nap', 'unknown']),
  total_asleep_seconds: nonnegative.nullable(),
  source_local_date: localDateSchema.nullable(),
  ...sourceTime,
  ...provenance,
  field_availability: fieldAvailability,
});
export const sleepStageSchema = z.enum([
  'awake',
  'light',
  'deep',
  'rem',
  'asleep_unspecified',
  'in_bed',
  'unknown',
]);
const sleepSegment = z.strictObject({
  kind: z.literal('sleep_segment'),
  start_at: instantSchema,
  end_at: instantSchema,
  stage: sleepStageSchema,
  source_stage: identifierSchema,
  ...provenance,
});
const observation = z.strictObject({
  kind: z.literal('observation'),
  metric: identifierSchema,
  value: finite.nullable(),
  unit: identifierSchema.nullable(),
  method: identifierSchema,
  aggregation: identifierSchema,
  start_at: instantSchema.nullable(),
  end_at: instantSchema.nullable(),
  source_local_date: localDateSchema.nullable(),
  ...sourceTime,
  ...provenance,
  availability: availabilitySchema,
  source_sample_count: z.number().int().nonnegative().nullable().optional(),
});
const dailySummary = z.strictObject({
  kind: z.literal('daily_summary'),
  metric: identifierSchema,
  source_local_date: localDateSchema,
  ...sourceTime,
  ...provenance,
  value: finite.nullable(),
  unit: identifierSchema.nullable(),
  definition: identifierSchema,
  availability: availabilitySchema,
});

export const payloadSchema = z
  .discriminatedUnion('kind', [workout, lap, sleepSession, sleepSegment, observation, dailySummary])
  .superRefine((value, ctx) => {
    const invalid = (message: string) => ctx.addIssue({ code: 'custom', message });
    if ('start_at' in value && value.start_at && value.end_at) {
      const duration = (Date.parse(value.end_at) - Date.parse(value.start_at)) / 1000;
      if (duration < 0 || (duration === 0 && value.kind !== 'observation'))
        invalid('Invalid measurement interval');
      if (
        value.kind === 'sleep_session' &&
        value.total_asleep_seconds !== null &&
        value.total_asleep_seconds > duration
      ) {
        invalid('Sleep duration exceeds episode interval');
      }
    }
    if (
      value.kind === 'observation' &&
      !value.start_at &&
      (!value.source_local_date || value.end_at)
    ) {
      invalid('Date-only observations require a source date and no end instant');
    }
    if ('availability' in value && value.availability === 'available' && value.value === null)
      invalid('Available metrics require a value');
    if (
      value.kind === 'observation' &&
      value.metric === 'hrv' &&
      (value.unit !== 'ms' || (value.value !== null && value.value < 0))
    ) {
      invalid('Comparable HRV requires milliseconds and a nonnegative value');
    }
    if ('field_availability' in value) {
      const fields = value.kind === 'workout' ? Object.keys(durations) : ['total_asleep_seconds'];
      for (const field of fields) {
        const entry = Reflect.get(value, field);
        const availability = value.field_availability[field];
        if (
          !availability ||
          (entry === null && availability === 'available') ||
          (entry !== null && availability !== 'available')
        ) {
          invalid('Summary values and field availability must agree');
        }
      }
    }
  });

export const datasetForKind = {
  workout: 'workouts',
  workout_lap: 'workouts',
  sleep_session: 'sleep',
  sleep_segment: 'sleep',
  observation: 'observations',
  daily_summary: 'daily_summaries',
} as const;

const eventIdentity = {
  dataset: datasetSchema,
  external_id: identifierSchema,
  operation: z.enum(['upsert', 'delete']),
  observed_at: instantSchema,
  payload: payloadSchema.nullable(),
};
function validateEvent(
  value: { dataset: Dataset; external_id: string; operation: string; payload: Payload | null },
  ctx: z.RefinementCtx,
) {
  if ((value.operation === 'delete') !== (value.payload === null)) {
    ctx.addIssue({ code: 'custom', message: 'Only deletions have a null payload' });
  }
  const kind = value.external_id.split(':')[0];
  if (
    !kind ||
    value.external_id.length <= kind.length + 1 ||
    !(kind in datasetForKind) ||
    datasetForKind[kind as keyof typeof datasetForKind] !== value.dataset ||
    (value.payload && kind !== value.payload.kind)
  ) {
    ctx.addIssue({
      code: 'custom',
      message: 'External ID must be namespaced by its dataset record kind',
    });
  }
}
export const sourceEventSchema = z
  .strictObject({
    schema_version: z.literal('1.0'),
    ingest_event_id: identifierSchema,
    connection_id: identifierSchema,
    connection_generation: z.number().int().positive(),
    provider: providerSchema,
    ...eventIdentity,
    source_updated_at: instantSchema.nullable(),
    revision: identifierSchema.nullable(),
    raw_object_ref: z.null(), // Artifact retention requires a separate, consent-aware storage implementation.
  })
  .superRefine(validateEvent);

export const appleBatchSchema = z.strictObject({
  schema_version: z.literal('1.0'),
  connection_id: identifierSchema,
  connection_generation: z.number().int().positive(),
  bridge_id: identifierSchema,
  reader_epoch: z.number().int().positive(),
  stream_id: z.literal('apple_health_source'),
  batch_sequence: z.number().int().positive(),
  batch_id: identifierSchema,
  created_at: instantSchema,
  events: z
    .array(
      z
        .strictObject({ ...eventIdentity, query_version: identifierSchema })
        .superRefine(validateEvent),
    )
    .max(500),
});

export const consentSchema = z.strictObject({
  datasets: z
    .array(datasetSchema)
    .max(4)
    .refine((v) => new Set(v).size === v.length),
  hrv: z.boolean(),
  detailed_sensors: z.boolean(),
  ai_context: z.boolean(),
  policy_version: identifierSchema,
});
export const connectionSchema = z.strictObject({
  id: identifierSchema,
  user_id: identifierSchema,
  provider: providerSchema,
  provider_subject: identifierSchema,
  transport: z.enum(['manual', 'garmin_api', 'coros_mcp', 'native_healthkit', 'export_bridge']),
  state: z.enum([
    'pending_authorization',
    'active',
    'reauth_required',
    'suspended',
    'disconnecting',
    'disconnected',
  ]),
  generation: z.number().int().positive(),
  consent: consentSchema,
  capabilities: z.partialRecord(
    datasetSchema,
    z.strictObject({
      availability: availabilitySchema,
      evidence: identifierSchema,
      version: identifierSchema,
    }),
  ),
  reader: z
    .strictObject({
      bridge_id: identifierSchema,
      epoch: z.number().int().positive(),
      sequence: z.number().int().nonnegative(),
    })
    .nullable(),
});
export const syncRequestSchema = z
  .strictObject({
    connection_id: identifierSchema,
    connection_generation: z.number().int().positive(),
    dataset: datasetSchema,
    query_id: identifierSchema,
    start_at: instantSchema,
    end_at: instantSchema,
  })
  .refine(
    (v) =>
      Date.parse(v.end_at) > Date.parse(v.start_at) &&
      Date.parse(v.end_at) - Date.parse(v.start_at) <= 31 * 86400000,
    'Sync windows must be positive and at most 31 days',
  );

export type Provider = z.infer<typeof providerSchema>;
export type Dataset = z.infer<typeof datasetSchema>;
export type Availability = z.infer<typeof availabilitySchema>;
export type Freshness = z.infer<typeof freshnessSchema>;
export type Payload = z.infer<typeof payloadSchema>;
export type Provenance = z.infer<typeof provenanceSchema>;
export type SourceEventV1 = z.infer<typeof sourceEventSchema>;
export type AppleBatch = z.infer<typeof appleBatchSchema>;
export type Connection = z.infer<typeof connectionSchema>;
export type Consent = z.infer<typeof consentSchema>;
export type SyncRequest = z.infer<typeof syncRequestSchema>;
