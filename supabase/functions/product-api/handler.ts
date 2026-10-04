import {
  z,
  apiSchemas,
  completionInputSchema,
  generatePlanSchema,
  getProductJsonSchemas,
  putOpinionSchema,
  resetOpinionsSchema,
  sendChatSchema,
  undoPlanSchema,
  updateFeedbackSchema,
  updateProfileSchema,
  uuidSchema,
} from '../../../packages/contracts/src/product.ts';
import type { PlanSnapshotDto, UndoPlanDto } from '../../../packages/contracts/src/product.ts';
import type { ApiDependencies, GeneratorContext, Page, ProductStore } from './ports.ts';
import { ApiError } from './errors.ts';
import { parseInput, validateGeneratedPlan } from './validation.ts';

export const routes = [
  { method: 'GET', path: '/schema', response: 'SchemaResponse' },
  { method: 'GET', path: '/profile', response: 'ProfileResponse' },
  {
    method: 'PUT',
    path: '/profile',
    request: 'UpdateProfileDto',
    response: 'ProfileResponse',
  },
  { method: 'GET', path: '/sports', response: 'SportListResponse' },
  { method: 'GET', path: '/plans/current', response: 'CurrentPlanResponse' },
  { method: 'GET', path: '/plans/history', response: 'PlanHistoryResponse' },
  {
    method: 'POST',
    path: '/plans/generate',
    request: 'GeneratePlanDto',
    response: 'GeneratePlanResponse',
  },
  {
    method: 'POST',
    path: '/plans/undo',
    request: 'UndoPlanDto',
    response: 'UndoPlanResponse',
  },
  { method: 'GET', path: '/chat/messages', response: 'ChatMessagesResponse' },
  {
    method: 'POST',
    path: '/chat',
    request: 'SendChatDto',
    response: 'ChatResponse',
  },
  { method: 'GET', path: '/completions', response: 'CompletionListResponse' },
  {
    method: 'POST',
    path: '/completions',
    request: 'CompleteActivityDto',
    response: 'CompletionResponse',
  },
  {
    method: 'PUT',
    path: '/completions/feedback',
    request: 'UpdateFeedbackDto',
    response: 'CompletionResponse',
  },
  { method: 'GET', path: '/opinions', response: 'OpinionListResponse' },
  {
    method: 'PUT',
    path: '/opinions',
    request: 'PutOpinionDto',
    response: 'OpinionResponse',
  },
  {
    method: 'POST',
    path: '/opinions/reset',
    request: 'ResetOpinionsDto',
    response: 'ResetOpinionsResponse',
  },
] as const;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, apikey, content-type, x-client-info, x-retry-count, traceparent, tracestate, baggage',
  'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};
const pageSchema = z.strictObject({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(10000).default(0),
});
async function providerResult<T>(schema: z.ZodType<T>, run: () => Promise<unknown>): Promise<T> {
  let value: unknown;
  try {
    value = await run();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError('PROVIDER_UNAVAILABLE', 502, 'Plan generation failed. Try again.', true);
  }
  const result = schema.safeParse(value);
  if (!result.success)
    throw new ApiError(
      'INVALID_AI_OUTPUT',
      502,
      'The generated result was invalid. Try again.',
      true,
    );
  return result.data;
}
function page(url: URL): Page {
  return parseInput(pageSchema, {
    limit: url.searchParams.get('limit') ?? undefined,
    offset: url.searchParams.get('offset') ?? undefined,
  });
}
async function readBody(request: Request): Promise<unknown> {
  if (!request.headers.get('content-type')?.startsWith('application/json')) {
    throw new ApiError('INVALID_REQUEST', 400, 'Send JSON with Content-Type application/json.');
  }
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError('INVALID_REQUEST', 400, 'A JSON body is required.');
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 32768) {
      await reader.cancel();
      throw new ApiError('PAYLOAD_TOO_LARGE', 413, 'Request bodies are limited to 32 KiB.');
    }
    chunks.push(value);
  }
  const body = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(body));
  } catch {
    throw new ApiError('INVALID_REQUEST', 400, 'Send valid JSON.');
  }
}
async function context(store: ProductStore, planId?: string): Promise<GeneratorContext> {
  const [profile, sports, activePlan] = await Promise.all([
    store.getProfile(),
    store.listSports(),
    store.getCurrentPlan(),
  ]);
  if (!profile.preferences)
    throw new ApiError('INVALID_REQUEST', 400, 'Save your preferences first.');
  if (planId && activePlan?.plan.id !== planId)
    throw new ApiError('NOT_FOUND', 404, 'Plan not found.');
  return {
    preferences: profile.preferences,
    sports,
    activePlan,
    completions: activePlan
      ? await store.contextCompletions(activePlan.version.plan.activities.map((item) => item.id))
      : [],
    messages: activePlan ? await store.recentMessages(activePlan.plan.id) : [],
  };
}
// Restores the version before the newest chat change, without an AI call.
async function undo(store: ProductStore, input: UndoPlanDto) {
  const active = await store.getCurrentPlan();
  if (active?.plan.id !== input.plan_id) throw new ApiError('NOT_FOUND', 404, 'Plan not found.');
  if (active.version.version !== input.expected_version)
    throw new ApiError(
      'VERSION_CONFLICT',
      409,
      'The plan changed elsewhere. Reload it before retrying.',
    );
  const nothingToUndo = () =>
    new ApiError('NOTHING_TO_UNDO', 409, 'There is no recent change to undo.');
  if (active.version.origin !== 'revise') throw nothingToUndo();
  const restored = await store.getVersion(active.plan.id, active.version.version - 1);
  if (!restored || restored.plan.week_start !== active.version.plan.week_start)
    throw nothingToUndo();
  // A logged session must stay exactly as it was completed.
  const shape = (activities: PlanSnapshotDto['activities']) =>
    new Map(activities.map((activity) => [activity.id, JSON.stringify(activity)]));
  const before = shape(restored.plan.activities);
  const after = shape(active.version.plan.activities);
  const completions = await store.contextCompletions([
    ...new Set([...before.keys(), ...after.keys()]),
  ]);
  if (completions.some((item) => before.get(item.activity_id) !== after.get(item.activity_id)))
    throw new ApiError(
      'UNDO_LOCKED',
      409,
      'A session in this change is already logged, so it cannot be undone.',
    );
  return store.savePlan({
    request: input,
    origin: 'undo',
    plan: restored.plan,
    summary: 'The last change was undone.',
  });
}
export function createProductApi(dependencies: ApiDependencies) {
  return async (request: Request): Promise<Response> => {
    let requestId: string | null = null;
    const meta = () => ({
      contract_version: '1' as const,
      request_id: requestId,
    });
    const json = (value: unknown, status = 200) =>
      new Response(JSON.stringify(value), { status, headers: cors });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    try {
      const url = new URL(request.url);
      const prefix = '/product-api';
      const position = url.pathname.indexOf(prefix);
      const path =
        position < 0 ? url.pathname : url.pathname.slice(position + prefix.length) || '/';
      const route = routes.find((item) => item.path === path && item.method === request.method);
      if (!route) {
        if (routes.some((item) => item.path === path))
          throw new ApiError('METHOD_NOT_ALLOWED', 405, 'This method is not supported.');
        throw new ApiError('NOT_FOUND', 404, 'Endpoint not found.');
      }
      const token = request.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
      if (!token) throw new ApiError('UNAUTHENTICATED', 401, 'Sign in to continue.');
      const user = await dependencies.authenticate(token);
      const store = dependencies.store(parseInput(uuidSchema, user.id), token);
      let data: unknown;
      if (route.method === 'GET') {
        switch (path) {
          case '/schema':
            data = getProductJsonSchemas();
            break;
          case '/profile':
            data = await store.getProfile();
            break;
          case '/sports':
            data = await store.listSports();
            break;
          case '/plans/current':
            data = await store.getCurrentPlan();
            break;
          case '/plans/history':
            data = await store.listVersions(page(url));
            break;
          case '/chat/messages':
            data = await store.listMessages(
              parseInput(uuidSchema, url.searchParams.get('plan_id')),
              page(url),
            );
            break;
          case '/completions':
            data = await store.listCompletions(page(url));
            break;
          case '/opinions':
            data = await store.listOpinions();
            break;
        }
      } else {
        const body = await readBody(request);
        switch (path) {
          case '/profile':
            data = await store.updateProfile(parseInput(updateProfileSchema, body));
            break;
          case '/completions': {
            const input = parseInput(completionInputSchema, body);
            requestId = input.request_id;
            data = await store.complete(input);
            break;
          }
          case '/completions/feedback':
            data = await store.updateFeedback(parseInput(updateFeedbackSchema, body));
            break;
          case '/opinions':
            data = await store.putOpinion(parseInput(putOpinionSchema, body));
            break;
          case '/opinions/reset':
            parseInput(resetOpinionsSchema, body);
            data = { cleared: await store.resetOpinions() };
            break;
          case '/plans/undo': {
            const input = parseInput(undoPlanSchema, body);
            requestId = input.request_id;
            const previous = await store.savedRequest(input.request_id, input);
            if (previous) {
              data = previous;
              break;
            }
            data = await undo(store, input);
            break;
          }
          case '/plans/generate': {
            const input = parseInput(generatePlanSchema, body);
            requestId = input.request_id;
            const previous = await store.savedRequest(input.request_id, input);
            if (previous) {
              data = previous;
              break;
            }
            const ctx = await context(store);
            if ((ctx.activePlan?.version.version ?? 0) !== input.expected_version)
              throw new ApiError(
                'VERSION_CONFLICT',
                409,
                'The plan changed elsewhere. Reload it before retrying.',
              );
            const eligibleSports = ctx.sports.filter(
              (sport) =>
                sport.generation_enabled &&
                !ctx.preferences.excluded_activity_types.includes(sport.id) &&
                (input.sport_id !== null
                  ? sport.id === input.sport_id
                  : ctx.preferences.discovery_preference !== 'selected_only' ||
                    ctx.preferences.activity_interests.includes(sport.id)),
            );
            if (eligibleSports.length === 0) {
              throw new ApiError('INVALID_REQUEST', 400, 'Choose an available sport.');
            }
            const result = await providerResult(
              z.strictObject({
                plan: z.unknown(),
                summary: z.string().min(1).max(1000),
              }),
              () =>
                dependencies.generator.generate(input, {
                  ...ctx,
                  sports: eligibleSports,
                }),
            );
            const snapshot = validateGeneratedPlan(result.plan, input, ctx);
            data = await store.savePlan({
              request: input,
              origin: 'generate',
              plan: snapshot,
              summary: result.summary,
            });
            break;
          }
          case '/chat': {
            const input = parseInput(sendChatSchema, body);
            requestId = input.request_id;
            const previous = await store.savedRequest(input.request_id, input);
            if (previous) {
              data = previous;
              break;
            }
            const ctx = await context(store, input.plan_id);
            if (ctx.activePlan?.version.version !== input.expected_version)
              throw new ApiError(
                'VERSION_CONFLICT',
                409,
                'The plan changed elsewhere. Reload it before retrying.',
              );
            if (
              input.activity_id &&
              !ctx.activePlan?.version.plan.activities.some((item) => item.id === input.activity_id)
            ) {
              throw new ApiError('NOT_FOUND', 404, 'Activity not found.');
            }
            const result = await providerResult(
              z.discriminatedUnion('outcome', [
                z.strictObject({
                  outcome: z.literal('plan_updated'),
                  plan: z.unknown(),
                  summary: z.string().min(1).max(1000),
                }),
                z.strictObject({
                  outcome: z.enum(['reply', 'clarification']),
                  reply: z.string().min(1).max(2000),
                }),
              ]),
              () => dependencies.generator.chat(input, ctx),
            );
            if (result.outcome === 'plan_updated') {
              const snapshot = validateGeneratedPlan(result.plan, input, ctx);
              const active_plan = await store.savePlan({
                request: input,
                origin: 'revise',
                plan: snapshot,
                summary: result.summary,
              });
              data = {
                outcome: result.outcome,
                active_plan,
                messages: await store.requestMessages(input.plan_id, input.request_id),
              };
            } else {
              data = {
                outcome: result.outcome,
                active_plan: null,
                messages: await store.saveReply(input, result.reply, result.outcome),
              };
            }
            break;
          }
        }
      }
      const responseSchema = apiSchemas[route.response as keyof typeof apiSchemas];
      const parsed = responseSchema.safeParse({ data, meta: meta() });
      if (!parsed.success)
        throw new ApiError(
          'DATA_UNAVAILABLE',
          502,
          'Stored data does not match the API contract.',
          true,
        );
      return json(parsed.data);
    } catch (error) {
      const failure =
        error instanceof ApiError
          ? error
          : new ApiError('INTERNAL_ERROR', 500, 'The request could not be completed.', true);
      return json(
        {
          error: {
            code: failure.code,
            message: failure.message,
            retryable: failure.retryable,
          },
          meta: meta(),
        },
        failure.status,
      );
    }
  };
}
