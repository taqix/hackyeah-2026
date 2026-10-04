/**
 * Compile-time guard: the hand-written wire mirror (src/api/remote/wire.ts)
 * must match the shared contract source (packages/contracts/src/product.ts,
 * read by relative path) for every DTO and entity the app sends or reads,
 * including the extensions (nullable feedback, late feedback, opinions, undo).
 *
 * Each pair is checked both ways (wire → contract and contract → wire) and for
 * the same keys, so a renamed, added, dropped, narrowed or widened field fails
 * `npm run typecheck` (tests/remote/tsconfig.json). The runtime half sends real
 * adapter requests and parses their bodies with the contract's schemas.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  activePlanSchema,
  activityOpinionSchema,
  apiSchemas,
  availabilitySchema,
  availableSlotSchema,
  chatMessageSchema,
  chatResultSchema,
  completionInputSchema,
  completionSchema,
  errorCodeSchema,
  errorResponseSchema,
  feedbackSchema,
  generatePlanSchema,
  gymExerciseSchema,
  gymLogSchema,
  metaSchema,
  metricDefinitionSchema,
  metricValuesSchema,
  plannedActivitySchema,
  planSchema,
  planSnapshotSchema,
  planVersionSchema,
  preferencesSchema,
  profileSchema,
  putOpinionSchema,
  resetOpinionsResultSchema,
  resetOpinionsSchema,
  sendChatSchema,
  sportSchema,
  undoPlanSchema,
  updateFeedbackSchema,
  updateProfileSchema,
  type z,
} from '../../../../packages/contracts/src/product';
import { createRemoteRuntime } from '../../src/api/remote/client';
import type * as wire from '../../src/api/remote/wire';
import type { SaveFeedbackInput } from '../../src/api/types';
import { activity, completion, fakeDeps, PLAN_ID, type Reply, scriptedFetch, SPORTS, USER_ID, uuid, version } from './fakes';

/* ------------------------------------------------------- Type-level checks */

type Contract<S extends z.ZodType> = z.infer<S>;

/** True when A and B accept the same values and name the same keys. */
type Same<A, B> = [A] extends [B]
  ? [B] extends [A]
    ? [Exclude<keyof A, keyof B>, Exclude<keyof B, keyof A>] extends [never, never]
      ? true
      : false
    : false
  : false;

/**
 * Fails to compile unless every entry is `true`. On a failure, tsc names the
 * entry; the matching `toContract`/`toWire` line below shows the field.
 */
function expectSame<T extends Record<string, true>>(checks: T): T {
  return checks;
}

type Pairs = {
  // Profile and catalog
  PreferencesDto: [wire.PreferencesDto, Contract<typeof preferencesSchema>];
  WirePreferredWindow: [wire.WirePreferredWindow, NonNullable<Contract<typeof preferencesSchema>['preferred_window']>];
  ProfileEntity: [wire.ProfileEntity, Contract<typeof profileSchema>];
  UpdateProfileDto: [wire.UpdateProfileDto, Contract<typeof updateProfileSchema>];
  MetricDefinition: [wire.MetricDefinition, Contract<typeof metricDefinitionSchema>];
  SportEntity: [wire.SportEntity, Contract<typeof sportSchema>];
  // Plans
  AvailableSlot: [wire.AvailableSlot, Contract<typeof availableSlotSchema>];
  AvailabilityDto: [wire.AvailabilityDto, Contract<typeof availabilitySchema>];
  PlannedGymExercise: [wire.PlannedGymExercise, Contract<typeof gymExerciseSchema>];
  PlannedActivity: [wire.PlannedActivity, Contract<typeof plannedActivitySchema>];
  PlanSnapshot: [wire.PlanSnapshot, Contract<typeof planSnapshotSchema>];
  PlanEntity: [wire.PlanEntity, Contract<typeof planSchema>];
  PlanVersionOrigin: [wire.PlanVersionOrigin, Contract<typeof planVersionSchema>['origin']];
  PlanVersionEntity: [wire.PlanVersionEntity, Contract<typeof planVersionSchema>];
  ActivePlanDto: [wire.ActivePlanDto, Contract<typeof activePlanSchema>];
  GeneratePlanDto: [wire.GeneratePlanDto, Contract<typeof generatePlanSchema>];
  UndoPlanDto: [wire.UndoPlanDto, Contract<typeof undoPlanSchema>];
  // Chat
  ChatMessageEntity: [wire.ChatMessageEntity, Contract<typeof chatMessageSchema>];
  SendChatDto: [wire.SendChatDto, Contract<typeof sendChatSchema>];
  ChatResultDto: [wire.ChatResultDto, Contract<typeof chatResultSchema>];
  // Completions, feedback and opinions
  FeedbackDto: [wire.FeedbackDto, Contract<typeof feedbackSchema>];
  MetricValues: [wire.MetricValues, Contract<typeof metricValuesSchema>];
  GymLog: [wire.GymLogEntry[], Contract<typeof gymLogSchema>];
  CompleteActivityDto: [wire.CompleteActivityDto, Contract<typeof completionInputSchema>];
  ActivityCompletionEntity: [wire.ActivityCompletionEntity, Contract<typeof completionSchema>];
  UpdateFeedbackDto: [wire.UpdateFeedbackDto, Contract<typeof updateFeedbackSchema>];
  OpinionValue: [wire.OpinionValue, Contract<typeof activityOpinionSchema>['opinion']];
  ActivityOpinionEntity: [wire.ActivityOpinionEntity, Contract<typeof activityOpinionSchema>];
  PutOpinionDto: [wire.PutOpinionDto, Contract<typeof putOpinionSchema>];
  ResetOpinionsDto: [Record<string, never>, Contract<typeof resetOpinionsSchema>];
  ClearedDto: [wire.ClearedDto, Contract<typeof resetOpinionsResultSchema>];
  // Envelope
  WireErrorCode: [wire.WireErrorCode, Contract<typeof errorCodeSchema>];
  WireMeta: [wire.WireMeta, Contract<typeof metaSchema>];
  WireErrorEnvelope: [wire.WireErrorEnvelope, Contract<typeof errorResponseSchema>];
  ProfileResponse: [wire.WireEnvelope<wire.ProfileEntity>, Contract<typeof apiSchemas.ProfileResponse>];
  SportListResponse: [wire.WireEnvelope<wire.SportEntity[]>, Contract<typeof apiSchemas.SportListResponse>];
  CurrentPlanResponse: [wire.WireEnvelope<wire.ActivePlanDto | null>, Contract<typeof apiSchemas.CurrentPlanResponse>];
  GeneratePlanResponse: [wire.WireEnvelope<wire.ActivePlanDto>, Contract<typeof apiSchemas.GeneratePlanResponse>];
  PlanHistoryResponse: [wire.WireEnvelope<wire.PlanVersionEntity[]>, Contract<typeof apiSchemas.PlanHistoryResponse>];
  ChatMessagesResponse: [wire.WireEnvelope<wire.ChatMessageEntity[]>, Contract<typeof apiSchemas.ChatMessagesResponse>];
  ChatResponse: [wire.WireEnvelope<wire.ChatResultDto>, Contract<typeof apiSchemas.ChatResponse>];
  CompletionResponse: [wire.WireEnvelope<wire.ActivityCompletionEntity>, Contract<typeof apiSchemas.CompletionResponse>];
  CompletionListResponse: [wire.WireEnvelope<wire.ActivityCompletionEntity[]>, Contract<typeof apiSchemas.CompletionListResponse>];
  OpinionListResponse: [wire.WireEnvelope<wire.ActivityOpinionEntity[]>, Contract<typeof apiSchemas.OpinionListResponse>];
  OpinionResponse: [wire.WireEnvelope<wire.ActivityOpinionEntity | null>, Contract<typeof apiSchemas.OpinionResponse>];
  ResetOpinionsResponse: [wire.WireEnvelope<wire.ClearedDto>, Contract<typeof apiSchemas.ResetOpinionsResponse>];
  UndoPlanResponse: [wire.WireEnvelope<wire.ActivePlanDto>, Contract<typeof apiSchemas.UndoPlanResponse>];
};

export const wireMatchesContract = expectSame<{ [K in keyof Pairs]: Same<Pairs[K][0], Pairs[K][1]> }>({
  PreferencesDto: true,
  WirePreferredWindow: true,
  ProfileEntity: true,
  UpdateProfileDto: true,
  MetricDefinition: true,
  SportEntity: true,
  AvailableSlot: true,
  AvailabilityDto: true,
  PlannedGymExercise: true,
  PlannedActivity: true,
  PlanSnapshot: true,
  PlanEntity: true,
  PlanVersionOrigin: true,
  PlanVersionEntity: true,
  ActivePlanDto: true,
  GeneratePlanDto: true,
  UndoPlanDto: true,
  ChatMessageEntity: true,
  SendChatDto: true,
  ChatResultDto: true,
  FeedbackDto: true,
  MetricValues: true,
  GymLog: true,
  CompleteActivityDto: true,
  ActivityCompletionEntity: true,
  UpdateFeedbackDto: true,
  OpinionValue: true,
  ActivityOpinionEntity: true,
  PutOpinionDto: true,
  ResetOpinionsDto: true,
  ClearedDto: true,
  WireErrorCode: true,
  WireMeta: true,
  WireErrorEnvelope: true,
  ProfileResponse: true,
  SportListResponse: true,
  CurrentPlanResponse: true,
  GeneratePlanResponse: true,
  PlanHistoryResponse: true,
  ChatMessagesResponse: true,
  ChatResponse: true,
  CompletionResponse: true,
  CompletionListResponse: true,
  OpinionListResponse: true,
  OpinionResponse: true,
  ResetOpinionsResponse: true,
  UndoPlanResponse: true,
});

/** Readable diagnostics: a mismatch here names the field that differs. */
export const toContract = {
  profile: (v: wire.UpdateProfileDto): Contract<typeof updateProfileSchema> => v,
  generate: (v: wire.GeneratePlanDto): Contract<typeof generatePlanSchema> => v,
  chat: (v: wire.SendChatDto): Contract<typeof sendChatSchema> => v,
  undo: (v: wire.UndoPlanDto): Contract<typeof undoPlanSchema> => v,
  complete: (v: wire.CompleteActivityDto): Contract<typeof completionInputSchema> => v,
  feedback: (v: wire.UpdateFeedbackDto): Contract<typeof updateFeedbackSchema> => v,
  opinion: (v: wire.PutOpinionDto): Contract<typeof putOpinionSchema> => v,
};
export const toWire = {
  profile: (v: Contract<typeof profileSchema>): wire.ProfileEntity => v,
  sport: (v: Contract<typeof sportSchema>): wire.SportEntity => v,
  plan: (v: Contract<typeof activePlanSchema>): wire.ActivePlanDto => v,
  version: (v: Contract<typeof planVersionSchema>): wire.PlanVersionEntity => v,
  message: (v: Contract<typeof chatMessageSchema>): wire.ChatMessageEntity => v,
  chat: (v: Contract<typeof chatResultSchema>): wire.ChatResultDto => v,
  completion: (v: Contract<typeof completionSchema>): wire.ActivityCompletionEntity => v,
  opinion: (v: Contract<typeof activityOpinionSchema>): wire.ActivityOpinionEntity => v,
  cleared: (v: Contract<typeof resetOpinionsResultSchema>): wire.ClearedDto => v,
  error: (v: Contract<typeof errorResponseSchema>): wire.WireErrorEnvelope => v,
};

/* --------------------------------------------- Runtime: real request bodies */

type Schema = { safeParse(value: unknown): { success: boolean; error?: unknown } };

/** The contract schema for each write route the app calls. */
const REQUEST_SCHEMAS: Record<string, Schema> = {
  'PUT /profile': apiSchemas.UpdateProfileDto,
  'POST /plans/generate': apiSchemas.GeneratePlanDto,
  'POST /plans/undo': apiSchemas.UndoPlanDto,
  'POST /chat': apiSchemas.SendChatDto,
  'POST /completions': apiSchemas.CompleteActivityDto,
  'PUT /completions/feedback': apiSchemas.UpdateFeedbackDto,
  'PUT /opinions': apiSchemas.PutOpinionDto,
  'POST /opinions/reset': apiSchemas.ResetOpinionsDto,
};

const meta = { contract_version: '1' as const, request_id: null };
const envelope = (data: unknown): Reply => ({ status: 200, body: { data, meta } });

/**
 * A product API in memory that answers every route the adapter uses and keeps
 * each write body, so the test can parse what the adapter really sent.
 */
function contractServer() {
  const walk = activity(1);
  const v1 = version(1, '2026-10-05', [walk, activity(3, { start_at: '2026-10-09T08:00:00+02:00' })], 'generate');
  const v2 = version(2, '2026-10-05', [walk, activity(3, { start_at: '2026-10-10T08:00:00+02:00' })], 'revise');
  const versions: wire.PlanVersionEntity[] = [v1, v2];
  const completions: wire.ActivityCompletionEntity[] = [];
  const opinions: wire.ActivityOpinionEntity[] = [];
  const messages: wire.ChatMessageEntity[] = [
    {
      id: uuid(801),
      profile_id: USER_ID,
      plan_id: PLAN_ID,
      role: 'user',
      content: 'Move Thursday to Saturday.',
      outcome: null,
      plan_version_id: null,
      created_at: '2026-10-06T09:00:00Z',
      request_id: uuid(800),
    },
    {
      id: uuid(802),
      profile_id: USER_ID,
      plan_id: PLAN_ID,
      role: 'assistant',
      content: 'Moved it to Saturday.',
      outcome: 'plan_updated',
      plan_version_id: v2.id,
      created_at: '2026-10-06T09:00:05Z',
      request_id: uuid(800),
    },
  ];
  const profile: wire.ProfileEntity = {
    id: USER_ID,
    username: null,
    created_at: '2026-10-01T10:00:00Z',
    preferences: {
      starting_comfort: 'starting_out',
      sessions_per_week: 3,
      session_minutes: 20,
      preferred_window: { start_hour: 7, end_hour: 11 },
      activity_interests: ['1'],
      discovery_preference: 'occasional',
      available_locations: ['outdoors'],
      available_equipment: [],
      avoidances: [],
      starting_obstacles: [],
      excluded_activity_types: [],
      timezone: 'Europe/Warsaw',
    },
  };
  const writes: { route: string; body: unknown }[] = [];
  const active = () => [...versions].sort((a, b) => b.version - a.version)[0];
  const current = (): wire.ActivePlanDto => ({
    plan: { id: PLAN_ID, profile_id: USER_ID, active_version_id: active().id, created_at: '2026-10-01T10:00:00Z' },
    version: active(),
  });
  const page = <T>(rows: T[], url: URL) => envelope(Number(url.searchParams.get('offset') ?? 0) === 0 ? rows : []);

  const { fetch } = scriptedFetch((call) => {
    const url = new URL(call.url);
    const route = `${call.init.method} ${url.pathname.replace(/^.*\/product-api/, '')}`;
    const body: unknown = call.init.body === undefined ? undefined : JSON.parse(call.init.body);
    if (call.init.method !== 'GET') writes.push({ route, body });
    switch (route) {
      case 'GET /profile':
        return envelope(profile);
      case 'PUT /profile':
        Object.assign(profile, body);
        return envelope(profile);
      case 'GET /sports':
        return envelope(SPORTS);
      case 'GET /plans/current':
        return envelope(current());
      case 'GET /plans/history':
        return page([...versions].sort((a, b) => b.version - a.version), url);
      case 'GET /chat/messages':
        return page(messages, url);
      case 'GET /completions':
        return page(completions, url);
      case 'GET /opinions':
        return envelope(opinions);
      case 'POST /plans/generate':
      case 'POST /chat':
        return { status: 501, body: { error: { code: 'AI_NOT_CONFIGURED', message: 'No AI.', retryable: false }, meta } };
      case 'POST /plans/undo': {
        const undo = version(active().version + 1, '2026-10-05', v1.plan.activities, 'undo');
        versions.push(undo);
        return envelope(current());
      }
      case 'POST /completions': {
        const dto = body as wire.CompleteActivityDto;
        const saved = { ...completion(completions.length + 1, walk, v2), ...dto };
        completions.unshift(saved);
        return envelope(saved);
      }
      case 'PUT /completions/feedback': {
        const dto = body as wire.UpdateFeedbackDto;
        const saved = completions.find((c) => c.id === dto.completion_id)!;
        saved.feedback = dto.feedback;
        return envelope(saved);
      }
      case 'PUT /opinions': {
        const dto = body as wire.PutOpinionDto;
        const rest = opinions.filter((o) => o.activity_key !== dto.activity_key);
        opinions.splice(0, opinions.length, ...rest);
        if (!dto.opinion) return envelope(null);
        const saved = { ...dto, opinion: dto.opinion, updated_at: '2026-10-07T12:00:00Z' };
        opinions.unshift(saved);
        return envelope(saved);
      }
      case 'POST /opinions/reset': {
        const cleared = opinions.length;
        opinions.splice(0);
        return envelope({ cleared });
      }
      default:
        return { status: 404, body: { error: { code: 'NOT_FOUND', message: 'Endpoint not found.', retryable: false }, meta } };
    }
  });
  return { fetch, writes, walk };
}

test('the adapter sends request bodies the contract accepts on every write route', async () => {
  const server = contractServer();
  const { client } = createRemoteRuntime(fakeDeps({ fetch: server.fetch }));

  // Answers: PUT /profile (no planning field changes, so no background re-plan).
  const answers = await client.preferences.get();
  assert.ok(answers);
  await client.preferences.save({ ...answers, starting_obstacles: ['time'] });

  // Generate and chat: the bodies are sent even though the AI answers 501.
  await assert.rejects(client.plan.build({ week_start: '2026-10-12' }));
  await assert.rejects(client.chat.send({ text: 'Make Saturday shorter.', about_session_id: null, base_version: null }));

  // Log, save without feedback, then give feedback with an opinion.
  const draft = await client.logs.create({
    session_id: server.walk.id,
    sport_id: 'walking',
    started_at: '2026-10-05T07:00:00+02:00',
    duration_seconds: 1200,
    source: 'typed',
    metrics: {},
  });
  const saved = await client.logs.commit(draft.id);
  const feedback: SaveFeedbackInput = { felt: 'just_right', note: 'Nice and easy.', choose_again: 'yes' };
  await client.logs.saveFeedback(saved.id, feedback);

  // Opinions from Profile, then a reset.
  const overview = await client.profile.getFeedback();
  const key = overview.opinions[0]?.activity_key;
  assert.ok(key, 'saving feedback with choose_again stored an opinion');
  await client.profile.setOpinion(key, 'maybe');
  await client.profile.setOpinion(key, null);
  await client.profile.resetFeedback();

  // Undo of the newest chat change.
  const thread = await client.chat.listMessages();
  const change = thread.find((m) => m.kind === 'change');
  assert.ok(change, 'the thread has a change card');
  await client.chat.undo(change.id);

  const routes = new Set(server.writes.map((w) => w.route));
  for (const route of Object.keys(REQUEST_SCHEMAS)) assert.ok(routes.has(route), `the adapter called ${route}`);
  for (const { route, body } of server.writes) {
    const schema = REQUEST_SCHEMAS[route];
    assert.ok(schema, `no contract schema for ${route}`);
    const result = schema.safeParse(body);
    assert.ok(result.success, `${route} ${JSON.stringify(body)}\n${JSON.stringify(result.error, null, 1)}`);
  }
});
