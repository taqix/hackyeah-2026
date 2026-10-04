import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';

import type { LocalDate, PlannedSession, PlanVersion } from '@/api/types';
import { Badge, Button, Card, Disc, Divider, Icon, Skeleton, Text } from '@/components/ui';
import { formatDayDate } from '@/lib/dates';
import { sessionLocalDate } from '@/lib/sessions';
import { sportIcon } from '@/lib/sport-visuals';
import { routes } from '@/navigation/routes';
import { useTheme } from '@/theme';

import { sessionMarkState } from './day-items';
import { factsLine, useSessionFacts } from './session-facts';
import { SessionLine } from './session-line';
import { LoadError } from './states';
import type { VersionAction } from './use-version-action';
import { VERSION_SOURCES, versionWhen } from './version-source';

const FADE_UP = {
  from: { opacity: 0, transform: [{ translateY: 6 }] },
  to: { opacity: 1, transform: [{ translateY: 0 }] },
};

type VersionDetailProps = {
  version: PlanVersion;
  /** The sessions that belong to this version, by start; undefined while they load. */
  sessions: PlannedSession[] | undefined;
  sessionsError: boolean;
  onRetrySessions: () => void;
  retryingSessions: boolean;
  today: LocalDate;
  action: VersionAction | null;
};

/**
 * One version in full beside the timeline (desktop): where it came from and
 * when, what changed, what was kept, and its sessions. Done sessions keep the
 * version they were done in, so an older version lists what was done in it.
 */
export function VersionDetail({
  version,
  sessions,
  sessionsError,
  onRetrySessions,
  retryingSessions,
  today,
  action,
}: VersionDetailProps) {
  const { colors, motion } = useTheme();
  const reduced = useReducedMotion();
  const source = VERSION_SOURCES[version.source];

  return (
    <Card padding={0} style={styles.card}>
      <Animated.View
        key={version.version}
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
          <Disc
            icon={source.icon}
            size={48}
            tone={version.active ? 'accent' : 'quiet'}
            style={version.active ? { backgroundColor: colors.accentSoftStrong } : null}
          />
          <View style={styles.headText}>
            <Text variant="label" tone="tertiary" tabular>
              {source.label} · {versionWhen(version)}
            </Text>
            <View style={styles.titleRow}>
              <Text variant="heading" accessibilityRole="header">
                Version {version.version}
              </Text>
              {version.active ? <Badge tone="accent">In use</Badge> : null}
            </View>
          </View>
        </View>

        <View style={styles.block}>
          <Text variant="label" tone="secondary" accessibilityRole="header">
            What changed
          </Text>
          <Text variant="body">{version.summary}</Text>
          {version.kept_note ? (
            <View style={styles.kept}>
              <View style={styles.keptIcon}>
                <Icon name="check" size={14} color={colors.successText} />
              </View>
              <Text variant="bodySm" style={styles.grow}>
                {version.kept_note}
              </Text>
            </View>
          ) : null}
          {action ? (
            <Button
              variant="secondary"
              size="sm"
              icon="message-circle"
              accessibilityHint={action.hint}
              onPress={action.onPress}
              style={styles.action}>
              {action.label}
            </Button>
          ) : null}
        </View>

        <Divider />

        <View style={styles.block}>
          <View style={styles.sectionRow}>
            <Text variant="label" tone="secondary" accessibilityRole="header">
              Sessions in this version
            </Text>
            {sessions && !sessionsError ? (
              <Text variant="caption" tabular>
                {sessions.length}
              </Text>
            ) : null}
          </View>
          {sessionsError ? (
            <LoadError title="Sessions won't load." onRetry={onRetrySessions} retrying={retryingSessions} quiet />
          ) : !sessions ? (
            <View style={styles.loading}>
              <Skeleton width={40} height={40} radius={20} />
              <View style={[styles.grow, styles.loadingText]}>
                <Skeleton width="56%" height={14} />
                <Skeleton width="40%" height={10} />
              </View>
            </View>
          ) : sessions.length ? (
            <View>
              {sessions.map((session) => (
                <VersionSession key={session.id} session={session} today={today} />
              ))}
            </View>
          ) : (
            <Text variant="bodySm">Later versions replaced its sessions.</Text>
          )}
        </View>
      </Animated.View>
    </Card>
  );
}

function VersionSession({ session, today }: { session: PlannedSession; today: LocalDate }) {
  const router = useRouter();
  const state = sessionMarkState(session, today);
  const facts = useSessionFacts(session, state);
  return (
    <SessionLine
      icon={sportIcon(session.sport_id)}
      title={session.title}
      tags={session.optional ? ['Optional'] : []}
      meta={`${formatDayDate(sessionLocalDate(session))} · ${factsLine(facts)}`}
      state={state}
      hint="Opens the session"
      onPress={() => router.push(routes.session(session.id))}
    />
  );
}

const styles = StyleSheet.create({
  card: { padding: 28 },
  body: { gap: 22 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  headText: { flex: 1, minWidth: 0, gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  block: { gap: 10 },
  kept: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  keptIcon: { marginTop: 3 },
  grow: { flex: 1, minWidth: 0 },
  action: { alignSelf: 'flex-start', marginTop: 4 },
  sectionRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 8 },
  loadingText: { gap: 8 },
});
