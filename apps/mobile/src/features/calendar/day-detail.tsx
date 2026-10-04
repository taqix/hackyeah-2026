import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';

import type { ActivityLog, LocalDate } from '@/api/types';
import { Button, Card, Disc, Skeleton, Text } from '@/components/ui';
import { diffDays, formatLongDate, relativeDayName } from '@/lib/dates';
import { sportIcon } from '@/lib/sport-visuals';
import { useOpenChat } from '@/navigation/open-chat';
import { routes } from '@/navigation/routes';
import { useTheme } from '@/theme';

import { FreeDay } from './agenda';
import { planWeek } from './calendar-labels';
import { type DayItem, markState } from './day-items';
import { extraFacts, factsLine, useSessionFacts } from './session-facts';
import { SessionLine } from './session-line';

const FADE_UP = {
  from: { opacity: 0, transform: [{ translateY: 6 }] },
  to: { opacity: 1, transform: [{ translateY: 0 }] },
};

type DayDetailProps = {
  date: LocalDate;
  /** The day's sessions and extras; undefined while they load. */
  items: DayItem[] | undefined;
  today: LocalDate;
  firstWeekStart: LocalDate;
  plannedThrough: LocalDate;
};

/**
 * The selected day beside the desktop month: each session with its time,
 * length and outcome, opening its page; an upcoming or unlogged one can go to
 * the coach to be moved. A free day points to the next session.
 */
export function DayDetail({ date, items, today, firstWeekStart, plannedThrough }: DayDetailProps) {
  const { motion } = useTheme();
  const reduced = useReducedMotion();
  const week = planWeek(date, firstWeekStart);
  const near = Math.abs(diffDays(today, date)) <= 1 ? relativeDayName(date, today) : null;
  const kicker = [near, week ? `Week ${week}` : null].filter(Boolean).join(' · ');

  return (
    <Card padding={0} style={styles.card}>
      <Animated.View
        key={date}
        style={[
          styles.body,
          reduced
            ? null
            : {
                animationName: FADE_UP,
                animationDuration: motion.durBase,
                animationTimingFunction: cubicBezier(...motion.easeOut),
              },
        ]}>
        <View style={styles.head}>
          {kicker ? (
            <Text variant="label" tone="tertiary">
              {kicker}
            </Text>
          ) : null}
          <Text variant="heading" accessibilityRole="header">
            {formatLongDate(date)}
          </Text>
        </View>
        {!items ? (
          <View style={styles.loading}>
            <Skeleton width={40} height={40} radius={20} />
            <View style={styles.grow}>
              <Skeleton width="60%" height={14} />
              <Skeleton width="36%" height={10} />
            </View>
          </View>
        ) : items.length ? (
          <View>
            {items.map((item, i) =>
              item.kind === 'session' ? (
                <SessionEntry key={item.key} item={item} today={today} divider={i > 0} />
              ) : (
                <ExtraEntry key={item.key} log={item.log} divider={i > 0} />
              ),
            )}
          </View>
        ) : (
          <View style={styles.free}>
            <Disc icon={date > plannedThrough ? 'calendar-clock' : 'calendar-days'} tone="quiet" size={40} />
            <View style={styles.grow}>
              <FreeDay date={date} firstWeekStart={firstWeekStart} plannedThrough={plannedThrough} />
            </View>
          </View>
        )}
      </Animated.View>
    </Card>
  );
}

type SessionItem = Extract<DayItem, { kind: 'session' }>;

function SessionEntry({ item, today, divider }: { item: SessionItem; today: LocalDate; divider: boolean }) {
  const router = useRouter();
  const openChat = useOpenChat();
  const { session } = item;
  const state = markState(item, today);
  const facts = useSessionFacts(session, state);
  // Done and skipped sessions are history; anything still ahead, or missed, can move.
  const movable = state === 'planned' || state === 'unlogged';
  return (
    <Entry divider={divider}>
      <SessionLine
        icon={sportIcon(session.sport_id)}
        title={session.title}
        tags={session.optional ? ['Optional'] : []}
        meta={factsLine(facts)}
        state={state}
        hint="Opens the session"
        onPress={() => router.push(routes.session(session.id))}
      />
      {movable ? (
        <Button
          variant="secondary"
          size="sm"
          icon="calendar-arrow-up"
          accessibilityHint={`Opens the coach about ${session.title}`}
          onPress={() => openChat({ aboutSessionId: session.id, intent: 'move' })}
          style={styles.move}>
          Ask coach to move it
        </Button>
      ) : null}
    </Entry>
  );
}

/** A workout added in chat: history, not the plan. Opens its log to edit. */
function ExtraEntry({ log, divider }: { log: ActivityLog; divider: boolean }) {
  const router = useRouter();
  return (
    <Entry divider={divider}>
      <SessionLine
        icon={sportIcon(log.sport_id)}
        title={log.title}
        tags={['Extra']}
        meta={factsLine(extraFacts(log))}
        state="done"
        hint="Opens the workout to edit"
        onPress={() => router.push(routes.log('new', log.id))}
      />
    </Entry>
  );
}

function Entry({ divider, children }: { divider: boolean; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.entry,
        divider && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderSubtle },
      ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { paddingTop: 20, paddingHorizontal: 20, paddingBottom: 12 },
  body: { gap: 12 },
  head: { gap: 2 },
  grow: { flex: 1, minWidth: 0, gap: 8 },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 },
  free: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingTop: 4 },
  entry: { paddingVertical: 6, gap: 8 },
  move: { alignSelf: 'flex-start', marginLeft: 54, marginBottom: 6 },
});
