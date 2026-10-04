import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useSessionsInRange } from '@/api/hooks';
import type { ActivityLog, LocalDate } from '@/api/types';
import { Col } from '@/components/layout';
import { Badge, Card, Icon, PressableScale, Skeleton, Text } from '@/components/ui';
import { addDays, formatDayDate, formatDayShort, formatLongDate, formatTime, fromLocalDate } from '@/lib/dates';
import { nextPlannedSession, sessionLocalDate, sessionStart, sessionTimeLabel } from '@/lib/sessions';
import { routes } from '@/navigation/routes';
import { useTheme } from '@/theme';

import { type DayItem, markState, type MarkState, stateWord } from './day-items';
import { dayOfMonth, isInMonth, monthOf } from './month';
import { extraFacts, lengthAndFelt, useSessionFacts } from './session-facts';

type AgendaProps = {
  date: LocalDate;
  /** The day's sessions and extras; undefined while they load. */
  items: DayItem[] | undefined;
  today: LocalDate;
  firstWeekStart: LocalDate;
  plannedThrough: LocalDate;
};

/** What the selected day holds. Sessions open the activity; a free day points to the next session. */
export function Agenda({ date, items, today, firstWeekStart, plannedThrough }: AgendaProps) {
  return (
    <Card padding={0} style={styles.card}>
      <Col gap={4}>
        <Text variant="subheading" accessibilityRole="header">
          {formatLongDate(date)}
          {date === today ? (
            <Text variant="caption" tone="secondary">
              {' · today'}
            </Text>
          ) : null}
        </Text>
        {!items ? (
          <Col gap={8} style={styles.free}>
            <Skeleton width="56%" height={14} />
            <Skeleton width="32%" height={10} />
          </Col>
        ) : items.length ? (
          items.map((item, i) =>
            item.kind === 'session' ? (
              <SessionLine key={item.key} item={item} today={today} divider={i > 0} />
            ) : (
              <ExtraLine key={item.key} log={item.log} divider={i > 0} />
            ),
          )
        ) : (
          <FreeDay date={date} firstWeekStart={firstWeekStart} plannedThrough={plannedThrough} />
        )}
      </Col>
    </Card>
  );
}

/** A day without sessions: not planned yet, before the plan, or a rest day with the next session. */
export function FreeDay({ date, firstWeekStart, plannedThrough }: Omit<AgendaProps, 'items' | 'today'>) {
  if (date > plannedThrough) {
    return (
      <Text variant="bodySm" style={styles.free}>
        Not planned yet. Plans go one week ahead.
      </Text>
    );
  }
  if (date < firstWeekStart) {
    return (
      <Text variant="bodySm" style={styles.free}>
        Before your first week.
      </Text>
    );
  }
  return (
    <Col gap={4} style={styles.free}>
      <Text variant="bodySm">Nothing planned. Rest is part of the plan, too.</Text>
      <NextSession after={date} plannedThrough={plannedThrough} />
    </Col>
  );
}

/** "Next · Fri 23 · 7:00 · Walk-run intervals", which may be in a later month. */
function NextSession({ after, plannedThrough }: { after: LocalDate; plannedThrough: LocalDate }) {
  const router = useRouter();
  const { colors } = useTheme();
  const from = addDays(after, 1);
  const range = useSessionsInRange(from <= plannedThrough ? from : null, plannedThrough);
  const next = range.data ? nextPlannedSession(range.data.sessions, fromLocalDate(from)) : null;
  if (!next) return null;

  const day = sessionLocalDate(next);
  const dayText = isInMonth(day, monthOf(after)) ? `${formatDayShort(day)} ${dayOfMonth(day)}` : formatDayDate(day);
  const time = formatTime(sessionStart(next));
  return (
    <PressableScale
      onPress={() => router.push(routes.session(next.id))}
      accessibilityRole="link"
      accessibilityLabel={`Next session: ${formatLongDate(day)} at ${time}, ${next.title}`}
      style={styles.next}>
      <Text variant="bodySm" tone="primary" tabular style={styles.nextText}>
        Next · {dayText} · {time} · {next.title}
      </Text>
      <Icon name="chevron-right" size={16} color={colors.textTertiary} />
    </PressableScale>
  );
}

type SessionItem = Extract<DayItem, { kind: 'session' }>;

function SessionLine({ item, today, divider }: { item: SessionItem; today: LocalDate; divider: boolean }) {
  const router = useRouter();
  const { session } = item;
  const state = markState(item, today);
  const facts = useSessionFacts(session, state);
  // Nothing was logged for planned and unlogged sessions, so they keep their planned time.
  const meta = state === 'planned' || state === 'unlogged' ? sessionTimeLabel(session) : lengthAndFelt(facts);
  return (
    <Line
      title={session.title}
      tags={session.optional ? ['Optional'] : []}
      meta={meta}
      state={state}
      divider={divider}
      hint="Opens the session"
      onPress={() => router.push(routes.session(session.id))}
    />
  );
}

/** A workout added in chat: history, not the plan. Opens its log to edit. */
function ExtraLine({ log, divider }: { log: ActivityLog; divider: boolean }) {
  const router = useRouter();
  const meta = lengthAndFelt(extraFacts(log));
  return (
    <Line
      title={log.title}
      tags={['Extra']}
      meta={meta}
      state="done"
      divider={divider}
      hint="Opens the workout to edit"
      onPress={() => router.push(routes.log('new', log.id))}
    />
  );
}

type LineProps = {
  title: string;
  tags: string[];
  meta: string;
  state: MarkState;
  divider: boolean;
  hint: string;
  onPress: () => void;
};

function Line({ title, tags, meta, state, divider, hint, onPress }: LineProps) {
  const { colors } = useTheme();
  const label = [title, ...tags, meta.split(' · ').join(', '), stateWord(state)].filter(Boolean).join(', ');
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.99}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      style={[styles.line, divider && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderSubtle }]}>
      <View style={styles.lineBody}>
        <View style={styles.titleRow}>
          <Text variant="bodyStrong" tone={state === 'planned' ? 'primary' : 'secondary'}>
            {title}
          </Text>
          {tags.map((tag) => (
            <Badge key={tag} style={styles.badge}>
              {tag}
            </Badge>
          ))}
        </View>
        <Text variant="caption" tone="secondary" tabular>
          {meta}
        </Text>
      </View>
      {state === 'done' ? (
        <Badge tone="success" dot style={styles.badge}>
          Done
        </Badge>
      ) : state === 'unlogged' ? (
        <Badge style={styles.badge}>Not logged</Badge>
      ) : state === 'skipped' ? (
        <Badge style={styles.badge}>Skipped</Badge>
      ) : (
        <Icon name="chevron-right" size={18} color={colors.textTertiary} />
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { paddingTop: 14, paddingHorizontal: 18, paddingBottom: 8 },
  free: { paddingTop: 6, paddingBottom: 8 },
  next: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, alignSelf: 'flex-start' },
  nextText: { flexShrink: 1 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 60, paddingVertical: 8 },
  lineBody: { flex: 1, minWidth: 0, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  badge: { alignSelf: 'center' },
});
