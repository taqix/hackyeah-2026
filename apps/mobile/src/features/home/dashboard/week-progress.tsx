import { queryOptions, skipToken, useQueries } from '@tanstack/react-query';
import { StyleSheet, View } from 'react-native';

import { queryKeys } from '@/api/query-keys';
import type { ActivityLog, PlanWeek } from '@/api/types';
import { Section } from '@/components/layout';
import { Card, Icon, ProgressRing, Text } from '@/components/ui';
import { formatMinutes, formatWeekRange } from '@/lib/dates';
import { sessionMinutes, weekProgress } from '@/lib/sessions';
import { useTheme } from '@/theme';

import { minutesOf, optionalDone } from './board-model';

/**
 * Minutes planned and done in the week's plan sessions (optional and skipped
 * ones never count, as in weekProgress). A done session counts its logged
 * length: the board's tiles load those logs (useLog), and this reads them from
 * the cache without fetching; until one arrives its planned length stands in.
 */
function useWeekMinutes(week: PlanWeek): { done: number; planned: number } {
  const counted = week.sessions.filter((s) => !s.optional && s.status !== 'skipped');
  const done = counted.filter((s) => s.status === 'completed');
  const logs = useQueries({
    queries: done.map((s) => queryOptions<ActivityLog>({ queryKey: queryKeys.log(s.log_id ?? ''), queryFn: skipToken })),
  });
  const planned = counted.reduce((sum, s) => sum + sessionMinutes(s), 0);
  const moved = done.reduce((sum, s, i) => {
    const log = logs[i]?.data;
    return sum + (log ? Math.round(log.duration_seconds / 60) : sessionMinutes(s));
  }, 0);
  return { done: moved, planned };
}

type WeekProgressCardProps = {
  /** "This week", "Last week", "Next week". */
  title: string;
  week: PlanWeek;
};

/**
 * How the week is going, beside the board: plan sessions done out of those
 * that count, and their minutes. A plain count, never a score or a streak.
 */
export function WeekProgressCard({ title, week }: WeekProgressCardProps) {
  const { colors } = useTheme();
  const { done, total } = weekProgress(week);
  const minutes = useWeekMinutes(week);
  const optional = optionalDone(week);
  const extras = week.extras.length;
  // Nothing done yet reads as what is planned, never as zero.
  const summary = !total ? 'No sessions' : done ? `${done} of ${total} done` : `${total} ${total === 1 ? 'session' : 'sessions'} planned`;
  const time = minutes.done ? minutesOf(minutes.done, minutes.planned) : `${formatMinutes(minutes.planned)} planned`;

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <Section>{title}</Section>
        <Text variant="caption" tabular>
          {formatWeekRange(week.week_start)}
        </Text>
      </View>
      <View style={styles.body}>
        <ProgressRing
          value={total ? done / total : 0}
          size={88}
          stroke={8}
          label={`${done}/${total}`}
          accessibilityLabel={total ? `${done} of ${total} sessions done` : 'No sessions this week'}
        />
        <View style={styles.facts}>
          <Text variant="subheading" tabular>
            {summary}
          </Text>
          {total ? (
            <Fact icon="clock" text={time} color={colors.textTertiary} />
          ) : null}
          {optional ? (
            <Fact
              icon="plus"
              text={`${optional} optional ${optional === 1 ? 'session' : 'sessions'} done`}
              color={colors.textTertiary}
            />
          ) : null}
          {extras ? (
            <Fact
              icon="plus"
              text={`${extras} ${extras === 1 ? 'extra workout' : 'extra workouts'}`}
              color={colors.textTertiary}
            />
          ) : null}
        </View>
      </View>
    </Card>
  );
}

function Fact({ icon, text, color }: { icon: 'clock' | 'plus'; text: string; color: string }) {
  return (
    <View style={styles.fact}>
      <Icon name={icon} size={14} color={color} />
      <Text variant="bodySm" tabular>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 16 },
  head: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  body: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  facts: { flex: 1, minWidth: 0, gap: 6 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
