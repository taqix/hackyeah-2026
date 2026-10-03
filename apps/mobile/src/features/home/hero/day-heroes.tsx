import { useRouter } from 'expo-router';

import { useLog } from '@/api/hooks';
import type { LocalDate, PlannedSession, PlanWeek } from '@/api/types';
import { Button, TextLink } from '@/components/ui';
import { formatMinutes, formatTime } from '@/lib/dates';
import { sessionLocalDate, sessionMinutes, sessionStart } from '@/lib/sessions';
import { useOpenChat } from '@/navigation/open-chat';
import { routes } from '@/navigation/routes';

import { dayWord, FELT_WORDS, headline } from './copy';
import { HeroCard } from './hero-card';
import { NextRow } from './next-row';

type DayProps = {
  date: LocalDate;
  today: LocalDate;
  readOnly: boolean;
  nextSession: PlannedSession | null;
};

/** "What's next" only when it is still ahead and the day isn't history. */
function Next({ nextSession, today, readOnly }: Pick<DayProps, 'nextSession' | 'today' | 'readOnly'>) {
  if (readOnly || !nextSession || sessionLocalDate(nextSession) < today) return null;
  return <NextRow session={nextSession} today={today} />;
}

/** A done day (5.3): moss, how it felt from its log, and what's next. */
export function DoneHero({ session, date, today, readOnly, nextSession }: DayProps & { session: PlannedSession }) {
  const router = useRouter();
  const { data: log } = useLog(session.log_id);
  const isToday = date === today;
  const felt = log?.feedback?.felt ?? null;
  const minutes = log ? log.duration_seconds / 60 : sessionMinutes(session);
  const steady = felt === 'easy' || felt === 'just_right';
  const title = isToday ? (steady ? 'Nice and steady.' : 'Done for today.') : headline(session.title);
  const body = felt ? `You said it felt ${FELT_WORDS[felt]}.` : log ? 'Logged.' : null;

  return (
    <HeroCard tone="done" icon="check" kicker={`${dayWord(date, today)} · done · ${formatMinutes(minutes)}`} title={title} body={body}>
      {log && !log.feedback && !readOnly ? (
        <TextLink onPress={() => router.push(routes.feedback(log.id))} style={{ marginTop: -4 }}>
          Say how it felt
        </TextLink>
      ) : null}
      <Next nextSession={nextSession} today={today} readOnly={readOnly} />
    </HeroCard>
  );
}

/** A rest day, or a day in a week that isn't planned: sage, with what's next. */
export function RestHero({ date, today, readOnly, nextSession, week }: DayProps & { week: PlanWeek }) {
  const when = dayWord(date, today);
  const rest = week.planned;
  return (
    <HeroCard
      tone="rest"
      icon="feather"
      kicker={rest ? `${when} · rest day` : when}
      title={rest ? 'Rest day.' : 'Nothing planned.'}
      body={
        rest
          ? `${date === today ? 'Nothing planned today.' : 'Nothing planned.'} Rest is part of the plan, too.`
          : 'A free day. Rest is part of the plan, too.'
      }>
      <Next nextSession={nextSession} today={today} readOnly={readOnly} />
    </HeroCard>
  );
}

/** A skipped session reads like a rest day: nothing to make up. */
export function SkippedHero({ session, date, today, readOnly, nextSession }: DayProps & { session: PlannedSession }) {
  return (
    <HeroCard
      tone="rest"
      icon="moon"
      kicker={`${dayWord(date, today)} · skipped`}
      title={headline(session.title)}
      body="Skipped, and that's fine. There's nothing to make up.">
      <Next nextSession={nextSession} today={today} readOnly={readOnly} />
    </HeroCard>
  );
}

/**
 * A past session with no outcome (5.5): not a missed state. Log it, or Move it
 * into chat (8.15), where skipping is offered last and quietly.
 */
export function CheckInHero({ session, date, today, readOnly }: Omit<DayProps, 'nextSession'> & { session: PlannedSession }) {
  const router = useRouter();
  const openChat = useOpenChat();
  const kicker = `${dayWord(date, today)} · ${formatTime(sessionStart(session))} · ${formatMinutes(sessionMinutes(session))}`;

  if (readOnly) {
    return <HeroCard icon="calendar-clock" kicker={kicker} title={headline(session.title)} body="Not logged." />;
  }
  return (
    <HeroCard
      icon="calendar-clock"
      kicker={kicker}
      title={headline(session.title)}
      body="Not logged. If you went, log it. If not, move it to a day that suits you."
      actions={
        <>
          <Button variant="secondary" icon="check" onPress={() => router.push(routes.log(session.id))}>
            Log it
          </Button>
          <Button
            variant="secondary"
            icon="calendar-arrow-up"
            onPress={() => openChat({ aboutSessionId: session.id, intent: 'move' })}>
            Move it
          </Button>
        </>
      }
    />
  );
}
