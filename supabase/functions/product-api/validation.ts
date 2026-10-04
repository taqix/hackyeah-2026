import { z, planSnapshotSchema } from '../../../packages/contracts/src/product.ts';
import type {
  GeneratePlanDto,
  PlanSnapshotDto,
  SendChatDto,
} from '../../../packages/contracts/src/product.ts';
import type { GeneratorContext } from './ports.ts';
import { ApiError } from './errors.ts';

export function parseInput<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new ApiError('INVALID_REQUEST', 400, 'Check the request fields.');
  return result.data;
}

export type PlanCheck =
  | { ok: true; plan: PlanSnapshotDto }
  | { ok: false; shape: boolean; problem: string };

/**
 * Finds the first rule a generated plan breaks. The problem text is written for the AI
 * adapter's single re-ask; clients only ever see validateGeneratedPlan's generic messages.
 */
export function checkGeneratedPlan(
  value: unknown,
  request: GeneratePlanDto | SendChatDto,
  context: GeneratorContext,
): PlanCheck {
  const parsed = planSnapshotSchema.safeParse(value);
  if (!parsed.success)
    return {
      ok: false,
      shape: true,
      problem: parsed.error.issues
        .slice(0, 3)
        .map((issue) => `${issue.path.join('.') || 'plan'}: ${issue.message}`)
        .join('; '),
    };
  const plan = parsed.data;
  const { preferences } = context;
  const fail = (problem: string): PlanCheck => ({ ok: false, shape: false, problem });
  const previousPlan = context.activePlan?.version.plan;
  const sameWeek = previousPlan?.week_start === plan.week_start;
  const expectedWeek = 'week_start' in request ? request.week_start : previousPlan?.week_start;
  if (plan.week_start !== expectedWeek) return fail(`week_start must be ${expectedWeek}.`);
  if (plan.timezone !== preferences.timezone)
    return fail(`timezone must be ${preferences.timezone}.`);
  if (plan.activities.length > preferences.sessions_per_week)
    return fail(
      `The week has ${plan.activities.length} sessions; at most ${preferences.sessions_per_week} are allowed.`,
    );
  for (const activity of plan.activities) {
    const label = `Session "${activity.title}" at ${activity.start_at}`;
    const previous = sameWeek
      ? previousPlan?.activities.find((item) => item.id === activity.id)
      : undefined;
    if (previous) {
      const unchanged = JSON.stringify(activity) === JSON.stringify(previous);
      // A changed preference never rewrites a completed session.
      if (!unchanged && context.completions.some((item) => item.activity_id === activity.id))
        return fail(`${label} is completed and must stay exactly as it was.`);
      // An unchanged session was checked when it was planned. Skipping it lets a mid-week
      // revision or a same-week regeneration keep past sessions that later answers or
      // availability no longer cover.
      if (unchanged) continue;
    }
    const sport = context.sports.find(
      (item) => item.id === activity.sport_id && item.generation_enabled,
    );
    if (
      !sport ||
      preferences.excluded_activity_types.includes(activity.sport_id) ||
      ('sport_id' in request &&
        request.sport_id !== null &&
        activity.sport_id !== request.sport_id) ||
      ('sport_id' in request &&
        request.sport_id === null &&
        preferences.discovery_preference === 'selected_only' &&
        !preferences.activity_interests.includes(activity.sport_id))
    )
      return fail(`${label} uses sport ${activity.sport_id}, which is not allowed here.`);
    if (sport.is_gym && activity.gym_exercises.length === 0)
      return fail(`${label} is a gym session and needs at least one exercise.`);
    if (!sport.is_gym && activity.gym_exercises.length > 0)
      return fail(`${label} is not a gym session, so gym_exercises must be empty.`);
    if (activity.duration_minutes > preferences.session_minutes)
      return fail(
        `${label} lasts ${activity.duration_minutes} minutes; the limit is ${preferences.session_minutes}.`,
      );
    const start = Date.parse(activity.start_at);
    const end = start + activity.duration_minutes * 60000;
    if (
      !request.availability.slots.some(
        (slot) => start >= Date.parse(slot.start_at) && end <= Date.parse(slot.end_at),
      )
    )
      return fail(`${label} is not fully inside one free time slot.`);
    const window = preferences.preferred_window;
    if (window) {
      const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: plan.timezone,
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      });
      const asMinutes = (date: number) => {
        const parts = formatter.formatToParts(new Date(date));
        return (
          Number(parts.find((part) => part.type === 'hour')?.value) * 60 +
          Number(parts.find((part) => part.type === 'minute')?.value)
        );
      };
      if (
        asMinutes(start) < window.start_hour * 60 ||
        asMinutes(end) > window.end_hour * 60 ||
        asMinutes(end) <= asMinutes(start)
      )
        return fail(
          `${label} is outside the preferred hours ${window.start_hour}:00-${window.end_hour}:00.`,
        );
    }
  }
  if (sameWeek) {
    for (const completion of context.completions) {
      if (
        previousPlan?.activities.some((item) => item.id === completion.activity_id) &&
        !plan.activities.some((item) => item.id === completion.activity_id)
      )
        return fail(`Completed session ${completion.activity_id} is missing; keep it unchanged.`);
    }
  }
  return { ok: true, plan };
}

export function validateGeneratedPlan(
  value: unknown,
  request: GeneratePlanDto | SendChatDto,
  context: GeneratorContext,
): PlanSnapshotDto {
  const result = checkGeneratedPlan(value, request, context);
  if (result.ok) return result.plan;
  throw new ApiError(
    'INVALID_AI_OUTPUT',
    502,
    result.shape
      ? 'The generated plan was invalid. Try again.'
      : 'The generated plan did not fit your preferences or availability.',
    true,
  );
}
