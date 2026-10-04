import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { usePlanState, usePlanVersions, useSessionsInRange } from '@/api/hooks';
import type { PlannedSession, PlanVersion } from '@/api/types';
import { Content, PageHeader, Screen } from '@/components/layout';
import { Card, Skeleton } from '@/components/ui';
import { webStyle } from '@/components/ui/web-style';
import { useNow } from '@/lib/clock';
import { toLocalDate } from '@/lib/dates';
import { sortSessions } from '@/lib/sessions';

import { entrance } from './entrance';
import { EmptyState, LoadError } from './states';
import { usePageWidth } from './use-page-width';
import { useVersionAction } from './use-version-action';
import { VersionDetail } from './version-detail';
import { VersionEntry } from './version-entry';
import { VersionTimeline } from './version-timeline';

/** Content at least this wide shows the chosen version beside the timeline. */
const SPLIT_MIN = 820;
const COLUMN_GAP = 28;

/** The version column sticks below the top of the page while a long timeline scrolls (web only). */
const sticky = webStyle({ position: 'sticky', top: 24 });

/**
 * 10.1 on the desktop web, where the sidebar lists it beside the tabs: the
 * versions as a timeline on the left and the chosen one in full on the right,
 * with what changed and its sessions. A narrow page keeps the phone's single
 * column.
 */
export function PlanHistoryDesktopScreen() {
  const versions = usePlanVersions();
  const page = usePageWidth();
  const count = versions.data?.length;

  return (
    <Screen>
      <Content gap={28} onLayout={page.onLayout}>
        <PageHeader
          kicker={count ? `${count} ${count === 1 ? 'version' : 'versions'}, newest first` : undefined}
          title="Plan history"
          subtitle="Every change is saved as a new version. Done sessions keep the version they were done in."
        />
        {versions.isPending ? (
          <HistorySkeleton split={page.width >= SPLIT_MIN} />
        ) : versions.isError ? (
          <View style={styles.notice}>
            <LoadError
              title="Plan history won't load."
              onRetry={() => void versions.refetch()}
              retrying={versions.isFetching}
            />
          </View>
        ) : versions.data.length === 0 ? (
          <View style={styles.notice}>
            <EmptyState
              icon="calendar-range"
              title="No versions yet."
              body="Your first plan will be version 1. Each week's plan and each change in chat adds one."
            />
          </View>
        ) : page.width >= SPLIT_MIN ? (
          <History versions={versions.data} />
        ) : (
          <SingleColumn versions={versions.data} />
        )}
      </Content>
    </Screen>
  );
}

/** Timeline and the chosen version, which starts as the one in use. */
function History({ versions }: { versions: PlanVersion[] }) {
  const reduced = useReducedMotion();
  const plan = usePlanState();
  const today = toLocalDate(useNow());
  const actionFor = useVersionAction();
  const [picked, setPicked] = useState<number | null>(null);
  const firstWeekStart = plan.data?.first_week_start ?? null;
  const plannedThrough = plan.data?.planned_through ?? null;
  const range = useSessionsInRange(firstWeekStart, plannedThrough);

  const chosen =
    versions.find((version) => version.version === picked) ?? versions.find((version) => version.active) ?? versions[0];
  if (!chosen) return null;

  // Without a plan there are no sessions to show; until the plan is read, they are loading.
  let sessions: PlannedSession[] | undefined;
  if (plan.data && (!firstWeekStart || !plannedThrough)) sessions = [];
  else if (range.data) sessions = sortSessions(range.data.sessions.filter((s) => s.plan_version === chosen.version));

  return (
    <View style={[styles.split, { gap: COLUMN_GAP }]}>
      <Animated.View style={[styles.timeline, entrance(1, reduced)]}>
        <VersionTimeline versions={versions} selected={chosen.version} onSelect={setPicked} />
      </Animated.View>
      <View style={styles.detail}>
        <Animated.View style={[sticky, entrance(2, reduced)]}>
          <VersionDetail
            version={chosen}
            sessions={sessions}
            sessionsError={range.isError || plan.isError}
            onRetrySessions={() => void (plan.isError ? plan.refetch() : range.refetch())}
            retryingSessions={range.isFetching || plan.isFetching}
            today={today}
            action={actionFor(chosen)}
          />
        </Animated.View>
      </View>
    </View>
  );
}

/** A narrow page: the phone's list, in a roomy card. */
function SingleColumn({ versions }: { versions: PlanVersion[] }) {
  const actionFor = useVersionAction();
  return (
    <Card style={styles.single}>
      <View accessibilityRole="list" accessibilityLabel="Plan versions">
        {versions.map((version, i) => (
          <VersionEntry
            key={version.version}
            version={version}
            last={i === versions.length - 1}
            action={actionFor(version)}
          />
        ))}
      </View>
    </Card>
  );
}

function HistorySkeleton({ split }: { split: boolean }) {
  const entries = (
    <View style={styles.skeletonList}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={styles.skeletonRow}>
          <Skeleton width={32} height={32} radius={16} />
          <View style={styles.skeletonText}>
            <Skeleton width="40%" height={16} />
            <Skeleton width="52%" height={10} />
            <Skeleton width="92%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );
  return (
    <View accessible accessibilityLabel="Loading plan history" style={[styles.split, { gap: COLUMN_GAP }]}>
      <View style={styles.timeline}>{entries}</View>
      {split ? (
        <View style={styles.detail}>
          <Skeleton height={360} radius={24} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  notice: { maxWidth: 640 },
  split: { flexDirection: 'row', alignItems: 'stretch' },
  timeline: { flex: 1, minWidth: 0, maxWidth: 480 },
  detail: { flex: 1.35, minWidth: 0 },
  single: { maxWidth: 720, padding: 24 },
  skeletonList: { gap: 24, paddingTop: 15 },
  skeletonRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingHorizontal: 15 },
  skeletonText: { flex: 1, gap: 8 },
});
