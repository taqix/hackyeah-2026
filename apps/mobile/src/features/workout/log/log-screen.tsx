import { Redirect } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useLog, usePlannedSession, useSports } from '@/api/hooks';
import type { SportDefinition } from '@/api/types';
import { Col, Section } from '@/components/layout';
import { Tag, Text } from '@/components/ui';
import { now } from '@/lib/clock';
import { type DateLike, diffDays, formatDayDate, formatDayLong, toLocalDate } from '@/lib/dates';
import { sessionStart } from '@/lib/sessions';
import { sportIcon } from '@/lib/sport-visuals';
import { routes } from '@/navigation/routes';

import { WorkoutError, WorkoutLoading } from '../screen-state';
import { LogForm } from './log-form';

/** 'Wednesday' within a week of today, 'Wed 7 Oct' further away. */
function dayName(value: DateLike): string {
  return Math.abs(diffDays(toLocalDate(now()), toLocalDate(value))) < 7 ? formatDayLong(value) : formatDayDate(value);
}

/** "walk-run intervals" in a kicker after the day. */
function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/** A workout outside the plan: which sport, before its fields. Gym sessions are tracked live instead. */
function SportChoice({
  sports,
  value,
  onChange,
}: {
  sports: SportDefinition[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  const choices = sports.filter((s) => s.availability === 'working' && s.is_gym === 0);
  return (
    <Col gap={12}>
      <Section>What did you do?</Section>
      <View accessibilityRole="radiogroup" accessibilityLabel="What did you do?" style={styles.chips}>
        {choices.map((s) => (
          <Tag key={s.id} label={s.name} icon={sportIcon(s.id)} selected={value === s.id} onPress={() => onChange(s.id)} />
        ))}
      </View>
      <Text variant="caption">It goes into your history. Your plan stays as it is.</Text>
    </Col>
  );
}

/**
 * Route body for log/[sessionId]: a planned session (`sessionId`), a workout
 * outside the plan (`new`), or a saved log to change (`logId`, or the
 * session's own log once it is done).
 */
export function LogScreen({ sessionId, logId }: { sessionId: string; logId?: string }) {
  const isNew = sessionId === 'new';
  const sessionQuery = usePlannedSession(isNew ? null : sessionId);
  const editLogId = logId ?? sessionQuery.data?.log_id ?? null;
  const logQuery = useLog(editLogId);
  const sportsQuery = useSports();
  const [picked, setPicked] = useState<string | null>(null);

  const failed = [sportsQuery, ...(isNew ? [] : [sessionQuery]), ...(editLogId ? [logQuery] : [])].find(
    (q) => q.isError,
  );
  if (failed) {
    return (
      <WorkoutError
        error={failed.error}
        onRetry={() => {
          if (sportsQuery.isError) void sportsQuery.refetch();
          if (sessionQuery.isError) void sessionQuery.refetch();
          if (logQuery.isError) void logQuery.refetch();
        }}
      />
    );
  }
  const sports = sportsQuery.data;
  if (!sports || (!isNew && sessionQuery.isPending) || (editLogId && logQuery.isPending)) {
    return <WorkoutLoading />;
  }

  const session = sessionQuery.data ?? null;
  const log = logQuery.data ?? null;
  // A saved session's actuals are final; its own screen shows them instead.
  if (log?.actuals_locked) return <Redirect href={routes.session(log.session_id ?? sessionId)} />;
  const sportId = log?.sport_id ?? session?.sport_id ?? picked;
  const sport = sports.find((s) => s.id === sportId) ?? null;
  const choosing = isNew && !log;

  const kicker = log
    ? `${dayName(log.started_at)} · ${lowerFirst(log.title)}`
    : session
      ? `${dayName(sessionStart(session))} · ${lowerFirst(session.title)}`
      : sport
        ? `${formatDayLong(now())} · ${sport.name.toLowerCase()}`
        : formatDayLong(now());

  return (
    <LogForm
      // A new sport means new fields: start the form again.
      key={sportId ?? 'none'}
      kicker={kicker}
      session={session}
      log={log}
      sport={sport}
      header={choosing ? <SportChoice sports={sports} value={picked} onChange={setPicked} /> : null}
    />
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
