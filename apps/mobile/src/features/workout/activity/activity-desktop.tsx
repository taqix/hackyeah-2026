import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { type ActivityLog, isGymSession, type PlannedSession, type SportDefinition } from '@/api/types';
import { Col, Content, Section } from '@/components/layout';
import {
  Badge,
  Button,
  Card,
  Disc,
  ExerciseMedia,
  Icon,
  type IconName,
  IconButton,
  SuggestionCard,
  type SuggestionTone,
  suggestionInk,
  Text,
} from '@/components/ui';
import { useNow } from '@/lib/clock';
import {
  diffDays,
  formatDateShort,
  formatDayDate,
  formatDayLong,
  formatLongDate,
  formatMinutes,
  formatTime,
  toLocalDate,
} from '@/lib/dates';
import { type SessionDayState, sessionDayState, sessionMinutes, sessionStart } from '@/lib/sessions';
import { sportIcon, sportName } from '@/lib/sport-visuals';
import { useOpenChat } from '@/navigation/open-chat';
import { routes } from '@/navigation/routes';
import { useTheme } from '@/theme';

import { BackRow, Reveal, SideAction, SplitColumns, useSplit } from '../desktop';
import { dayLabel, Note } from './activity-parts';
import { LoggedCard } from './logged-card';
import { coachTip, exerciseDetail, exerciseIcon } from './workout-text';

/** Page width: the shell's default content width. */
const MAX_WIDTH = 1160;

const HERO_TONE: Record<SessionDayState, SuggestionTone> = {
  today: 'dusk',
  planned: 'dawn',
  unlogged: 'dawn',
  done: 'sage',
  skipped: 'sage',
};

export type LogRead = {
  data: ActivityLog | undefined;
  isPending: boolean;
  isError: boolean;
  refetch: () => void;
};

export type ActivityDesktopProps = {
  session: PlannedSession;
  sport: SportDefinition | null;
  /** The session's log once it is done. */
  log: LogRead;
  /** What the More sheet just changed, announced under the hero. */
  switchedNotice: string | null;
  onMore: () => void;
};

/** "walk-run intervals", for use mid-sentence. */
function inSentence(title: string): string {
  return title.charAt(0).toLowerCase() + title.slice(1);
}

/** The chat request behind Skip it, worded for the session's day. */
function skipRequest(session: PlannedSession, today: Date): string {
  const start = sessionStart(session);
  const what = inSentence(session.title);
  const days = diffDays(toLocalDate(today), toLocalDate(start));
  if (days === 0) return `I'd like to skip today's ${what}.`;
  if (days === 1) return `I'd like to skip tomorrow's ${what}.`;
  if (Math.abs(days) < 7) return `I'd like to skip ${formatDayLong(start)}'s ${what}.`;
  return `I'd like to skip the ${what} on ${formatDayDate(start)}.`;
}

/** 'Today · 4 Oct', 'Friday · 9 Oct', or 'Fri 18 Sep' when the label is already a date. */
function heroKicker(start: Date, today: Date): string {
  const day = dayLabel(start, today);
  return day === formatDayDate(start) ? day : `${day} · ${formatDateShort(start)}`;
}

function Fact({ icon, label, strong = false }: { icon: IconName; label: string; strong?: boolean }) {
  const { fontFamily } = useTheme();
  return (
    <View style={[styles.fact, { backgroundColor: strong ? 'rgba(251,248,242,0.28)' : 'rgba(251,248,242,0.16)' }]}>
      <Icon name={icon} size={16} color={suggestionInk.text} strokeWidth={strong ? 2.25 : 1.75} />
      <Text tabular style={{ fontFamily: fontFamily.bodySemibold, fontSize: 14, lineHeight: 18, color: suggestionInk.text }}>
        {label}
      </Text>
    </View>
  );
}

/** The photo hero of the session: day, title, the plan's description and its facts. */
function SessionHero({ session, sport, state, today }: { session: PlannedSession; sport: SportDefinition | null; state: SessionDayState; today: Date }) {
  const start = sessionStart(session);
  return (
    <SuggestionCard
      tone={HERO_TONE[state]}
      size="lg"
      kicker={heroKicker(start, today)}
      title={session.title}
      body={session.description || undefined}>
      <View style={styles.facts}>
        {session.optional ? <Fact icon="sprout" label="Optional" strong /> : null}
        <Fact icon={sportIcon(session.sport_id)} label={sportName(sport ? [sport] : null, session.sport_id)} />
        <Fact icon="clock" label={formatTime(start)} />
        <Fact icon="timer" label={formatMinutes(sessionMinutes(session))} />
      </View>
    </SuggestionCard>
  );
}

/** The sport's coach tip as a quiet card beside the photo hero. */
function CoachNotes({ sportId }: { sportId: string }) {
  const tip = coachTip(sportId);
  return (
    <Card style={styles.coach}>
      <Disc icon="message-circle" tone="accent" size={44} />
      <Col gap={4} style={styles.fill}>
        <Text variant="label" tone="accent">
          Coach tip
        </Text>
        <Text variant="subheading">{tip.title}</Text>
        <Text tone="secondary">{tip.body}</Text>
      </Col>
    </Card>
  );
}

type PlanItem = { key: string; icon: IconName; name: string; detail?: string; description?: string };

/** The plan's parts, or each gym exercise with how it is done written out. */
function PlanSection({ session, sport, state }: { session: PlannedSession; sport: SportDefinition | null; state: SessionDayState }) {
  const { colors, fontFamily } = useTheme();
  const gym = isGymSession(session);
  const items: PlanItem[] = gym
    ? session.exercises.map((ex, i) => ({
        key: `${ex.exercise_id ?? ex.name}-${i}`,
        icon: exerciseIcon(ex, sport),
        name: ex.name,
        detail: exerciseDetail(ex, sport),
        description: ex.description || undefined,
      }))
    : session.parts.map((part, i) => ({ key: String(i), icon: sportIcon(session.sport_id), name: part.description }));
  const open = state !== 'done' && state !== 'skipped';

  return (
    <Col gap={12}>
      <Section>The plan</Section>
      <Card padding={0} style={styles.planCard}>
        {items.map((item, i) => (
          <View
            key={item.key}
            style={[styles.planItem, i > 0 ? { borderTopWidth: 1, borderTopColor: colors.borderSubtle } : null]}>
            <ExerciseMedia icon={item.icon} size={64} />
            <View style={styles.planText}>
              <Text style={{ fontFamily: fontFamily.bodySemibold, fontSize: 17, lineHeight: 23 }}>{item.name}</Text>
              {item.detail ? (
                <Text variant="bodySm" tabular>
                  {item.detail}
                </Text>
              ) : null}
              {item.description ? (
                <Text variant="bodySm" tone="tertiary" style={styles.planDescription}>
                  {item.description}
                </Text>
              ) : null}
            </View>
          </View>
        ))}
      </Card>
      {open && gym ? <Note icon="info">We walk you through it, one exercise at a time.</Note> : null}
      {open && !gym ? <Note icon="watch">Go with a watch, a timer or nothing at all. Log it when you&apos;re back.</Note> : null}
    </Col>
  );
}

/** The person's own note from the feedback, under what they logged. */
function FeedbackNote({ note }: { note: string }) {
  const { fontFamily } = useTheme();
  return (
    <Card variant="sunken" padding={16}>
      <Col gap={6}>
        <Text variant="caption">Your note</Text>
        <Text variant="bodySm" tone="secondary" style={{ fontFamily: fontFamily.bodyItalic }}>
          {note}
        </Text>
      </Col>
    </Card>
  );
}

/**
 * Activity (6) on the desktop web: the photo hero, coach notes and the plan in
 * the main column; status and every action in a side column that stays in view.
 */
export function ActivityDesktop({ session, sport, log, switchedNotice, onMore }: ActivityDesktopProps) {
  const router = useRouter();
  const openChat = useOpenChat();
  const today = useNow();
  const { colors } = useTheme();
  const page = useSplit(MAX_WIDTH);

  const state = sessionDayState(session, today);
  const gym = isGymSession(session);
  const start = sessionStart(session);
  const done = state === 'done';
  const skipped = state === 'skipped';
  const saved = log.data;
  // A saved session's time, metrics and sets are final; only a log not saved yet can be edited.
  const editable = !!saved && !saved.actuals_locked;

  const ask = () => openChat({ aboutSessionId: session.id });
  const edit = () =>
    session.log_id && router.push(gym ? routes.gymReview(session.id, session.log_id) : routes.log(session.id, session.log_id));
  const feedback = () => session.log_id && router.push(routes.feedback(session.log_id));

  // A relative day ('Today', 'Tomorrow', 'Friday') says more than the date line under it.
  const day = dayLabel(start, today);
  const status = done ? (
    <Badge tone="success" icon="check">
      Done
    </Badge>
  ) : skipped ? (
    <Badge>Skipped</Badge>
  ) : state === 'unlogged' ? (
    <Badge tone="warm">Not logged</Badge>
  ) : day !== formatDayDate(start) ? (
    <Badge tone="accent">{day}</Badge>
  ) : null;

  const actions = (
    <Card padding={24}>
      <Col gap={16}>
        <Col gap={10}>
          {status}
          <Col gap={2}>
            <Text variant="subheading">{formatLongDate(start)}</Text>
            <Text variant="bodySm" tabular>
              {`${formatTime(start)} · ${formatMinutes(sessionMinutes(session))}`}
            </Text>
          </Col>
        </Col>

        {done ? (
          <Col gap={10}>
            {saved && !saved.feedback ? (
              <Button size="lg" fullWidth iconRight="arrow-right" onPress={feedback}>
                How did it feel?
              </Button>
            ) : null}
            {editable ? (
              <Button variant="secondary" size="lg" fullWidth icon="pencil" onPress={edit}>
                Edit
              </Button>
            ) : null}
            {saved?.feedback && !editable ? (
              <Button variant="secondary" size="lg" fullWidth icon="pencil" onPress={feedback}>
                Change how it felt
              </Button>
            ) : null}
          </Col>
        ) : skipped ? (
          <Col gap={12}>
            <Note icon="info">Skipped this time. Nothing to make up.</Note>
            <Button variant="secondary" size="lg" icon="message-circle" fullWidth onPress={ask}>
              Ask in chat
            </Button>
          </Col>
        ) : (
          <Col gap={12}>
            {state === 'unlogged' ? (
              <Text variant="bodySm">Not logged. If you went, log it. If not, move it to a day that suits you.</Text>
            ) : null}
            {gym ? (
              <Button size="lg" fullWidth iconRight="play" onPress={() => router.push(routes.gym(session.id))}>
                Start
              </Button>
            ) : (
              <Button size="lg" fullWidth iconRight="check" onPress={() => router.push(routes.log(session.id))}>
                Log it
              </Button>
            )}
          </Col>
        )}

        {skipped ? null : (
          <View style={[styles.actionList, { borderTopColor: colors.borderSubtle }]}>
            {done ? null : (
              <>
                <SideAction
                  icon="calendar-arrow-up"
                  title="Move it"
                  detail="To a day that suits you."
                  accessibilityHint="Opens chat, which offers free times"
                  onPress={() => openChat({ aboutSessionId: session.id, intent: 'move' })}
                />
                <SideAction
                  icon="moon"
                  title="Skip it"
                  detail="Nothing to make up."
                  accessibilityHint="Opens chat with this request filled in"
                  onPress={() => openChat({ prefill: skipRequest(session, today), aboutSessionId: session.id })}
                />
              </>
            )}
            <SideAction
              icon="message-circle"
              title="Ask your coach"
              detail={done ? 'About this session or the next ones.' : 'Make it simpler, shorter or different.'}
              accessibilityHint="Opens chat about this session"
              onPress={ask}
            />
          </View>
        )}
      </Col>
    </Card>
  );

  const summary =
    done && session.log_id ? (
      <Col gap={12}>
        <LoggedCard
          session={session}
          sport={sport}
          log={saved}
          loading={log.isPending}
          failed={log.isError}
          onRetry={log.refetch}
        />
        {saved?.feedback?.note ? <FeedbackNote note={saved.feedback.note} /> : null}
      </Col>
    ) : null;

  const hero = (
    <Reveal>
      <SessionHero session={session} sport={sport} state={state} today={today} />
    </Reveal>
  );
  const notice = switchedNotice ? (
    <View accessibilityRole="summary" accessibilityLiveRegion="polite">
      <Text variant="bodySm" tone="secondary">
        {switchedNotice}
      </Text>
    </View>
  ) : null;
  const coach = done || skipped ? null : (
    <Reveal index={1}>
      <CoachNotes sportId={session.sport_id} />
    </Reveal>
  );
  const plan = (
    <Reveal index={2}>
      <PlanSection session={session} sport={sport} state={state} />
    </Reveal>
  );
  const side = (
    <Reveal index={1}>
      <Col gap={20}>
        {actions}
        {summary}
      </Col>
    </Reveal>
  );

  return (
    <Content gap={24} maxWidth={MAX_WIDTH} onLayout={page.onLayout}>
      <BackRow right={<IconButton icon="ellipsis" accessibilityLabel="More" onPress={onMore} />} />
      {page.split ? (
        <SplitColumns
          sideWidth={page.sideWidth}
          main={
            <Col gap={24}>
              {hero}
              {notice}
              {coach}
              {plan}
            </Col>
          }
          side={side}
        />
      ) : (
        <>
          {hero}
          {notice}
          {side}
          {coach}
          {plan}
        </>
      )}
    </Content>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, minWidth: 0 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  fact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  coach: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  planCard: { paddingHorizontal: 24, paddingVertical: 4 },
  planItem: { flexDirection: 'row', alignItems: 'center', gap: 18, paddingVertical: 16 },
  planText: { flex: 1, minWidth: 0, gap: 4 },
  planDescription: { maxWidth: 560 },
  actionList: { borderTopWidth: 1, paddingTop: 12, marginHorizontal: -10, gap: 2 },
});
