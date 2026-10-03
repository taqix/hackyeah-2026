import { View } from 'react-native';

import { useWeek } from '@/api/hooks';
import type { ActivityLog, PlannedSession } from '@/api/types';
import { Col, H1, Kicker, Row } from '@/components/layout';
import { Disc, ProgressRing, Skeleton } from '@/components/ui';
import { now } from '@/lib/clock';
import { startOfWeek } from '@/lib/dates';
import { sessionLocalDate, weekProgress } from '@/lib/sessions';
import { sportIcon } from '@/lib/sport-visuals';

import { feedbackHeading, feedbackKicker, weekWord } from './copy';

const RING = 64;

/**
 * The week's ring, then "Wednesday · 20 min · 2 of 3 this week" and a calm heading.
 * Progress counts the plan week the session belongs to, which differs from the
 * log's day when a session is done early or late. `session` is undefined while it loads.
 */
export function FeedbackHeader({ log, session }: { log: ActivityLog; session: PlannedSession | null | undefined }) {
  const sessionPending = log.session_id !== null && session === undefined;
  const weekStart = startOfWeek(session ? sessionLocalDate(session) : log.started_at);
  const week = useWeek(sessionPending ? null : weekStart);
  const today = now();
  const progress = week.data ? weekProgress(week.data) : null;
  const showRing = !!progress && progress.total > 0;

  return (
    <Row gap={16} style={{ alignItems: 'center' }}>
      {sessionPending || week.isPending ? (
        <Skeleton width={RING} height={RING} radius={RING / 2} />
      ) : showRing ? (
        <ProgressRing
          value={progress.done / progress.total}
          size={RING}
          label={`${progress.done}/${progress.total}`}
          accessibilityLabel={`${progress.done} of ${progress.total} sessions done ${weekWord(weekStart, today)}`}
        />
      ) : (
        <View style={{ width: RING, alignItems: 'center' }}>
          <Disc icon={sportIcon(log.sport_id)} tone="accent" size={56} />
        </View>
      )}
      <Col gap={4} style={{ flex: 1, minWidth: 0 }}>
        <Kicker>{feedbackKicker({ log, weekStart, today, progress })}</Kicker>
        <H1>{feedbackHeading(log)}</H1>
      </Col>
    </Row>
  );
}
