import { z } from '../../../packages/contracts/src/product.ts';
import type {
  GeneratePlanDto,
  PlanSnapshotDto,
  SendChatDto,
  SportEntity,
} from '../../../packages/contracts/src/product.ts';
import { ApiError } from './errors.ts';
import { PLANNABLE_EXERCISES } from './exercises.ts';
import type { GeneratedChat, GeneratorContext, PlanGenerator } from './ports.ts';
import { CHAT_PROMPT, GENERATE_PROMPT } from './prompt.ts';
import { addDays, allowedSlots, localIso, weekdayOf } from './schedule.ts';
import { checkGeneratedPlan } from './validation.ts';

// Runtime-agnostic on purpose: no Deno globals or node: imports, so the Supabase typecheck
// and the Node tests compile this file. Transport and retries follow
// apps/backend/src/ai/create-plan.ts (origin/codex/gemini-retries).
export interface GeminiConfig {
  apiKey?: string;
  model?: string;
  now?: () => number;
  /** Whole-call budget, re-ask included. Capped at 90 s to stay under the edge limit. */
  deadlineMs?: number;
  retryBaseDelayMs?: number;
  maxRetries?: number;
  random?: () => number;
  /** Receives status lines only, never prompts or answers. */
  log?: (message: string) => void;
}

type Activity = PlanSnapshotDto['activities'][number];

const maxDeadlineMs = 90_000;
const retryableStatuses = new Set([408, 429, 500, 502, 503, 504]);
const exerciseNames = new Map(PLANNABLE_EXERCISES.map((item) => [item.id, item.name]));

const notConfigured = () =>
  new ApiError('AI_NOT_CONFIGURED', 501, 'The AI provider is not connected yet.');
const invalidOutput = () =>
  new ApiError('INVALID_AI_OUTPUT', 502, 'The AI answer was incomplete. Try again.', true);

const rawActivitySchema = z.object({
  id: z.string().nullish(),
  sport_id: z.string(),
  title: z.string(),
  description: z.string(),
  start_at: z.string(),
  duration_minutes: z.number(),
  gym_exercises: z
    .array(
      z.object({
        id: z.string(),
        sets: z.array(z.object({ repetitions: z.number() })),
      }),
    )
    .nullish(),
});
type RawActivity = z.infer<typeof rawActivitySchema>;
const rawGenerateSchema = z.object({
  summary: z.string(),
  activities: z.array(rawActivitySchema),
});
const rawChatSchema = z.object({
  outcome: z.enum(['plan_updated', 'reply', 'clarification']),
  message: z.string(),
  activities: z.array(rawActivitySchema).nullish(),
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

/** Sports a chat change may use; generate already receives the handler's eligible list. */
function chatSports(context: GeneratorContext): SportEntity[] {
  return context.sports.filter(
    (sport) =>
      sport.generation_enabled && !context.preferences.excluded_activity_types.includes(sport.id),
  );
}

function responseSchema(
  chat: boolean,
  sports: SportEntity[],
  maxSessions: number,
  maxMinutes: number,
) {
  const exercise = {
    type: 'object',
    properties: {
      id: { type: 'string', enum: PLANNABLE_EXERCISES.map((item) => item.id) },
      sets: {
        type: 'array',
        description: '1 to 5 sets.',
        items: {
          type: 'object',
          properties: { repetitions: { type: 'integer', minimum: 1, maximum: 30 } },
          required: ['repetitions'],
        },
      },
    },
    required: ['id', 'sets'],
  };
  const activity = {
    type: 'object',
    properties: {
      id: {
        anyOf: [{ type: 'string' }, { type: 'null' }],
        description: 'The id of a planned_sessions entry to keep or change; null for a new one.',
      },
      sport_id: sports.length
        ? { type: 'string', enum: sports.map((sport) => sport.id) }
        : { type: 'string' },
      title: { type: 'string' },
      description: { type: 'string' },
      start_at: {
        type: 'string',
        format: 'date-time',
        description: 'Local time with its UTC offset, inside one allowed_slots entry.',
      },
      duration_minutes: {
        type: 'integer',
        minimum: 5,
        maximum: maxMinutes,
        description: 'A multiple of 5.',
      },
      gym_exercises: {
        type: 'array',
        description: 'At most 6 exercises for a gym sport; empty for any other sport.',
        items: exercise,
      },
    },
    required: [
      'id',
      'sport_id',
      'title',
      'description',
      'start_at',
      'duration_minutes',
      'gym_exercises',
    ],
  };
  // Gemini rejects array length keywords (minItems/maxItems) with a bare 400 INVALID_ARGUMENT,
  // so counts are described here and enforced by the prompt and local validation.
  const list = {
    type: 'array',
    description: sports.length ? `At most ${maxSessions} sessions.` : 'Always empty.',
    items: activity,
  };
  return chat
    ? {
        type: 'object',
        properties: {
          outcome: { type: 'string', enum: ['plan_updated', 'reply', 'clarification'] },
          activities: { anyOf: [list, { type: 'null' }] },
          message: { type: 'string' },
        },
        required: ['outcome', 'activities', 'message'],
      }
    : {
        type: 'object',
        properties: { activities: list, summary: { type: 'string' } },
        required: ['activities', 'summary'],
      };
}

export function createGeminiGenerator(
  config: GeminiConfig,
  fetcher: typeof fetch = fetch,
): PlanGenerator {
  const now = config.now ?? Date.now;
  const random = config.random ?? Math.random;
  const log = config.log ?? ((message: string) => console.warn(message));
  const deadlineMs = Math.min(config.deadlineMs ?? maxDeadlineMs, maxDeadlineMs);
  const maxRetries = config.maxRetries ?? 3;
  const retryBaseDelayMs = config.retryBaseDelayMs ?? 1000;

  function credentials() {
    const apiKey = config.apiKey?.trim();
    const model = config.model?.trim().replace(/^models\//, '');
    if (!apiKey || !model || !/^[a-zA-Z0-9._-]+$/.test(model)) throw notConfigured();
    return { apiKey, model };
  }

  /** One generateContent call with transient-failure retries; returns the answer text. */
  async function request(body: unknown, deadline: number): Promise<string> {
    const { apiKey, model } = credentials();
    const remaining = () => deadline - performance.now();
    if (remaining() <= 0) throw new Error('Gemini deadline passed before the request.');
    const signal = AbortSignal.timeout(Math.ceil(remaining()));
    let response!: Response;
    try {
      for (let attempt = 0; ; attempt++) {
        response = await fetcher(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
            body: JSON.stringify(body),
            signal,
          },
        );
        if (!retryableStatuses.has(response.status) || attempt >= maxRetries) break;
        // Release the failed response without reading content that may echo the request.
        await response.body?.cancel();
        const retryAfter = response.headers.get('retry-after');
        const seconds = retryAfter === null ? NaN : Number(retryAfter);
        const requested = Number.isFinite(seconds)
          ? Math.max(0, seconds * 1000)
          : Math.max(0, Date.parse(retryAfter ?? '') - Date.now()) || 0;
        // Jitter spreads concurrent retries after a shared provider failure.
        const backoff = retryBaseDelayMs * 2 ** attempt * (0.5 + random() * 0.5);
        const wait = Math.max(backoff, requested);
        if (wait >= remaining())
          throw new Error(`Gemini HTTP ${response.status}; a retry would pass the deadline.`);
        log(`[gemini] HTTP ${response.status}; retrying in ${Math.round(wait)} ms`);
        await sleep(wait, signal);
      }
    } catch (error) {
      if (signal.aborted) throw new Error('Gemini request timed out.');
      throw error;
    }
    if (!response.ok) {
      let detail = '';
      try {
        const payload: unknown = await response.json();
        const error = isRecord(payload) && isRecord(payload.error) ? payload.error : {};
        detail = `${String(error.status ?? '')} ${String(error.message ?? '')}`.slice(0, 300);
      } catch {
        // The status alone is enough to diagnose most failures.
      }
      log(`[gemini] HTTP ${response.status} ${detail}`.trim());
      throw new Error(`Gemini request failed with HTTP ${response.status}.`);
    }
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      if (signal.aborted) throw new Error('Gemini request timed out.');
      throw invalidOutput();
    }
    const envelope = isRecord(payload) ? payload : {};
    if (isRecord(envelope.promptFeedback) && envelope.promptFeedback.blockReason) {
      log(`[gemini] blocked: ${String(envelope.promptFeedback.blockReason)}`);
      throw invalidOutput();
    }
    const candidate = Array.isArray(envelope.candidates) ? envelope.candidates[0] : undefined;
    if (!isRecord(candidate)) throw invalidOutput();
    if (candidate.finishReason !== 'STOP') {
      log(`[gemini] finish reason ${String(candidate.finishReason)}`);
      throw invalidOutput();
    }
    const parts = isRecord(candidate.content) ? candidate.content.parts : undefined;
    if (!Array.isArray(parts)) throw invalidOutput();
    return parts
      .filter(
        (part): part is { text: string } =>
          isRecord(part) && !part.thought && typeof part.text === 'string',
      )
      .map((part) => part.text)
      .join('');
  }

  /** Week facts shared by the prompt and post-processing. */
  function week(
    input: GeneratePlanDto | SendChatDto,
    context: GeneratorContext,
    weekStart: string,
  ) {
    const at = now();
    const previous =
      context.activePlan?.version.plan.week_start === weekStart
        ? context.activePlan.version.plan.activities
        : [];
    const completed = new Set(context.completions.map((item) => item.activity_id));
    // Completed and already started sessions are history: they go back in verbatim.
    const kept = previous.filter(
      (activity) => completed.has(activity.id) || Date.parse(activity.start_at) < at,
    );
    const planned = previous.filter((activity) => !kept.includes(activity));
    // No answer could pass validation, so do not spend provider calls on it.
    if (kept.length > context.preferences.sessions_per_week)
      throw new ApiError(
        'INVALID_REQUEST',
        400,
        'This week already has more sessions than your weekly limit.',
      );
    const maxSessions = context.preferences.sessions_per_week - kept.length;
    return { at, input, context, weekStart, previous, kept, planned, completed, maxSessions };
  }
  type Week = ReturnType<typeof week>;

  function promptContext(plan: Week, sports: SportEntity[], extra: Record<string, unknown>) {
    const { context, input, weekStart } = plan;
    const timeZone = context.preferences.timezone;
    const toModel = (activity: Activity) => ({
      id: activity.id,
      sport_id: activity.sport_id,
      title: activity.title,
      description: activity.description,
      start_at: activity.start_at,
      duration_minutes: activity.duration_minutes,
      gym_exercises: activity.gym_exercises.map((item) => ({ id: item.id, sets: item.sets })),
    });
    return {
      now: localIso(plan.at, timeZone),
      timezone: timeZone,
      week: {
        start: weekStart,
        end: addDays(weekStart, 6),
        days: Array.from({ length: 7 }, (_, index) => {
          const date = addDays(weekStart, index);
          return `${weekdayOf(date)} ${date}`;
        }),
      },
      preferences: context.preferences,
      sports: sports.map((sport) => ({
        id: sport.id,
        name: sport.name,
        is_gym: sport.is_gym,
        metrics: sport.metrics.map((metric) => metric.label),
      })),
      ...(sports.some((sport) => sport.is_gym)
        ? {
            exercise_library: PLANNABLE_EXERCISES.map((item) => ({
              id: item.id,
              name: item.name,
              description: item.description,
              uses_weight: item.uses_weight,
              needs: item.needs,
            })),
          }
        : {}),
      limits: {
        sessions_per_week: context.preferences.sessions_per_week,
        max_returned_sessions: plan.maxSessions,
        max_session_minutes: context.preferences.session_minutes,
      },
      allowed_slots: allowedSlots({
        weekStart,
        timeZone,
        window: context.preferences.preferred_window,
        slots: input.availability.slots,
        now: plan.at,
      }),
      kept_sessions: plan.kept.map((activity) => ({
        id: activity.id,
        sport_id: activity.sport_id,
        title: activity.title,
        start_at: activity.start_at,
        duration_minutes: activity.duration_minutes,
        status: plan.completed.has(activity.id) ? 'completed' : 'past',
      })),
      planned_sessions: plan.planned.map(toModel),
      // Feedback may be given later, so a completion can arrive without it.
      completed_feedback: context.completions.flatMap((item) =>
        item.feedback
          ? [
              {
                activity_id: item.activity_id,
                effort: item.feedback.effort,
                would_choose_again: item.feedback.enjoyment,
              },
            ]
          : [],
      ),
      ...extra,
    };
  }

  /**
   * Turns the model's future sessions into a full snapshot: known IDs stay, new sessions get
   * fresh UUIDs, and kept sessions return verbatim. Returns a problem for the re-ask instead
   * of adjusting anything the model got wrong.
   */
  function snapshot(
    plan: Week,
    activities: RawActivity[],
  ): { plan: PlanSnapshotDto } | { problem: string } {
    const timeZone = plan.context.preferences.timezone;
    const keptIds = new Set(plan.kept.map((activity) => activity.id));
    const used = new Set<string>();
    const result: Activity[] = [...plan.kept];
    for (const raw of activities) {
      const known =
        raw.id && !used.has(raw.id) ? plan.previous.find((item) => item.id === raw.id) : undefined;
      // The app re-inserts kept sessions itself; a returned copy is ignored.
      if (known && keptIds.has(known.id)) continue;
      const exercises = (raw.gym_exercises ?? []).map((item) => ({
        id: item.id,
        sets: item.sets.map((set) => ({ repetitions: set.repetitions })),
      }));
      if (
        known &&
        known.sport_id === raw.sport_id &&
        known.title === raw.title.trim() &&
        known.description.trim() === raw.description.trim() &&
        Date.parse(known.start_at) === Date.parse(raw.start_at) &&
        known.duration_minutes === raw.duration_minutes &&
        JSON.stringify(known.gym_exercises.map((item) => ({ id: item.id, sets: item.sets }))) ===
          JSON.stringify(exercises)
      ) {
        // An untouched session stays byte-identical, so validation treats it as unchanged.
        used.add(known.id);
        result.push(known);
        continue;
      }
      const start = Date.parse(raw.start_at);
      const label = `Session "${raw.title}" at ${raw.start_at}`;
      if (!/(Z|[+-]\d{2}:\d{2})$/.test(raw.start_at) || !Number.isFinite(start))
        return { problem: `${label}: start_at needs a full timestamp with a UTC offset.` };
      if (start <= plan.at)
        return { problem: `${label} starts in the past; starts must be after now.` };
      const unknown = exercises.find((item) => !exerciseNames.has(item.id));
      if (unknown)
        return {
          problem: `${label} uses exercise ${unknown.id}, which is not in exercise_library.`,
        };
      const id = known ? known.id : crypto.randomUUID();
      used.add(id);
      result.push({
        id,
        sport_id: raw.sport_id,
        title: raw.title.trim(),
        description: raw.description.trim(),
        start_at: localIso(start, timeZone),
        duration_minutes: raw.duration_minutes,
        gym_exercises: exercises.map((item) => ({
          id: item.id,
          name: exerciseNames.get(item.id)!,
          sets: item.sets,
        })),
      });
    }
    result.sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at));
    return { plan: { week_start: plan.weekStart, timezone: timeZone, activities: result } };
  }

  /**
   * Asks Gemini, turns the answer into a result, and re-asks once with the specific problem
   * when local validation rejects it. Both calls share one deadline.
   */
  async function run<T>(
    system: string,
    context: unknown,
    schema: unknown,
    interpret: (value: unknown) => { result: T } | { problem: string },
  ): Promise<T> {
    const deadline = performance.now() + deadlineMs;
    const contents: { role: 'user' | 'model'; parts: { text: string }[] }[] = [
      { role: 'user', parts: [{ text: JSON.stringify(context) }] },
    ];
    for (let attempt = 0; ; attempt++) {
      const text = await request(
        {
          systemInstruction: {
            parts: [{ text: `${system}\n\nCurrent time: ${new Date(now()).toISOString()}.` }],
          },
          contents,
          generationConfig: {
            responseMimeType: 'application/json',
            responseJsonSchema: schema,
            maxOutputTokens: 16384,
            candidateCount: 1,
          },
        },
        deadline,
      );
      let value: unknown;
      try {
        value = JSON.parse(text);
      } catch {
        throw invalidOutput();
      }
      const outcome = interpret(value);
      if ('result' in outcome) return outcome.result;
      log(`[gemini] rejected answer: ${outcome.problem}`);
      if (attempt >= 1) throw invalidOutput();
      contents.push(
        { role: 'model', parts: [{ text }] },
        {
          role: 'user',
          parts: [
            {
              text: `The app could not use that answer: ${outcome.problem} Fix it and return the complete JSON object again, keeping every hard limit.`,
            },
          ],
        },
      );
    }
  }

  function planResult(plan: Week, activities: RawActivity[]) {
    const built = snapshot(plan, activities);
    if ('problem' in built) return built;
    const checked = checkGeneratedPlan(built.plan, plan.input, plan.context);
    return checked.ok ? { plan: checked.plan } : { problem: checked.problem };
  }

  return {
    async generate(input, context) {
      credentials();
      const plan = week(input, context, input.week_start);
      const other = context.activePlan?.version.plan;
      return run(
        GENERATE_PROMPT,
        promptContext(plan, context.sports, {
          requested_sport_id: input.sport_id,
          ...(other && other.week_start !== input.week_start
            ? {
                other_week_sessions: other.activities.map((activity) => ({
                  sport_id: activity.sport_id,
                  title: activity.title,
                  completed: plan.completed.has(activity.id),
                })),
              }
            : {}),
        }),
        responseSchema(
          false,
          context.sports,
          plan.maxSessions,
          context.preferences.session_minutes,
        ),
        (value) => {
          const parsed = rawGenerateSchema.safeParse(value);
          if (!parsed.success) return { problem: 'The JSON did not match the response schema.' };
          const summary = parsed.data.summary.trim().slice(0, 1000);
          if (!summary) return { problem: 'summary must not be empty.' };
          const built = planResult(plan, parsed.data.activities);
          return 'problem' in built ? built : { result: { plan: built.plan, summary } };
        },
      );
    },
    async chat(input, context): Promise<GeneratedChat> {
      credentials();
      const active = context.activePlan?.version.plan;
      if (!active) throw new ApiError('NOT_FOUND', 404, 'Plan not found.');
      const plan = week(input, context, active.week_start);
      const sports = chatSports(context);
      return run<GeneratedChat>(
        CHAT_PROMPT,
        promptContext(plan, sports, {
          conversation: context.messages.map((message) => ({
            role: message.role,
            content: message.content,
            outcome: message.outcome,
          })),
          user_message: input.message,
          attached_activity_id: input.activity_id ?? null,
        }),
        responseSchema(true, sports, plan.maxSessions, context.preferences.session_minutes),
        (value) => {
          const parsed = rawChatSchema.safeParse(value);
          if (!parsed.success) return { problem: 'The JSON did not match the response schema.' };
          const message = parsed.data.message.trim();
          if (!message) return { problem: 'message must not be empty.' };
          if (parsed.data.outcome !== 'plan_updated')
            return {
              result: { outcome: parsed.data.outcome, reply: message.slice(0, 2000) },
            };
          if (!parsed.data.activities)
            return { problem: 'plan_updated needs the full activities list.' };
          const built = planResult(plan, parsed.data.activities);
          return 'problem' in built
            ? built
            : {
                result: {
                  outcome: 'plan_updated',
                  plan: built.plan,
                  summary: message.slice(0, 1000),
                },
              };
        },
      );
    },
  };
}
