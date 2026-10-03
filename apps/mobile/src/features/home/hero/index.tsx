/**
 * Home's hero slot and steps card (design/prototype/home.jsx: HeroCard, DayHero,
 * CheckIn, NotTodaySheet, StepCount).
 *
 * The Today screen (src/features/home) renders these. Keep the exported names
 * and props stable: both sides code against them.
 */
import type { LocalDate, PlannedSession, PlanWeek } from '@/api/types';

import { CheckInHero, DoneHero, RestHero, SkippedHero } from './day-heroes';
import { PreviewSessionHero, TodaySessionHero } from './session-hero';
import { WeekDoneHero } from './week-done-hero';

export { StepCountCard } from './step-count-card';

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

/**
 * The one hero for the selected day: a session to start, a done day, rest, a
 * missed session to log or move, or the week done. Only a planned session gets
 * the photo card; other days use a tinted card in the same slot.
 */
export function DayHero({ date, today, session, week, nextSession, readOnly, weekDone, nextWeek }: DayHeroProps) {
  const day = { date, today, readOnly, nextSession };

  if (weekDone) {
    return (
      <WeekDoneHero
        date={date}
        today={today}
        session={session}
        week={week}
        nextSession={nextSession}
        nextWeek={nextWeek}
        readOnly={readOnly}
      />
    );
  }
  if (!session) return <RestHero {...day} week={week} />;
  if (session.status === 'completed') return <DoneHero {...day} session={session} />;
  if (session.status === 'skipped') return <SkippedHero {...day} session={session} />;
  // Planned: today starts it, a later day previews it, an earlier day asks Log it or Move it.
  if (date < today) return <CheckInHero date={date} today={today} readOnly={readOnly} session={session} />;
  if (date === today && !readOnly) {
    return <TodaySessionHero date={date} today={today} session={session} nextSession={nextSession} />;
  }
  return <PreviewSessionHero date={date} today={today} session={session} nextSession={nextSession} />;
}
