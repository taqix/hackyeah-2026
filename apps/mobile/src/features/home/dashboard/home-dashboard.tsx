import { useRouter } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { View } from 'react-native';

import { useWeek } from '@/api/hooks';
import { isApiError, type LocalDate, type PlanWeek } from '@/api/types';
import { Content, Screen } from '@/components/layout';
import { Skeleton } from '@/components/ui';
import { useStepCounter } from '@/hooks/use-step-counter';
import { addDays, diffDays, formatWeekRange, greeting, relativeWeekLabel, weekdayIndex } from '@/lib/dates';

import { DayHero, StepCountCard } from '../hero';
import { HeroSizeProvider } from '../hero/hero-size';
import {
  changedWhen,
  isWeekDone,
  listTitle,
  nextSessionAfter,
  primarySession,
  switchedOff,
  switchedOffNote,
} from '../home-model';
import { BuildFailed, BuildingHero, NoPlanYet, PlanLoadError, PlanNote, QuietWeekHero } from '../plan-states';
import { PlanUpdated } from '../plan-updated';
import type { HomeState } from '../use-home';
import { Appear, type AppearFrom } from './appear';
import { weekSubtitle } from './board-model';
import { DashboardHeader } from './dashboard-header';
import { DashboardLayout } from './dashboard-layout';
import { BoardSkeleton, HeroSkeleton, PageHeaderSkeleton, sideSkeletons } from './dashboard-skeleton';
import { ChangeCard, NextWeekCard, WhyThisPlanCard } from './side-cards';
import { useWeekKeys } from './use-week-keys';
import { WeekBoard } from './week-board';
import { WeekProgressCard } from './week-progress';

/** A plan state's card reads best at about a paragraph's width, not the whole page. */
const STATE_MAX_WIDTH = 760;

/**
 * The Today tab on the desktop web (from 768 px): the same answers as the
 * phone (what do I do today, and how is my week going?) as a dashboard. The
 * selected day's hero and the week as a board share the main column; how the
 * week is going, notes and quick changes sit beside them.
 */
export function HomeDashboard({ home }: { home: HomeState }) {
  const router = useRouter();
  const {
    now,
    today,
    currentWeek,
    focused,
    kicker,
    name,
    answers,
    preferences,
    sports,
    planState,
    plan,
    weekStart,
    day,
    week,
    nextWeek,
    canNext,
    build,
    buildPlan,
    recentChange,
    dismissChange,
    openChat,
    reviewAnswers,
    select,
  } = home;
  const steps = useStepCounter();
  const ready = plan?.status === 'ready';
  const weekData = ready ? week.data : undefined;
  const isCurrent = weekStart === currentWeek;
  const quiet = isCurrent && !!weekData?.planned && weekData.sessions.length === 0;
  const nextPlanned = nextWeek.data?.planned ? nextWeek.data : null;

  // Paging slides the new week in from the side it came from; a later day slides the hero in from the right.
  const [boardFrom, setBoardFrom] = useState<{ week: LocalDate; from: AppearFrom }>({ week: weekStart, from: 'below' });
  if (boardFrom.week !== weekStart) setBoardFrom({ week: weekStart, from: weekStart > boardFrom.week ? 'right' : 'left' });
  const [heroFrom, setHeroFrom] = useState<{ day: LocalDate; from: AppearFrom }>({ day, from: 'below' });
  if (heroFrom.day !== day) setHeroFrom({ day, from: day > heroFrom.day ? 'right' : 'left' });

  // The header describes today, so its line is this week's, whichever week the board shows.
  const thisWeek = useWeek(currentWeek, { enabled: ready }).data;

  const canPrev = ready && !!plan.first_week_start && weekStart > plan.first_week_start;
  const pageBy = (weeks: number) => {
    const target = addDays(weekStart, weeks * 7);
    select(target, addDays(target, weekdayIndex(day)));
  };
  const onPrev = canPrev ? () => pageBy(-1) : null;
  const onNext = ready && canNext ? () => pageBy(1) : null;
  const onThisWeek = ready && !isCurrent ? () => select(currentWeek, today) : null;
  useWeekKeys(focused && ready, { onPrev, onNext, onThisWeek });

  const askCoach = () => openChat();
  const word = relativeWeekLabel(weekStart, today);
  const title = listTitle(word, formatWeekRange(weekStart));

  const header = (
    <DashboardHeader
      kicker={kicker}
      title={name ? `${greeting(now)}, ${name}` : greeting(now)}
      subtitle={thisWeek ? weekSubtitle(thisWeek) : undefined}
      week={
        ready && (!quiet || canPrev || canNext)
          ? {
              label: `${formatWeekRange(weekStart)}${word ? ` · ${word}` : ''}`,
              onPrev,
              onNext,
              nextHint: weekStart > currentWeek ? 'Plans go one week ahead' : 'Next week is planned on Sunday',
              onThisWeek,
            }
          : null
      }
      onAskCoach={askCoach}
    />
  );

  let body: ReactNode;
  if (planState.isPending) {
    body = (
      <View accessible role="status" accessibilityLabel="Loading your plan">
        <DashboardLayout
          header={<PageHeaderSkeleton />}
          focus={<HeroSkeleton />}
          board={<BoardSkeleton weekStart={currentWeek} today={today} label="This week, loading" />}
          side={sideSkeletons()}
        />
      </View>
    );
  } else if (planState.isError || !plan) {
    body = (
      <DashboardLayout
        header={header}
        focusMaxWidth={STATE_MAX_WIDTH}
        focus={
          <Hero>
            <PlanLoadError
              offline={isApiError(planState.error, 'offline')}
              retrying={planState.isFetching}
              onRetry={() => void planState.refetch()}
            />
          </Hero>
        }
      />
    );
  } else if (plan.status === 'building') {
    body = (
      <DashboardLayout
        header={header}
        focus={
          <Hero>
            <BuildingHero answers={answers} />
          </Hero>
        }
        board={<BoardSkeleton weekStart={currentWeek} today={today} label="Your first week, building" />}
      />
    );
  } else if (plan.status === 'failed') {
    body = (
      <DashboardLayout
        header={header}
        focusMaxWidth={STATE_MAX_WIDTH}
        focus={
          <Hero>
            <BuildFailed
              message={plan.failure_message}
              unavailable={plan.failure_code === 'ai_unavailable'}
              answers={answers}
              retrying={build.isPending}
              retryFailed={build.isError}
              onRetry={buildPlan}
              onReviewAnswers={reviewAnswers}
            />
          </Hero>
        }
      />
    );
  } else if (plan.status === 'none') {
    body = (
      <DashboardLayout
        header={header}
        focusMaxWidth={STATE_MAX_WIDTH}
        focus={
          <Hero>
            <NoPlanYet building={build.isPending} failed={build.isError} onBuild={buildPlan} />
          </Hero>
        }
      />
    );
  } else {
    const weekError = week.isError;
    const off = preferences ? switchedOff(preferences, sports) : [];
    const weekNumber = plan.first_week_start ? Math.floor(diffDays(plan.first_week_start, weekStart) / 7) + 1 : null;

    let focus: ReactNode;
    if (weekError) {
      focus = (
        <PlanLoadError
          offline={isApiError(week.error, 'offline')}
          retrying={week.isFetching}
          onRetry={() => void week.refetch()}
        />
      );
    } else if (!weekData) {
      focus = <HeroSkeleton />;
    } else if (quiet) {
      focus = (
        <QuietWeekHero
          kicker={weekNumber && weekNumber > 0 ? `Week ${weekNumber}` : 'This week'}
          note={switchedOffNote(off)}
          onReviewChoices={() => (off.length ? router.push('/profile/feedback') : router.navigate('/you'))}
          onOpenChat={askCoach}
        />
      );
    } else {
      focus = (
        <DayHero
          date={day}
          today={today}
          session={primarySession(weekData, day)}
          week={weekData}
          nextSession={nextSessionAfter(day, [weekData, nextPlanned])}
          readOnly={weekStart < currentWeek}
          weekDone={isWeekDone(weekData, day)}
          nextWeek={nextPlanned}
        />
      );
    }

    body = (
      <DashboardLayout
        header={header}
        notes={[
          recentChange ? (
            <Appear key="updated" index={1}>
              <PlanUpdated
                summary={recentChange.summary}
                when={changedWhen(recentChange.created_at, now)}
                onDismiss={dismissChange}
                onSeeChat={() => {
                  dismissChange();
                  openChat();
                }}
              />
            </Appear>
          ) : null,
          plan.failure_message ? (
            <Appear key="note" index={1}>
              <PlanNote message={plan.failure_message} />
            </Appear>
          ) : null,
        ]}
        focusMaxWidth={weekError ? STATE_MAX_WIDTH : undefined}
        focus={
          <Appear key={weekError ? 'error' : `${weekStart}:${day}`} index={1} from={heroFrom.from}>
            <Hero>{focus}</Hero>
          </Appear>
        }
        board={
          weekError ? null : weekData ? (
            <WeekBoard
              key={weekStart}
              title={title}
              summary={isCurrent ? null : weekData.summary}
              week={weekData}
              today={today}
              selected={day}
              activeVersion={plan.active_version}
              onSelectDay={quiet ? undefined : (date) => select(weekStart, date)}
              from={boardFrom.from}
            />
          ) : (
            <BoardSkeleton weekStart={weekStart} today={today} label={`${title}, loading`} />
          )
        }
        side={sideCards({
          weekData,
          weekError,
          title,
          quiet,
          isCurrent,
          nextPlanned,
          stepsSupported: steps.supported,
          answers,
          onReviewAnswers: reviewAnswers,
          onOpenNextWeek: onNext,
          onAskCoach: askCoach,
        })}
      />
    );
  }

  return (
    <Screen>
      <Content gap={0}>{body}</Content>
    </Screen>
  );
}

/** The hero slot at the dashboard's size. */
function Hero({ children }: { children: ReactNode }) {
  return <HeroSizeProvider value="lg">{children}</HeroSizeProvider>;
}

type SideCardsInput = {
  weekData: PlanWeek | undefined;
  weekError: boolean;
  title: string;
  quiet: boolean;
  isCurrent: boolean;
  nextPlanned: PlanWeek | null;
  stepsSupported: boolean;
  answers: string | null;
  onReviewAnswers: () => void;
  onOpenNextWeek: (() => void) | null;
  onAskCoach: () => void;
};

/**
 * The side column, top to bottom: how the week is going, steps (phones only,
 * so never on the web), next week once planned, why the plan looks this way,
 * and quick changes. A quiet week keeps only the reason; its hero has the rest.
 */
function sideCards(input: SideCardsInput): ReactNode[] {
  const { weekData, weekError, title, quiet, isCurrent, nextPlanned } = input;
  const cards: ReactNode[] = [];
  // Each card comes in a beat after the one above it.
  const add = (key: string, card: ReactNode) =>
    cards.push(
      <Appear key={key} index={cards.length + 2}>
        {card}
      </Appear>,
    );
  if (weekData && !quiet) add('progress', <WeekProgressCard title={title} week={weekData} />);
  else if (!weekData && !weekError) add('progress', <Skeleton height={168} radius={24} />);
  if (isCurrent && !quiet && input.stepsSupported) add('steps', <StepCountCard />);
  if (isCurrent && nextPlanned && input.onOpenNextWeek) {
    add('next', <NextWeekCard week={nextPlanned} onOpen={input.onOpenNextWeek} />);
  }
  if (input.answers) add('why', <WhyThisPlanCard answers={input.answers} onReviewAnswers={input.onReviewAnswers} />);
  if (!quiet) add('change', <ChangeCard onAskCoach={input.onAskCoach} />);
  return cards;
}
