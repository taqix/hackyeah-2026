/**
 * When to plan the next week, pure (Home runs it on focus, with either
 * backend). Plans go one week ahead.
 */
import { addDays, startOfWeek } from '../../../lib/dates';
import type { LocalDate, PlanState } from '../../types';

/**
 * The Monday to plan now, or null. From the last planned day (planned_through,
 * a Sunday) on, the following Monday's week is planned; after a gap, when the
 * current week was never planned, the current week is. Only for a ready plan.
 */
export function weekToPlanNext(
  state: Pick<PlanState, 'status' | 'planned_through'> | null | undefined,
  today: LocalDate,
): LocalDate | null {
  if (!state || state.status !== 'ready' || !state.planned_through) return null;
  if (today < state.planned_through) return null;
  const thisWeek = startOfWeek(today);
  return thisWeek > state.planned_through ? thisWeek : addDays(thisWeek, 7);
}
