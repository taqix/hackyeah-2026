import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { usePreferences } from '@/api/hooks';
import { isGymSession, type LocalDate, type PlannedSession } from '@/api/types';
import { SuggestionCard } from '@/components/ui';
import { formatMinutes, formatTime } from '@/lib/dates';
import { isOutsidePreferredWindow, sessionMinutes, sessionStart } from '@/lib/sessions';
import { routes } from '@/navigation/routes';

import { dayWord, headline, heroBody } from './copy';
import { useHeroSize } from './hero-size';
import { NotTodaySheet } from './not-today-sheet';
import { SessionOutline } from './session-outline';

type Props = {
  session: PlannedSession;
  date: LocalDate;
  today: LocalDate;
  nextSession: PlannedSession | null;
};

/** "Today · 7:00 · 20 min · optional" */
function sessionKicker(session: PlannedSession, date: LocalDate, today: LocalDate): string {
  return [
    dayWord(date, today),
    formatTime(sessionStart(session)),
    formatMinutes(sessionMinutes(session)),
    session.optional ? 'optional' : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

function useBody(session: PlannedSession): string {
  const { data: preferences } = usePreferences();
  return heroBody(session, isOutsidePreferredWindow(session, preferences));
}

/** Today's planned session: the photo card with Start and Not today (5, 5.2). Large, it also lists the session's steps. */
export function TodaySessionHero({ session, date, today, nextSession }: Props) {
  const router = useRouter();
  const body = useBody(session);
  const large = useHeroSize() === 'lg';
  const [notToday, setNotToday] = useState(false);

  return (
    <View>
      <SuggestionCard
        tone="dusk"
        size={large ? 'lg' : 'md'}
        kicker={sessionKicker(session, date, today)}
        title={headline(session.title)}
        body={body}
        actionLabel="Start"
        onAction={() => router.push(isGymSession(session) ? routes.gym(session.id) : routes.session(session.id))}
        secondaryLabel="Not today"
        onSecondary={() => setNotToday(true)}>
        {large ? <SessionOutline session={session} /> : null}
      </SuggestionCard>
      <NotTodaySheet
        visible={notToday}
        onClose={() => setNotToday(false)}
        session={session}
        nextSession={nextSession}
        today={today}
      />
    </View>
  );
}

/** A planned day ahead (5.1): the same card to preview, without Start. */
export function PreviewSessionHero({ session, date, today }: Props) {
  const router = useRouter();
  const body = useBody(session);
  const large = useHeroSize() === 'lg';

  return (
    <SuggestionCard
      tone="dawn"
      size={large ? 'lg' : 'md'}
      kicker={sessionKicker(session, date, today)}
      title={headline(session.title)}
      body={body}
      actionLabel="Preview"
      onAction={() => router.push(routes.session(session.id))}>
      {large ? <SessionOutline session={session} /> : null}
    </SuggestionCard>
  );
}
