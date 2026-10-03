import {
  z,
  activePlanSchema,
  chatMessageSchema,
  completionSchema,
  profileSchema,
  sportSchema,
  planVersionSchema,
  uuidSchema,
} from '../../../packages/contracts/src/product.ts';
import type { ApiErrorCode } from '../../../packages/contracts/src/product.ts';
import type { ApiDependencies, Page, PlanGenerator, ProductStore } from './ports.ts';
import { ApiError } from './errors.ts';

interface Configuration {
  url: string;
  publishableKey: string;
  serverKey?: string;
}
const sqlErrors: Record<string, { status: number; code: ApiErrorCode; message: string }> = {
  INVALID_REQUEST: {
    status: 400,
    code: 'INVALID_REQUEST',
    message: 'Check the request fields.',
  },
  NOT_FOUND: { status: 404, code: 'NOT_FOUND', message: 'Record not found.' },
  REQUEST_CONFLICT: {
    status: 409,
    code: 'REQUEST_CONFLICT',
    message: 'This request ID was already used with different data.',
  },
  VERSION_CONFLICT: {
    status: 409,
    code: 'VERSION_CONFLICT',
    message: 'The plan changed elsewhere. Reload it before retrying.',
  },
  ALREADY_COMPLETED: {
    status: 409,
    code: 'ALREADY_COMPLETED',
    message: 'This activity has already been completed.',
  },
  COMPLETED_ACTIVITY_LOCKED: {
    status: 409,
    code: 'VERSION_CONFLICT',
    message: 'Completed activities cannot be changed.',
  },
};
function stored<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success)
    throw new ApiError(
      'DATA_UNAVAILABLE',
      502,
      'Stored data does not match the API contract.',
      true,
    );
  return parsed.data;
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object')
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(',')}}`;
  return JSON.stringify(value);
}
export function createSupabaseDependencies(
  config: Configuration,
  generator: PlanGenerator,
  fetcher: typeof fetch = fetch,
): ApiDependencies {
  async function call(
    path: string,
    token: string,
    key: string,
    method = 'GET',
    body?: unknown,
  ): Promise<unknown> {
    let response: Response;
    try {
      response = await fetcher(`${config.url}${path}`, {
        method,
        headers: {
          apikey: key,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      });
    } catch {
      throw new ApiError('DATA_UNAVAILABLE', 503, 'Supabase is unavailable. Try again.', true);
    }
    const data: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 401)
        throw new ApiError('UNAUTHENTICATED', 401, 'Sign in again to continue.');
      const error = z.object({ message: z.string() }).safeParse(data);
      const mapped = error.success ? sqlErrors[error.data.message] : undefined;
      if (mapped) throw new ApiError(mapped.code, mapped.status, mapped.message);
      throw new ApiError(
        'DATA_UNAVAILABLE',
        502,
        'The data operation could not be completed.',
        true,
      );
    }
    return data;
  }
  return {
    async authenticate(token) {
      return stored(
        z.object({ id: uuidSchema }),
        await call('/auth/v1/user', token, config.publishableKey),
      );
    },
    generator,
    store(owner, token): ProductStore {
      const read = (table: string, query: Record<string, string>) =>
        call(`/rest/v1/${table}?${new URLSearchParams(query)}`, token, config.publishableKey);
      const rpc = (name: string, body: unknown, server = false) => {
        if (server && !config.serverKey)
          throw new ApiError('AI_NOT_CONFIGURED', 501, 'The AI provider is not connected yet.');
        const key = server ? config.serverKey! : config.publishableKey;
        return call(`/rest/v1/rpc/${name}`, server ? key : token, key, 'POST', body);
      };
      const ownerFilter = { profile_id: `eq.${owner}` };
      const pagination = (page: Page) => ({
        limit: String(page.limit),
        offset: String(page.offset),
      });
      const profileQuery = {
        id: `eq.${owner}`,
        select: 'id,username,created_at,preferences',
      };
      const listMessages = async (planId: string, query: Record<string, string>) =>
        stored(
          z.array(chatMessageSchema),
          await read('chat_message', {
            ...ownerFilter,
            plan_id: `eq.${planId}`,
            order: 'created_at.asc,role.desc,id.asc',
            ...query,
          }),
        );
      const result: ProductStore = {
        async getProfile() {
          const rows = stored(z.array(profileSchema), await read('profile', profileQuery));
          if (!rows[0]) throw new ApiError('NOT_FOUND', 404, 'Your profile is unavailable.');
          return rows[0];
        },
        async updateProfile(input) {
          const rows = stored(
            z.array(profileSchema),
            await call(
              `/rest/v1/profile?${new URLSearchParams(profileQuery)}`,
              token,
              config.publishableKey,
              'PATCH',
              input,
            ),
          );
          if (!rows[0]) throw new ApiError('NOT_FOUND', 404, 'Your profile is unavailable.');
          return rows[0];
        },
        async listSports() {
          const raw = stored(
            z.array(
              z.object({
                id: z.string(),
                name: z.string(),
                is_gym: z.boolean(),
                generation_enabled: z.boolean(),
                metrics: z.unknown(),
              }),
            ),
            await read('sport', {
              select: 'id::text,name,is_gym,generation_enabled,metrics',
              order: 'id.asc',
              limit: '100',
            }),
          );
          return stored(
            z.array(sportSchema),
            raw.map((sport) => ({ ...sport, metrics: sport.metrics ?? [] })),
          );
        },
        async getCurrentPlan() {
          const rows = stored(
            z.array(activePlanSchema.shape.plan),
            await read('plan', { ...ownerFilter, limit: '1' }),
          );
          const plan = rows[0];
          if (!plan?.active_version_id) return null;
          const versions = stored(
            z.array(planVersionSchema),
            await read('plan_version', {
              ...ownerFilter,
              id: `eq.${plan.active_version_id}`,
              plan_id: `eq.${plan.id}`,
            }),
          );
          if (!versions[0])
            throw new ApiError('DATA_UNAVAILABLE', 502, 'The active plan is unavailable.', true);
          return { plan, version: versions[0] };
        },
        async listVersions(page) {
          return stored(
            z.array(planVersionSchema),
            await read('plan_version', {
              ...ownerFilter,
              order: 'version.desc',
              ...pagination(page),
            }),
          );
        },
        listMessages: (planId, page) => listMessages(planId, pagination(page)),
        requestMessages: (planId, requestId) =>
          listMessages(planId, { request_id: `eq.${requestId}`, limit: '2' }),
        async recentMessages(planId) {
          return (
            await listMessages(planId, {
              order: 'created_at.desc,role.asc,id.desc',
              limit: '20',
            })
          ).reverse();
        },
        async contextCompletions(ids) {
          if (!ids.length) return [];
          return stored(
            z.array(completionSchema),
            await read('activity_completion', {
              ...ownerFilter,
              activity_id: `in.(${ids.join(',')})`,
              limit: '7',
            }),
          );
        },
        async listCompletions(page) {
          return stored(
            z.array(completionSchema),
            await read('activity_completion', {
              ...ownerFilter,
              order: 'completed_at.desc,id.desc',
              ...pagination(page),
            }),
          );
        },
        async savedRequest(requestId, input) {
          if (!config.serverKey) return null;
          const query = new URLSearchParams({
            ...ownerFilter,
            request_id: `eq.${requestId}`,
            select: 'action,payload,result',
            limit: '1',
          });
          const rows = stored(
            z.array(
              z.object({
                action: z.string(),
                payload: z.record(z.string(), z.unknown()),
                result: z.unknown(),
              }),
            ),
            await call(
              `/rest/v1/product_request_receipt?${query}`,
              config.serverKey,
              config.serverKey,
            ),
          );
          if (!rows[0]) return null;
          if (rows[0].action === 'complete_activity')
            throw new ApiError(
              'REQUEST_CONFLICT',
              409,
              'This request ID was already used with different data.',
            );
          if (canonical(rows[0].payload.client_input) !== canonical(input))
            throw new ApiError(
              'REQUEST_CONFLICT',
              409,
              'This request ID was already used with different data.',
            );
          if ('sport_id' in input) return stored(activePlanSchema, rows[0].result);
          if (rows[0].action === 'save_plan_version')
            return {
              outcome: 'plan_updated',
              active_plan: stored(activePlanSchema, rows[0].result),
              messages: await result.requestMessages(input.plan_id, requestId),
            };
          const saved = stored(
            z.object({ messages: z.array(chatMessageSchema).length(2) }),
            rows[0].result,
          );
          return {
            outcome: saved.messages[1]!.outcome,
            active_plan: null,
            messages: saved.messages,
          };
        },
        async savePlan(input) {
          const current = await result.getCurrentPlan();
          return stored(
            activePlanSchema,
            await rpc(
              'save_plan_version',
              {
                p_owner: owner,
                p_plan_id:
                  'plan_id' in input.request ? input.request.plan_id : (current?.plan.id ?? null),
                p_expected_version: input.request.expected_version,
                p_request_id: input.request.request_id,
                p_origin: input.origin,
                p_plan: input.plan,
                p_summary: input.summary,
                p_message: 'message' in input.request ? input.request.message : null,
                p_input: input.request,
              },
              true,
            ),
          );
        },
        async saveReply(input, reply, outcome) {
          const saved = stored(
            z.object({ messages: z.array(chatMessageSchema).length(2) }),
            await rpc(
              'save_chat_reply',
              {
                p_owner: owner,
                p_plan_id: input.plan_id,
                p_expected_version: input.expected_version,
                p_request_id: input.request_id,
                p_message: input.message,
                p_reply: reply,
                p_outcome: outcome,
                p_input: input,
              },
              true,
            ),
          );
          return saved.messages;
        },
        async complete(input) {
          return stored(
            completionSchema,
            await rpc('complete_activity', {
              p_plan_version_id: input.plan_version_id,
              p_activity_id: input.activity_id,
              p_request_id: input.request_id,
              p_metrics: input.metrics,
              p_gym_log: input.gym_log,
              p_feedback: input.feedback,
              p_completed_at: input.completed_at,
            }),
          );
        },
      };
      return result;
    },
  };
}
