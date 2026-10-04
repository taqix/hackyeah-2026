/**
 * The dashboard's side column cards: why the plan looks as it does, quick
 * changes through chat, and next week once it is planned.
 */
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import type { LocalDate, PlannedSession, PlanWeek } from '@/api/types';
import { Section } from '@/components/layout';
import { Badge, Button, Card, Icon, PressableScale, Text, TextLink } from '@/components/ui';
import { formatDayShort, formatLongDate, formatTime, fromLocalDate } from '@/lib/dates';
import { sessionLocalDate, sessionStart, sessionTimeLabel, sortSessions } from '@/lib/sessions';
import { routes } from '@/navigation/routes';
import { useTheme } from '@/theme';

import { ChangePlan } from '../change-plan';
import { HoverTint } from './hover';

/** The answers the plan was built from, in one sentence, with the way to change them. */
export function WhyThisPlanCard({ answers, onReviewAnswers }: { answers: string; onReviewAnswers: () => void }) {
  const { colors } = useTheme();
  return (
    <Card variant="sunken" style={styles.card}>
      <View style={styles.kicker}>
        <Icon name="sprout" size={16} color={colors.recovery} />
        <Text variant="label" tone="secondary">
          Why this plan
        </Text>
      </View>
      <Text variant="bodySm">{`From your answers: ${answers}.`}</Text>
      <TextLink onPress={onReviewAnswers}>Review answers</TextLink>
    </Card>
  );
}

/** Need a change? The phone's two starter requests, and a way to ask anything else. */
export function ChangeCard({ onAskCoach }: { onAskCoach: () => void }) {
  return (
    <Card style={styles.card}>
      <ChangePlan style={styles.flush} />
      <TextLink onPress={onAskCoach} accessibilityHint="Opens chat">
        Something else? Ask in chat
      </TextLink>
    </Card>
  );
}

type NextWeekCardProps = {
  week: PlanWeek;
  onOpen: () => void;
};

/** 5.6: once next week is planned, its sessions one line each beside this week, and the way there. */
export function NextWeekCard({ week, onOpen }: NextWeekCardProps) {
  const sessions = sortSessions(week.sessions);
  const count = sessions.length;
  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <Section>Next week</Section>
        <Text variant="caption" tabular>
          {`${count} ${count === 1 ? 'session' : 'sessions'}`}
        </Text>
      </View>
      {week.summary ? <Text variant="bodySm">{week.summary}</Text> : null}
      <View style={styles.list}>
        {sessions.map((session) => (
          <NextRow key={session.id} session={session} />
        ))}
      </View>
      <Button variant="secondary" size="sm" iconRight="arrow-right" onPress={onOpen} style={styles.open}>
        See next week
      </Button>
    </Card>
  );
}

/** "Mon 5 · Easy walk · 7:00": opens the session. */
function NextRow({ session }: { session: PlannedSession }) {
  const router = useRouter();
  const { colors, motion } = useTheme();
  const date: LocalDate = sessionLocalDate(session);
  return (
    <PressableScale
      onPress={() => router.push(routes.session(session.id))}
      scaleTo={motion.pressScaleCard}
      accessibilityRole="button"
      accessibilityLabel={[
        formatLongDate(date),
        session.title,
        sessionTimeLabel(session),
        session.optional ? 'optional' : null,
      ]
        .filter(Boolean)
        .join(', ')}
      style={styles.row}>
      {({ hovered }) => (
        <>
          <HoverTint visible={hovered} />
          <Text variant="caption" tone="secondary" tabular style={styles.day}>
            {`${formatDayShort(date)} ${fromLocalDate(date).getDate()}`}
          </Text>
          <View style={styles.title}>
            <Text variant="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>
              {session.title}
            </Text>
            {session.optional ? <Badge>Optional</Badge> : null}
          </View>
          <Text variant="caption" tabular>
            {formatTime(sessionStart(session))}
          </Text>
          <Icon name="chevron-right" size={16} color={colors.textTertiary} />
        </>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10 },
  head: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  kicker: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flush: { marginTop: 0 },
  list: { marginHorizontal: -8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 40,
    paddingHorizontal: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  day: { width: 44 },
  title: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
  open: { alignSelf: 'flex-start', marginTop: 4 },
});
