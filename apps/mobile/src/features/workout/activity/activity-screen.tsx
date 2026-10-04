import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useLog, usePlannedSession, useSport } from '@/api/hooks';
import { type GymExercise, isGymSession, type PlannedSession, type SportDefinition } from '@/api/types';
import { BackButton, Body, BottomBar, Col, Content, H1, Kicker, Row, Screen, Section, TopBar } from '@/components/layout';
import { Badge, Button, ExerciseRow, Icon, IconButton, Sheet, SuggestionCard, Text } from '@/components/ui';
import { useNow } from '@/lib/clock';
import { diffDays, formatDayDate, relativeDayName, toLocalDate } from '@/lib/dates';
import { sessionStart, sessionTimeLabel } from '@/lib/sessions';
import { sportIcon, sportName } from '@/lib/sport-visuals';
import { useOpenChat } from '@/navigation/open-chat';
import { routes } from '@/navigation/routes';
import { useTheme } from '@/theme';

import { WorkoutError, WorkoutLoading } from '../screen-state';
import { LoggedCard } from './logged-card';
import { MoreSheet } from './more-sheet';
import { coachTip, exerciseDetail, exerciseIcon } from './workout-text';

/** 'Today', 'Tomorrow', 'Friday' within the week around today; 'Fri 18 Sep' further away. */
function dayLabel(start: Date, today: Date): string {
  const days = diffDays(toLocalDate(today), toLocalDate(start));
  return Math.abs(days) < 7 ? relativeDayName(start, today) : formatDayDate(start);
}

/** A small line with an icon under the plan: the watch note, or how the gym rows work. */
function Note({ icon, children }: { icon: 'watch' | 'info'; children: string }) {
  const { colors } = useTheme();
  return (
    <Row gap={10} style={styles.note}>
      <View style={styles.noteIcon}>
        <Icon name={icon} size={16} color={colors.textSecondary} />
      </View>
      <Text variant="bodySm" style={styles.noteText}>
        {children}
      </Text>
    </Row>
  );
}

/** What the session holds: the plan's parts, or the gym exercises (a tap shows how each is done). */
function PlanList({
  session,
  sport,
  onExercise,
}: {
  session: PlannedSession;
  sport: SportDefinition | null;
  onExercise: (exercise: GymExercise) => void;
}) {
  if (isGymSession(session)) {
    return (
      <>
        {session.exercises.map((ex, i) => (
          <ExerciseRow
            key={`${ex.exercise_id ?? ex.name}-${i}`}
            media
            mediaIcon={exerciseIcon(ex, sport)}
            name={ex.name}
            detail={exerciseDetail(ex, sport)}
            onPress={() => onExercise(ex)}
            divider={i < session.exercises.length - 1}
          />
        ))}
      </>
    );
  }
  return (
    <>
      {session.parts.map((part, i) => (
        <ExerciseRow
          key={i}
          media
          mediaIcon={sportIcon(session.sport_id)}
          name={part.description}
          divider={i < session.parts.length - 1}
        />
      ))}
    </>
  );
}

function ActivityBody({ session, sport }: { session: PlannedSession; sport: SportDefinition | null }) {
  const router = useRouter();
  const openChat = useOpenChat();
  const today = useNow();
  const logQuery = useLog(session.log_id);
  const [moreOpen, setMoreOpen] = useState(false);
  // Kept after closing so the sheet keeps its text while it slides away.
  const [exercise, setExercise] = useState<GymExercise | null>(null);
  const [exerciseOpen, setExerciseOpen] = useState(false);
  const [switched, setSwitched] = useState<boolean | null>(null);

  const gym = isGymSession(session);
  const done = session.status === 'completed';
  const log = logQuery.data;
  // A saved session's time, metrics and sets are final; only a log not saved yet can be edited.
  const editable = !!log && !log.actuals_locked;
  const skipped = session.status === 'skipped';
  const label = sportName(sport ? [sport] : null, session.sport_id).toLowerCase();
  const day = dayLabel(sessionStart(session), today);
  const tip = coachTip(session.sport_id);
  const adjust = () => openChat({ aboutSessionId: session.id });

  return (
    <Screen>
      <TopBar
        left={<BackButton />}
        right={<IconButton icon="ellipsis" accessibilityLabel="More" onPress={() => setMoreOpen(true)} />}
      />
      <Content gap={16} bottomInset="bottomBar">
        <Col gap={6}>
          <Kicker>{`${day} · ${sessionTimeLabel(session)}`}</Kicker>
          <H1>{session.title}</H1>
          {session.optional || done || skipped ? (
            <Row gap={8} style={styles.badges}>
              {done ? <Badge tone="success" icon="check">Done</Badge> : null}
              {skipped ? <Badge>Skipped</Badge> : null}
              {session.optional ? <Badge tone="info">Optional</Badge> : null}
            </Row>
          ) : null}
        </Col>
        {session.description ? <Body>{session.description}</Body> : null}

        {switched !== null ? (
          <View accessibilityRole="summary" accessibilityLiveRegion="polite">
            <Text variant="bodySm" tone="secondary">
              {switched
                ? `${sportName(sport ? [sport] : null, session.sport_id)} is switched off. Future plans leave it out.`
                : `${sportName(sport ? [sport] : null, session.sport_id)} is back on. Future plans can include it.`}
            </Text>
          </View>
        ) : null}

        {done && session.log_id ? (
          <LoggedCard
            session={session}
            sport={sport}
            log={logQuery.data}
            loading={logQuery.isPending}
            failed={logQuery.isError}
            onRetry={() => void logQuery.refetch()}
          />
        ) : null}

        {!done && !skipped ? <SuggestionCard tone="dusk" kicker="Coach tip" title={tip.title} body={tip.body} /> : null}

        <Col gap={0}>
          <Section>{done ? 'The plan' : day}</Section>
          <PlanList
            session={session}
            sport={sport}
            onExercise={(ex) => {
              setExercise(ex);
              setExerciseOpen(true);
            }}
          />
        </Col>

        {done || skipped ? null : gym ? (
          <Note icon="info">We walk you through it, one exercise at a time. Tap one to see how it&apos;s done.</Note>
        ) : (
          <Note icon="watch">Go with a watch, a timer or nothing at all. Log it when you&apos;re back.</Note>
        )}
        {skipped ? <Note icon="info">Skipped this time. Nothing to make up.</Note> : null}
      </Content>

      <BottomBar>
        {done ? (
          <>
            {editable ? (
              <Button
                variant="secondary"
                size="lg"
                icon="pencil"
                onPress={() =>
                  session.log_id &&
                  router.push(gym ? routes.gymReview(session.id, session.log_id) : routes.log(session.id, session.log_id))
                }
                style={log?.feedback ? styles.grow : undefined}
                fullWidth={!!log?.feedback}>
                Edit
              </Button>
            ) : null}
            {log && !log.feedback ? (
              <Button
                size="lg"
                iconRight="arrow-right"
                onPress={() => session.log_id && router.push(routes.feedback(session.log_id))}
                style={styles.grow}>
                How did it feel?
              </Button>
            ) : null}
            {log?.feedback && !editable ? (
              <Button
                variant="secondary"
                size="lg"
                icon="pencil"
                fullWidth
                onPress={() => session.log_id && router.push(routes.feedback(session.log_id))}>
                Change how it felt
              </Button>
            ) : null}
          </>
        ) : skipped ? (
          <Button variant="secondary" size="lg" icon="message-circle" fullWidth onPress={adjust}>
            Ask in chat
          </Button>
        ) : (
          <>
            <Button variant="secondary" size="lg" onPress={adjust}>
              Adjust
            </Button>
            {gym ? (
              <Button size="lg" iconRight="play" onPress={() => router.push(routes.gym(session.id))} style={styles.grow}>
                Start
              </Button>
            ) : (
              <Button size="lg" iconRight="check" onPress={() => router.push(routes.log(session.id))} style={styles.grow}>
                Log it
              </Button>
            )}
          </>
        )}
      </BottomBar>

      <MoreSheet
        visible={moreOpen}
        onClose={() => setMoreOpen(false)}
        title={session.title}
        sportId={session.sport_id}
        sportLabel={label}
        onChanged={setSwitched}
      />
      <Sheet
        visible={exerciseOpen}
        onClose={() => setExerciseOpen(false)}
        title={exercise?.name}
        description={exercise ? exerciseDetail(exercise, sport) : undefined}
        showClose>
        {exercise?.description ? <Body>{exercise.description}</Body> : null}
      </Sheet>
    </Screen>
  );
}

/** Activity (6): what the session holds, from the plan, with Log it, or Start for the gym. */
export function ActivityScreen({ id }: { id: string }) {
  const sessionQuery = usePlannedSession(id);
  const sportQuery = useSport(sessionQuery.data?.sport_id);

  if (sessionQuery.isError) {
    return <WorkoutError error={sessionQuery.error} onRetry={() => void sessionQuery.refetch()} />;
  }
  if (sessionQuery.isPending || sportQuery.isPending) return <WorkoutLoading />;
  // A missing catalog row still shows the session; the sport name falls back to its ID.
  return <ActivityBody session={sessionQuery.data} sport={sportQuery.data ?? null} />;
}

const styles = StyleSheet.create({
  badges: { marginTop: 4, flexWrap: 'wrap' },
  note: { alignItems: 'flex-start' },
  noteIcon: { marginTop: 2 },
  noteText: { flex: 1 },
  grow: { flex: 1 },
});
