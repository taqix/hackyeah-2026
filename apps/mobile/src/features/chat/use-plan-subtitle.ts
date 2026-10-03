import { usePlanState, useSports, useWeek } from '@/api/hooks';
import { capitalize, diffDays, startOfWeek } from '@/lib/dates';
import { sportName } from '@/lib/sport-visuals';

/** The header's sub-line: "Running · week 1" (the sport most of this week's plan sessions are). */
export function usePlanSubtitle(today: Date): string | null {
  const plan = usePlanState();
  const sports = useSports();
  const weekStart = startOfWeek(today);
  const ready = plan.data?.status === 'ready';
  const week = useWeek(weekStart, { enabled: ready });

  const firstWeek = plan.data?.first_week_start;
  if (!ready || !firstWeek) return null;

  const weekLabel = `week ${Math.max(1, Math.floor(diffDays(firstWeek, weekStart) / 7) + 1)}`;
  const counts = new Map<string, number>();
  for (const session of week.data?.sessions ?? []) {
    if (!session.optional) counts.set(session.sport_id, (counts.get(session.sport_id) ?? 0) + 1);
  }
  const main = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return main ? `${sportName(sports.data, main)} · ${weekLabel}` : capitalize(weekLabel);
}
