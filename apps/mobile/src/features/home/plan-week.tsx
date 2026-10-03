import { useRouter } from 'expo-router';

import type { LocalDate, PlanState, PlanWeek, Preferences, SportDefinition } from '@/api/types';
import { Col } from '@/components/layout';
import { DayHero, StepCountCard } from '@/features/home/hero';
import { activityLabel } from '@/lib/preference-options';
import { addDays, diffDays, formatWeekRange, joinAnd, relativeWeekLabel, startOfWeek, weekdayIndex } from '@/lib/dates';
import { useOpenChat } from '@/navigation/open-chat';

import { ChangePlan } from './change-plan';
import { isWeekDone, listTitle, nextSessionAfter, primarySession, stripDays } from './home-model';
import { PlanLoadError, QuietWeekHero, WeekSkeleton } from './plan-states';
import { WeekList } from './week-list';
import { WeekNav } from './week-nav';
import { WeekStrip, WeekStripLoading } from './week-strip';

type PlanWeekViewProps = {
  plan: PlanState;
  today: LocalDate;
  weekStart: LocalDate;
  day: LocalDate;
  /** The shown week once loaded. */
  week: PlanWeek | undefined;
  weekError: { offline: boolean; retrying: boolean; retry: () => void } | null;
  /** The week after the shown one, once it is planned and loaded. */
  nextWeek: PlanWeek | null;
  canNext: boolean;
  preferences: Preferences | null | undefined;
  sports: SportDefinition[] | undefined;
  /** Selects a week and a day in it; today in this week clears the selection. */
  onSelect: (weekStart: LocalDate, day: LocalDate) => void;
};

/**
 * The week (its dates, arrows and strip), the hero for the selected day, steps,
 * the week's sessions and Need a change?. The strip drives the hero.
 */
export function PlanWeekView({
  plan,
  today,
  weekStart,
  day,
  week,
  weekError,
  nextWeek,
  canNext,
  preferences,
  sports,
  onSelect,
}: PlanWeekViewProps) {
  const router = useRouter();
  const openChat = useOpenChat();
  const currentWeek = startOfWeek(today);
  const isCurrent = weekStart === currentWeek;
  const quiet = isCurrent && !!week?.planned && week.sessions.length === 0;
  const canPrev = !!plan.first_week_start && weekStart > plan.first_week_start;
  const word = relativeWeekLabel(weekStart, today);

  const page = (weeks: number) => {
    const target = addDays(weekStart, weeks * 7);
    onSelect(target, addDays(target, weekdayIndex(day)));
  };

  // Sunday, once next week is planned: the list previews it (5.6).
  const listWeek = week && isCurrent && today === week.week_end && nextWeek ? nextWeek : week;
  const weekNumber = plan.first_week_start ? Math.floor(diffDays(plan.first_week_start, weekStart) / 7) + 1 : null;
  const off = preferences ? switchedOff(preferences, sports) : [];

  return (
    <>
      <Col gap={6}>
        {!quiet || canPrev || canNext ? (
          <WeekNav
            label={`${formatWeekRange(weekStart)}${word ? ` · ${word}` : ''}`}
            onPrev={canPrev ? () => page(-1) : null}
            onNext={canNext ? () => page(1) : null}
            nextHint={weekStart > currentWeek ? 'Plans go one week ahead' : 'Next week is planned on Sunday'}
            onThisWeek={isCurrent ? null : () => onSelect(currentWeek, today)}
          />
        ) : null}
        {week ? (
          <WeekStrip
            days={stripDays(week, today)}
            today={today}
            selected={day}
            onSelect={quiet ? undefined : (date) => onSelect(weekStart, date)}
          />
        ) : (
          <WeekStripLoading weekStart={weekStart} today={today} />
        )}
      </Col>
      {weekError ? (
        <PlanLoadError offline={weekError.offline} retrying={weekError.retrying} onRetry={weekError.retry} />
      ) : !week || !listWeek ? (
        <WeekSkeleton />
      ) : (
        <>
          {quiet ? (
            <QuietWeekHero
              kicker={weekNumber && weekNumber > 0 ? `Week ${weekNumber}` : 'This week'}
              note={switchedOffNote(off)}
              onReviewChoices={() => (off.length ? router.push('/profile/feedback') : router.navigate('/you'))}
              onOpenChat={() => openChat()}
            />
          ) : (
            <DayHero
              date={day}
              today={today}
              session={primarySession(week, day)}
              week={week}
              nextSession={nextSessionAfter(day, [week, nextWeek])}
              readOnly={weekStart < currentWeek}
              weekDone={isWeekDone(week, day)}
              nextWeek={nextWeek}
            />
          )}
          {isCurrent && !quiet ? <StepCountCard /> : null}
          <WeekList
            title={listTitle(relativeWeekLabel(listWeek.week_start, today), formatWeekRange(listWeek.week_start))}
            week={listWeek}
            today={today}
            activeVersion={plan.active_version}
          />
          {quiet ? null : <ChangePlan />}
        </>
      )}
    </>
  );
}

/** The sports she picked that feedback has switched off, by name. */
function switchedOff(preferences: Preferences, sports: SportDefinition[] | undefined): string[] {
  return preferences.activity_interests
    .filter((id) => preferences.excluded_activity_types.includes(id))
    .map((id) => activityLabel(id, sports));
}

/** "Walk and Run are both switched off in your choices." */
function switchedOffNote(names: string[]): string | null {
  if (!names.length) return null;
  if (names.length === 1) return `${names[0]} is switched off in your choices.`;
  const all = names.length === 2 ? 'both' : 'all';
  return `${joinAnd(names)} are ${all} switched off in your choices.`;
}
