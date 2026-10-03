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

export function validateGeneratedPlan(
  value: unknown,
  request: GeneratePlanDto | SendChatDto,
  context: GeneratorContext,
): PlanSnapshotDto {
  const parsed = planSnapshotSchema.safeParse(value);
  if (!parsed.success)
    throw new ApiError(
      'INVALID_AI_OUTPUT',
      502,
      'The generated plan was invalid. Try again.',
      true,
    );
  const plan = parsed.data;
  const invalid = () => {
    throw new ApiError(
      'INVALID_AI_OUTPUT',
      502,
      'The generated plan did not fit your preferences or availability.',
      true,
    );
  };
  const expectedWeek =
    'week_start' in request ? request.week_start : context.activePlan?.version.plan.week_start;
  if (
    plan.week_start !== expectedWeek ||
    plan.timezone !== context.preferences.timezone ||
    plan.activities.length > context.preferences.sessions_per_week
  )
    invalid();
  for (const activity of plan.activities) {
    // A changed preference never rewrites a completed session.
    const previous = context.activePlan?.version.plan.activities.find(
      (item) => item.id === activity.id,
    );
    const completed = context.completions.some((item) => item.activity_id === activity.id);
    if (previous && completed && context.activePlan?.version.plan.week_start === plan.week_start) {
      if (JSON.stringify(activity) !== JSON.stringify(previous)) invalid();
      continue;
    }
    const sport = context.sports.find(
      (item) => item.id === activity.sport_id && item.generation_enabled,
    );
    if (
      !sport ||
      context.preferences.excluded_activity_types.includes(activity.sport_id) ||
      ('sport_id' in request &&
        request.sport_id !== null &&
        activity.sport_id !== request.sport_id) ||
      ('sport_id' in request &&
        request.sport_id === null &&
        context.preferences.discovery_preference === 'selected_only' &&
        !context.preferences.activity_interests.includes(activity.sport_id)) ||
      (sport.is_gym ? activity.gym_exercises.length === 0 : activity.gym_exercises.length > 0) ||
      activity.duration_minutes > context.preferences.session_minutes
    )
      invalid();
    const start = Date.parse(activity.start_at);
    const end = start + activity.duration_minutes * 60000;
    if (
      !request.availability.slots.some(
        (slot) => start >= Date.parse(slot.start_at) && end <= Date.parse(slot.end_at),
      )
    )
      invalid();
    const window = context.preferences.preferred_window;
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
        invalid();
    }
  }
  if (context.activePlan?.version.plan.week_start === plan.week_start) {
    for (const completion of context.completions) {
      if (
        context.activePlan.version.plan.activities.some(
          (item) => item.id === completion.activity_id,
        ) &&
        !plan.activities.some((item) => item.id === completion.activity_id)
      )
        invalid();
    }
  }
  return plan;
}
