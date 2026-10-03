import { StyleSheet, View } from 'react-native';

import { useWeek } from '@/api/hooks';
import type { ActivityLog, PlannedSession, SportDefinition } from '@/api/types';
import { Col, Section } from '@/components/layout';
import { Button, Card, ListRow, Skeleton, Text } from '@/components/ui';
import { formatMinutes, startOfWeek } from '@/lib/dates';
import { sessionLocalDate, weekProgress } from '@/lib/sessions';

import { formMetrics } from '../log/metric-form';
import { FELT_LABEL, loggedExercises, metricText } from './workout-text';

type Line = { key: string; title: string; detail?: string; value?: string };

function linesOf(log: ActivityLog, sport: SportDefinition | null): Line[] {
  const lines: Line[] = [];
  if (sport && sport.is_gym === 0) {
    for (const m of formMetrics(sport)) {
      const v = log.metrics[m.key];
      if (v !== undefined) lines.push({ key: m.key, title: m.description, value: metricText(m, v) });
    }
  }
  if (!lines.length) lines.push({ key: 'time', title: 'Time', value: formatMinutes(log.duration_seconds / 60) });
  for (const ex of loggedExercises(log.sets)) lines.push({ key: `ex-${ex.key}`, title: ex.name, detail: ex.detail });
  if (log.feedback) lines.push({ key: 'felt', title: 'How it felt', value: FELT_LABEL[log.feedback.felt] });
  return lines;
}

/** A done session shows what was logged instead of Log it, with the week's "2 of 3". */
export function LoggedCard({
  session,
  sport,
  log,
  loading,
  failed,
  onRetry,
}: {
  session: PlannedSession;
  sport: SportDefinition | null;
  log: ActivityLog | undefined;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
}) {
  const week = useWeek(startOfWeek(sessionLocalDate(session)));
  const progress = week.data ? weekProgress(week.data) : null;

  return (
    <Col gap={8}>
      <View style={styles.head}>
        <Section>What you did</Section>
        {progress && progress.total > 0 ? (
          <Text variant="label" tone="tertiary" tabular>
            {`${progress.done} of ${progress.total} this week`}
          </Text>
        ) : null}
      </View>
      {failed ? (
        <Card variant="sunken">
          <Col gap={12}>
            <Text variant="bodySm" accessibilityRole="alert">
              We couldn&apos;t load what you logged.
            </Text>
            <Button variant="secondary" size="sm" icon="refresh-cw" onPress={onRetry} style={{ alignSelf: 'flex-start' }}>
              Try again
            </Button>
          </Col>
        </Card>
      ) : loading || !log ? (
        <Skeleton height={120} radius={24} />
      ) : (
        <Card padding={0} style={styles.card}>
          {linesOf(log, sport).map((line, i) => (
            <ListRow key={line.key} title={line.title} detail={line.detail} value={line.value} divider={i > 0} />
          ))}
          {log.file_name ? (
            <Text variant="caption" style={styles.file}>
              {`From ${log.file_name}`}
            </Text>
          ) : null}
        </Card>
      )}
    </Col>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  card: { paddingHorizontal: 16, paddingVertical: 4 },
  file: { paddingBottom: 12 },
});
