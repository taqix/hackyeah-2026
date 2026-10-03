/**
 * Home's hero slot and steps card (design/prototype/home.jsx: HeroCard, DayHero,
 * CheckIn, NotTodaySheet, StepCount).
 *
 * INTERFACE STUB. The Today screen (src/features/home) renders these; the
 * home-hero work replaces the bodies. Keep the exported names and props stable:
 * both sides code against them.
 */
import type { LocalDate, PlannedSession, PlanWeek } from '@/api/types';
import { Card, Text } from '@/components/ui';

export type DayHeroProps = {
  /** The selected day. */
  date: LocalDate;
  /** Today, from now(): tells past, today and future apart. */
  today: LocalDate;
  /** The selected day's plan session (the first one not done when there are several), or null for a rest day. */
  session: PlannedSession | null;
  /** The week the day belongs to. */
  week: PlanWeek;
  /** The next planned session after the selected day, possibly next week (done day: "what's next"). */
  nextSession: PlannedSession | null;
  /** Past weeks are history: show the day without actions. */
  readOnly: boolean;
  /** The selected day is the week's last and every plan session is done or skipped (5.6). */
  weekDone: boolean;
  /** Next week once it is planned (5.6 previews it), else null. */
  nextWeek: PlanWeek | null;
};

/** The one hero for the selected day: a session to start, a done day, rest, a missed session to log or move, or the week done. */
export function DayHero({ session, date }: DayHeroProps) {
  return (
    <Card variant="sunken">
      <Text variant="heading">{session ? session.title : 'Rest day'}</Text>
      <Text variant="bodySm">{date}</Text>
    </Card>
  );
}

/** Today's steps from the phone (useStepCounter): never a made-up zero. */
export function StepCountCard() {
  return (
    <Card variant="sunken">
      <Text variant="bodySm">Steps</Text>
    </Card>
  );
}
