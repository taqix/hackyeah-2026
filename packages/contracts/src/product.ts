import { z } from 'zod';
export { z } from 'zod';

export const uuidSchema = z.uuid();
// PostgreSQL bigint IDs travel as decimal strings to avoid JavaScript precision loss.
export const sportIdSchema = z
  .string()
  .regex(/^[1-9][0-9]{0,18}$/)
  .refine(
    (value) => /^[1-9][0-9]{0,18}$/.test(value) && BigInt(value) <= 9223372036854775807n,
    'Expected a positive PostgreSQL bigint ID',
  );
const instant = z.iso.datetime({ offset: true });
export const timezoneSchema = z
  .string()
  .max(100)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat('en', { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, 'Expected an IANA timezone');
const shortText = z.string().trim().min(1).max(200);
const minutes = z.number().int().min(5).max(60).multipleOf(5);
const unique = <T>(values: T[]) => new Set(values).size === values.length;

export const preferencesSchema = z
  .strictObject({
    starting_comfort: z.enum(['starting_out', 'occasionally_active', 'some_routine']),
    sessions_per_week: z.number().int().min(1).max(7),
    session_minutes: minutes,
    preferred_window: z
      .strictObject({
        start_hour: z.number().int().min(7).max(20),
        end_hour: z.number().int().min(8).max(21),
      })
      .refine((window) => window.end_hour > window.start_hour)
      .nullable(),
    activity_interests: z.array(sportIdSchema).max(20).refine(unique),
    discovery_preference: z.enum(['selected_only', 'occasional', 'explore']),
    available_locations: z
      .array(z.enum(['home', 'outdoors', 'gym', 'pool']))
      .min(1)
      .max(4)
      .refine(unique),
    available_equipment: z
      .array(z.enum(['mat', 'resistance_band', 'dumbbells', 'bicycle', 'stationary_bike']))
      .max(5)
      .refine(unique),
    avoidances: z
      .array(z.enum(['jumping', 'floor_exercises', 'noisy_activities']))
      .max(3)
      .refine(unique),
    starting_obstacles: z
      .array(z.enum(['time', 'low_energy', 'boredom', 'uncertainty', 'discomfort']))
      .max(5)
      .refine(unique),
    excluded_activity_types: z.array(sportIdSchema).max(20).refine(unique),
    timezone: timezoneSchema,
  })
  .refine(
    (value) => value.activity_interests.length > 0 || value.discovery_preference === 'explore',
    {
      message: 'No selected sports requires explore',
      path: ['discovery_preference'],
    },
  );
export type PreferencesDto = z.infer<typeof preferencesSchema>;

export const metricDefinitionSchema = z
  .strictObject({
    key: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/),
    label: shortText,
    unit: z.string().max(40).nullable(),
    type: z.enum(['number', 'text']),
    required: z.boolean(),
    minimum: z.number().finite().optional(),
    maximum: z.number().finite().optional(),
  })
  .refine(
    (value) =>
      value.minimum === undefined || value.maximum === undefined || value.minimum <= value.maximum,
    'Metric minimum must not exceed maximum',
  );
export const sportSchema = z.strictObject({
  id: sportIdSchema,
  name: shortText,
  is_gym: z.boolean(),
  generation_enabled: z.boolean(),
  metrics: z
    .array(metricDefinitionSchema)
    .max(5)
    .refine((values) => unique(values.map((v) => v.key))),
});
export type SportEntity = z.infer<typeof sportSchema>;
export const profileSchema = z.strictObject({
  id: uuidSchema,
  username: shortText.nullable(),
  created_at: instant.nullable(),
  preferences: preferencesSchema.nullable(),
});
export type ProfileEntity = z.infer<typeof profileSchema>;

export const availableSlotSchema = z
  .strictObject({ start_at: instant, end_at: instant })
  .refine((slot) => Date.parse(slot.end_at) > Date.parse(slot.start_at));
export const availabilitySchema = z.strictObject({
  source: z.enum(['device_calendar', 'manual']),
  captured_at: instant,
  slots: z
    .array(availableSlotSchema)
    .max(100)
    .refine((slots) =>
      slots.every(
        (slot, i) => i === 0 || Date.parse(slot.start_at) >= Date.parse(slots[i - 1]!.end_at),
      ),
    ),
});
export const gymExerciseSchema = z.strictObject({
  id: shortText,
  name: shortText,
  sets: z
    .array(z.strictObject({ repetitions: z.number().int().min(1).max(100) }))
    .min(1)
    .max(10),
});
export const plannedActivitySchema = z.strictObject({
  id: uuidSchema,
  sport_id: sportIdSchema,
  title: shortText,
  description: z.string().min(1).max(2000),
  start_at: instant,
  duration_minutes: minutes,
  gym_exercises: z
    .array(gymExerciseSchema)
    .max(20)
    .refine((values) => unique(values.map((value) => value.id))),
});
export const planSnapshotSchema = z
  .strictObject({
    week_start: z.iso.date(),
    timezone: timezoneSchema,
    // A saved empty week is a valid result; no saved plan is represented by null.
    activities: z.array(plannedActivitySchema).max(7),
  })
  .superRefine((value, context) => {
    if (!unique(value.activities.map((activity) => activity.id))) {
      context.addIssue({
        code: 'custom',
        message: 'Activity IDs must be unique',
        path: ['activities'],
      });
    }
    if (
      !z.iso.date().safeParse(value.week_start).success ||
      !timezoneSchema.safeParse(value.timezone).success
    )
      return;
    const weekEnd = new Date(Date.parse(`${value.week_start}T00:00:00Z`) + 7 * 86400000)
      .toISOString()
      .slice(0, 10);
    const dates = new Intl.DateTimeFormat('en-CA', {
      timeZone: value.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const ordered = [...value.activities].sort(
      (a, b) => Date.parse(a.start_at) - Date.parse(b.start_at),
    );
    ordered.forEach((activity, index) => {
      const end = Date.parse(activity.start_at) + activity.duration_minutes * 60000;
      if (!Number.isFinite(end)) return;
      const localStart = dates.format(new Date(activity.start_at));
      const localEnd = dates.format(new Date(end - 1));
      if (
        localStart < value.week_start ||
        localEnd >= weekEnd ||
        (index > 0 &&
          Date.parse(activity.start_at) <
            Date.parse(ordered[index - 1]!.start_at) + ordered[index - 1]!.duration_minutes * 60000)
      ) {
        context.addIssue({
          code: 'custom',
          message: 'Sessions must fit the week and cannot overlap',
          path: ['activities'],
        });
      }
    });
  });
export type PlanSnapshotDto = z.infer<typeof planSnapshotSchema>;
export const planSchema = z.strictObject({
  id: uuidSchema,
  profile_id: uuidSchema,
  active_version_id: uuidSchema.nullable(),
  created_at: instant,
});
export type PlanEntity = z.infer<typeof planSchema>;
export const planVersionSchema = z.strictObject({
  id: uuidSchema,
  plan_id: uuidSchema,
  profile_id: uuidSchema,
  version: z.number().int().positive(),
  // An undo restores the previous same-week snapshot as a new version.
  origin: z.enum(['generate', 'revise', 'undo']),
  plan: planSnapshotSchema,
  summary: z.string().min(1).max(1000),
  created_at: instant,
});
export type PlanVersionEntity = z.infer<typeof planVersionSchema>;
export const activePlanSchema = z.strictObject({ plan: planSchema, version: planVersionSchema });
export type ActivePlanDto = z.infer<typeof activePlanSchema>;

export const chatMessageSchema = z.strictObject({
  id: uuidSchema,
  profile_id: uuidSchema,
  plan_id: uuidSchema,
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(2000),
  outcome: z.enum(['plan_updated', 'reply', 'clarification']).nullable(),
  plan_version_id: uuidSchema.nullable(),
  created_at: instant,
  request_id: uuidSchema,
});
export type ChatMessageEntity = z.infer<typeof chatMessageSchema>;
export const gymLogSchema = z
  .array(
    z.strictObject({
      exercise_id: shortText,
      sets: z
        .array(
          z.strictObject({
            repetitions: z.number().int().min(0).max(100),
            weight_kg: z.number().finite().min(0).max(1000).nullable(),
          }),
        )
        .min(1)
        .max(10),
    }),
  )
  .max(20)
  .refine((values) => unique(values.map((value) => value.exercise_id)));
export const metricValuesSchema = z
  .record(
    z.string().regex(/^[a-z][a-z0-9_]{0,39}$/),
    z.union([z.number().finite().nonnegative(), z.string().max(200)]),
  )
  .refine((value) => Object.keys(value).length <= 5);
export const feedbackSchema = z.strictObject({
  effort: z.enum(['easy', 'okay', 'hard', 'too_much']),
  // The current PoC field answers "Would you choose this again?"; null means no opinion.
  enjoyment: z.enum(['yes', 'maybe', 'no']).nullable(),
  notes: z.string().max(1000),
});
export const completionInputSchema = z.strictObject({
  plan_version_id: uuidSchema,
  activity_id: uuidSchema,
  request_id: uuidSchema,
  metrics: metricValuesSchema,
  gym_log: gymLogSchema,
  // Null saves the log first; feedback can be added later with UpdateFeedbackDto.
  feedback: feedbackSchema.nullable(),
  completed_at: instant,
});
export type CompleteActivityDto = z.infer<typeof completionInputSchema>;
export const completionSchema = completionInputSchema.extend({
  id: uuidSchema,
  profile_id: uuidSchema,
});
export type ActivityCompletionEntity = z.infer<typeof completionSchema>;
export const updateFeedbackSchema = z.strictObject({
  completion_id: uuidSchema,
  feedback: feedbackSchema,
});
export type UpdateFeedbackDto = z.infer<typeof updateFeedbackSchema>;
// "Would you choose this again?" kept per activity, independent of completions.
const opinionSchema = z.enum(['yes', 'maybe', 'no']);
export const activityKeySchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9][a-z0-9_-]*$/);
export const activityOpinionSchema = z.strictObject({
  activity_key: activityKeySchema,
  title: shortText,
  sport_id: sportIdSchema,
  opinion: opinionSchema,
  last_date: z.iso.date(),
  updated_at: instant,
});
export type ActivityOpinionEntity = z.infer<typeof activityOpinionSchema>;
export const putOpinionSchema = z.strictObject({
  activity_key: activityKeySchema,
  title: shortText,
  sport_id: sportIdSchema,
  // Null clears the saved opinion.
  opinion: opinionSchema.nullable(),
  last_date: z.iso.date(),
});
export type PutOpinionDto = z.infer<typeof putOpinionSchema>;
export const resetOpinionsSchema = z.strictObject({});
export type ResetOpinionsDto = z.infer<typeof resetOpinionsSchema>;
export const resetOpinionsResultSchema = z.strictObject({
  cleared: z.number().int().nonnegative(),
});
export type ResetOpinionsResultDto = z.infer<typeof resetOpinionsResultSchema>;
export const updateProfileSchema = z.strictObject({
  username: shortText.nullable(),
  preferences: preferencesSchema,
});
export type UpdateProfileDto = z.infer<typeof updateProfileSchema>;
export const generatePlanSchema = z.strictObject({
  request_id: uuidSchema,
  expected_version: z.number().int().nonnegative(),
  sport_id: sportIdSchema.nullable(),
  week_start: z.iso.date(),
  availability: availabilitySchema,
});
export type GeneratePlanDto = z.infer<typeof generatePlanSchema>;
export const sendChatSchema = z.strictObject({
  request_id: uuidSchema,
  plan_id: uuidSchema,
  expected_version: z.number().int().positive(),
  message: z.string().trim().min(1).max(2000),
  activity_id: uuidSchema.optional(),
  availability: availabilitySchema,
});
export type SendChatDto = z.infer<typeof sendChatSchema>;
export const undoPlanSchema = z.strictObject({
  request_id: uuidSchema,
  plan_id: uuidSchema,
  expected_version: z.number().int().positive(),
});
export type UndoPlanDto = z.infer<typeof undoPlanSchema>;

export const chatResultSchema = z.discriminatedUnion('outcome', [
  z.strictObject({
    outcome: z.literal('plan_updated'),
    active_plan: activePlanSchema,
    messages: z.array(chatMessageSchema).length(2),
  }),
  z.strictObject({
    outcome: z.enum(['reply', 'clarification']),
    active_plan: z.null(),
    messages: z.array(chatMessageSchema).length(2),
  }),
]);
export type ChatResultDto = z.infer<typeof chatResultSchema>;
export const errorCodeSchema = z.enum([
  'INVALID_REQUEST',
  'UNAUTHENTICATED',
  'NOT_FOUND',
  'VERSION_CONFLICT',
  'REQUEST_CONFLICT',
  'ALREADY_COMPLETED',
  'AI_NOT_CONFIGURED',
  'INVALID_AI_OUTPUT',
  'PROVIDER_UNAVAILABLE',
  'DATA_UNAVAILABLE',
  'INTERNAL_ERROR',
  'METHOD_NOT_ALLOWED',
  'PAYLOAD_TOO_LARGE',
  'NOTHING_TO_UNDO',
  'UNDO_LOCKED',
]);
export type ApiErrorCode = z.infer<typeof errorCodeSchema>;
export const metaSchema = z.strictObject({
  contract_version: z.literal('1'),
  request_id: uuidSchema.nullable(),
});
export const envelopeSchema = <T extends z.ZodType>(data: T) =>
  z.strictObject({ data, meta: metaSchema });
export const errorResponseSchema = z.strictObject({
  error: z.strictObject({ code: errorCodeSchema, message: z.string(), retryable: z.boolean() }),
  meta: metaSchema,
});
export const apiSchemas = {
  UpdateProfileDto: updateProfileSchema,
  GeneratePlanDto: generatePlanSchema,
  SendChatDto: sendChatSchema,
  CompleteActivityDto: completionInputSchema,
  UpdateFeedbackDto: updateFeedbackSchema,
  PutOpinionDto: putOpinionSchema,
  ResetOpinionsDto: resetOpinionsSchema,
  UndoPlanDto: undoPlanSchema,
  SchemaResponse: envelopeSchema(z.record(z.string(), z.record(z.string(), z.unknown()))),
  ProfileResponse: envelopeSchema(profileSchema),
  SportListResponse: envelopeSchema(z.array(sportSchema)),
  CurrentPlanResponse: envelopeSchema(activePlanSchema.nullable()),
  GeneratePlanResponse: envelopeSchema(activePlanSchema),
  PlanHistoryResponse: envelopeSchema(z.array(planVersionSchema)),
  ChatMessagesResponse: envelopeSchema(z.array(chatMessageSchema)),
  ChatResponse: envelopeSchema(chatResultSchema),
  CompletionResponse: envelopeSchema(completionSchema),
  CompletionListResponse: envelopeSchema(z.array(completionSchema)),
  OpinionListResponse: envelopeSchema(z.array(activityOpinionSchema)),
  OpinionResponse: envelopeSchema(activityOpinionSchema.nullable()),
  ResetOpinionsResponse: envelopeSchema(resetOpinionsResultSchema),
  UndoPlanResponse: envelopeSchema(activePlanSchema),
  ErrorResponse: errorResponseSchema,
};
export type ProfileResponseDto = z.infer<typeof apiSchemas.ProfileResponse>;
export type SchemaResponseDto = z.infer<typeof apiSchemas.SchemaResponse>;
export type SportListResponseDto = z.infer<typeof apiSchemas.SportListResponse>;
export type CurrentPlanResponseDto = z.infer<typeof apiSchemas.CurrentPlanResponse>;
export type GeneratePlanResponseDto = z.infer<typeof apiSchemas.GeneratePlanResponse>;
export type PlanHistoryResponseDto = z.infer<typeof apiSchemas.PlanHistoryResponse>;
export type ChatResponseDto = z.infer<typeof apiSchemas.ChatResponse>;
export type ChatMessagesResponseDto = z.infer<typeof apiSchemas.ChatMessagesResponse>;
export type CompletionResponseDto = z.infer<typeof apiSchemas.CompletionResponse>;
export type CompletionListResponseDto = z.infer<typeof apiSchemas.CompletionListResponse>;
export type OpinionListResponseDto = z.infer<typeof apiSchemas.OpinionListResponse>;
export type OpinionResponseDto = z.infer<typeof apiSchemas.OpinionResponse>;
export type ResetOpinionsResponseDto = z.infer<typeof apiSchemas.ResetOpinionsResponse>;
export type UndoPlanResponseDto = z.infer<typeof apiSchemas.UndoPlanResponse>;
export type ErrorResponseDto = z.infer<typeof errorResponseSchema>;
export function getProductJsonSchemas() {
  return Object.fromEntries(
    Object.entries(apiSchemas).map(([name, schema]) => [
      name,
      z.toJSONSchema(schema, { target: 'draft-2020-12' }),
    ]),
  );
}
