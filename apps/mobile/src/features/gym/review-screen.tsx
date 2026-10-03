import { useRouter } from 'expo-router';
import { useState } from 'react';

import { useLog, usePlannedSession, useSport } from '@/api/hooks';
import { type ActivityLog, isGymSession, type LoggedSet, type PlannedSession, type SportDefinition } from '@/api/types';
import { Button, Card, Icon, IconButton, ListRow } from '@/components/ui';
import { Body, BottomBar, Col, Content, H1, Kicker, Screen, TopBar } from '@/components/layout';
import { formatDayLong, formatMinutes } from '@/lib/dates';
import { routes } from '@/navigation/routes';
import { useTheme } from '@/theme';

import { FixSetsSheet, type FixTarget } from './fix-sets-sheet';
import { doneSummary } from './format';
import { buildSteps, type GymStep, setsFor } from './model';
import { GymError, GymLoading } from './screen-states';

const KIND_ICON = { reps: 'dumbbell', time: 'timer' } as const;

/** A step for a logged exercise the plan doesn't list. */
function stepFromSets(sets: LoggedSet[]): GymStep {
  const first = sets[0];
  const time = first.seconds != null;
  return {
    name: first.exercise_name,
    exerciseId: first.exercise_id,
    description: '',
    tracking: time ? 'time' : 'reps',
    perSide: false,
    usesWeight: sets.some((s) => s.weight_kg != null),
    weightStep: 1,
    restSeconds: 0,
    sets: sets.length,
    reps: first.reps ?? 1,
    holdSeconds: first.seconds ?? 30,
  };
}

/** Every planned exercise in plan order, then anything logged outside it, with its sets as done. */
function reviewRows(log: ActivityLog, session: PlannedSession | undefined, sport: SportDefinition | null | undefined): FixTarget[] {
  const planned = session && isGymSession(session) ? buildSteps(session, sport) : [];
  const rows = planned.map((step) => ({ step, sets: setsFor(step, log.sets) }));
  const covered = new Set(rows.flatMap((r) => r.sets));
  const rest = log.sets.filter((s) => !covered.has(s));
  const names = [...new Set(rest.map((s) => s.exercise_name))];
  for (const name of names) {
    const sets = rest.filter((s) => s.exercise_name === name).sort((a, b) => a.set_index - b.set_index);
    rows.push({ step: stepFromSets(sets), sets });
  }
  return rows;
}

/** 6.8 What you did: the sets as logged. No plan-versus-actual comparison. */
export function GymReviewScreen({ sessionId, logId }: { sessionId: string; logId: string }) {
  const router = useRouter();
  const { colors } = useTheme();
  const logQuery = useLog(logId);
  const sessionQuery = usePlannedSession(sessionId);
  const sportQuery = useSport(logQuery.data?.sport_id);
  const [fixing, setFixing] = useState<number | null>(null);

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace(routes.today());
  };

  if (logQuery.isError) {
    return <GymError title="We couldn't load what you did" onRetry={() => void logQuery.refetch()} onClose={close} />;
  }
  const log = logQuery.data;
  // The plan only adds "Not today" rows, so a failed plan read still shows the log.
  const waitingForPlan = sessionQuery.isPending && sessionQuery.fetchStatus !== 'idle';
  if (!log || waitingForPlan || sportQuery.isPending) return <GymLoading onClose={close} />;

  const rows = reviewRows(log, sessionQuery.data, sportQuery.data);
  const minutes = Math.max(1, Math.round(log.duration_seconds / 60));

  return (
    <Screen>
      <TopBar right={<IconButton icon="x" accessibilityLabel="Close" onPress={close} />} />
      <Content gap={20} bottomInset="bottomBar">
        <Col gap={6}>
          <Kicker>{`${formatDayLong(log.started_at)} · ${formatMinutes(minutes)}`}</Kicker>
          <H1>Done for today.</H1>
          <Body>Here&apos;s what you logged. Tap a line to fix it.</Body>
        </Col>
        <Card padding={0} style={{ paddingHorizontal: 16, paddingVertical: 4 }}>
          {rows.map((row, i) => {
            const done = row.sets.length > 0;
            const detail = doneSummary(row.step, row.sets);
            return (
              <ListRow
                key={`${row.step.name}-${i}`}
                title={row.step.name}
                detail={detail}
                icon={KIND_ICON[row.step.tracking]}
                discTone="quiet"
                discSize={36}
                divider={i > 0}
                disabled={!done}
                chevron={false}
                right={done ? <Icon name="check" size={18} strokeWidth={2.25} color={colors.success} /> : undefined}
                onPress={done ? () => setFixing(i) : undefined}
                accessibilityLabel={`${row.step.name}, ${detail}`}
                accessibilityHint={done ? 'Opens the sets to fix a number' : undefined}
                style={{ minHeight: 64 }}
              />
            );
          })}
        </Card>
      </Content>
      <BottomBar>
        <Button size="lg" fullWidth iconRight="arrow-right" onPress={() => router.replace(routes.feedback(log.id))}>
          Continue
        </Button>
      </BottomBar>
      <FixSetsSheet log={log} target={fixing === null ? null : (rows[fixing] ?? null)} onClose={() => setFixing(null)} />
    </Screen>
  );
}
