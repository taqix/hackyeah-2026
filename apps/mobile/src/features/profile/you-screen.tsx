import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

import { useFeedbackOverview, usePlanState, usePreferences, useSession, useSports } from '@/api/hooks';
import { IconButton, ListRow, Text } from '@/components/ui';
import { Col, Content, H1, Kicker, Row, Screen, useLayout } from '@/components/layout';
import { useNow } from '@/lib/clock';
import { useBottomClearance } from '@/navigation/bottom-clearance';

import { AnswerRows } from './answer-rows';
import { feedbackCounts, youKicker } from './labels';
import { ErrorState, Group, RowsSkeleton } from './pieces';
import { SummaryCard } from './summary-card';
import { YouDashboard } from './you-dashboard';

/** You (9, and 9.1 in week one): a dashboard on the desktop web, the phone layout everywhere else. */
export function YouScreen() {
  const { isDesktop } = useLayout();
  return isDesktop ? <YouDashboard /> : <YouPhone />;
}

/** Our assistant's summary on top, then everything that shapes the plan. */
function YouPhone() {
  const router = useRouter();
  const today = useNow();
  const clearance = useBottomClearance();
  const session = useSession();
  const planState = usePlanState();
  const kicker = youKicker(session.data?.user.name, planState.data?.first_week_start, today);

  return (
    <Screen>
      <Content bottomInset={clearance} gap={20}>
        <Row style={styles.header}>
          <Col gap={4} style={styles.fill}>
            {kicker ? <Kicker>{kicker}</Kicker> : null}
            <H1>About you</H1>
          </Col>
          <IconButton
            icon="settings"
            accessibilityLabel="Settings"
            variant="secondary"
            onPress={() => router.push('/settings')}
          />
        </Row>
        <SummaryCard today={today} />
        <Answers />
      </Content>
    </Screen>
  );
}

/** One row per onboarding step, then Your feedback. */
function Answers() {
  const router = useRouter();
  const preferences = usePreferences();
  const sports = useSports();
  const feedback = useFeedbackOverview();

  if (preferences.isPending) {
    return (
      <Group title="What shapes your plan">
        <RowsSkeleton count={6} />
      </Group>
    );
  }
  if (preferences.isError) {
    return <ErrorState title="We couldn't load your answers" onRetry={() => void preferences.refetch()} />;
  }

  const prefs = preferences.data;
  return (
    <Group title="What shapes your plan" gap={2}>
      {prefs ? (
        <AnswerRows preferences={prefs} sports={sports.data} />
      ) : (
        <Text variant="bodySm" style={styles.empty}>
          No answers saved yet.
        </Text>
      )}
      <ListRow
        icon="heart"
        title="Your feedback"
        detail={feedback.data ? feedbackCounts(feedback.data) : undefined}
        divider
        onPress={() => router.push('/profile/feedback')}
      />
    </Group>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'flex-start', justifyContent: 'space-between' },
  fill: { flex: 1, minWidth: 0 },
  empty: { paddingVertical: 8 },
});
