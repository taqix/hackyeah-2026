import { StyleSheet, View } from 'react-native';

import { usePlanState } from '@/api/hooks';
import type { LocalDate, PlannedSession, PlanWeek } from '@/api/types';
import { Icon, Text } from '@/components/ui';
import { capitalize, diffDays, numberWord } from '@/lib/dates';
import { sessionLocalDate } from '@/lib/sessions';
import { useTheme } from '@/theme';

import { WHY_IT_MATTERS } from './copy';
import { HeroCard, HeroFootnote } from './hero-card';
import { NextRow } from './next-row';

type Props = {
  date: LocalDate;
  today: LocalDate;
  session: PlannedSession | null;
  week: PlanWeek;
  nextSession: PlannedSession | null;
  nextWeek: PlanWeek | null;
  readOnly: boolean;
};

/** "Two sessions. Good work — keep it going. Rest today; week 2 starts tomorrow." */
function weekDoneBody({ done, weekNumber, onToday, restToday, nextPlanned }: {
  done: number;
  weekNumber: number | null;
  onToday: boolean;
  restToday: boolean;
  nextPlanned: boolean;
}): string {
  const parts = [
    done > 0
      ? `${capitalize(numberWord(done))} ${done === 1 ? 'session' : 'sessions'}. Good work — keep it going.`
      : "The week is done. There's nothing to make up.",
  ];
  if (onToday) {
    const tomorrow = nextPlanned ? (weekNumber ? `week ${weekNumber + 1} starts tomorrow` : 'next week starts tomorrow') : null;
    if (restToday) parts.push(tomorrow ? `Rest today; ${tomorrow}.` : 'Rest today.');
    else if (tomorrow) parts.push(`${capitalize(tomorrow)}.`);
  }
  return parts.join(' ');
}

/**
 * 5.6: the week's last day once every session is done or skipped. Celebrated
 * whatever was skipped, with one plain reason it matters: no streaks, no scores.
 */
export function WeekDoneHero({ date, today, session, week, nextSession, nextWeek, readOnly }: Props) {
  const { colors } = useTheme();
  const { data: plan } = usePlanState();
  const first = plan?.first_week_start ?? null;
  const weekNumber = first ? Math.floor(diffDays(first, week.week_start) / 7) + 1 : null;
  const done = week.sessions.filter((s) => s.status === 'completed').length;
  const nextPlanned = !!nextWeek?.planned;

  const title = weekNumber === 1 ? 'First week, done.' : weekNumber ? `Week ${weekNumber}, done.` : 'Week done.';
  const label = weekNumber ? `Week ${weekNumber}` : 'This week';
  const kicker = done > 0 ? `${label} · ${done} ${done === 1 ? 'session' : 'sessions'}` : label;
  const body = weekDoneBody({
    done,
    weekNumber,
    onToday: date === today,
    restToday: session?.status !== 'completed',
    nextPlanned,
  });
  const showNext = !readOnly && nextSession && sessionLocalDate(nextSession) > date;

  return (
    <HeroCard tone="warm" icon="sun" kicker={kicker} title={title} body={body}>
      <HeroFootnote>
        <View style={styles.reason}>
          <View style={styles.icon}>
            <Icon name="heart" size={16} color={colors.warmText} />
          </View>
          <Text variant="bodySm" style={styles.reasonText}>
            {WHY_IT_MATTERS}
          </Text>
        </View>
      </HeroFootnote>
      {showNext ? <NextRow session={nextSession} today={today} /> : null}
    </HeroCard>
  );
}

const styles = StyleSheet.create({
  reason: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  icon: { marginTop: 2 },
  reasonText: { flex: 1, minWidth: 0 },
});
