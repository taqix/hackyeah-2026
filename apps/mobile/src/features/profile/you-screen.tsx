import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

import {
  useAssistantSummary,
  useFeedbackOverview,
  usePlanState,
  usePreferences,
  useSession,
  useSports,
} from '@/api/hooks';
import { IconButton, ListRow, Skeleton, SuggestionCard, Text } from '@/components/ui';
import { Col, Content, H1, Kicker, Row, Screen } from '@/components/layout';
import { useNow } from '@/lib/clock';
import { PREFERENCE_SECTIONS, SECTION_META, sectionLine } from '@/lib/preference-options';
import { useBottomClearance } from '@/navigation/bottom-clearance';
import { routes } from '@/navigation/routes';
import { useTheme } from '@/theme';

import { cardKicker, feedbackCounts, youKicker } from './labels';
import { ErrorState, Group, RowsSkeleton } from './pieces';

/** You (9, and 9.1 in week one): our assistant's summary on top, then everything that shapes the plan. */
export function YouScreen() {
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

/**
 * The summary card. While it rebuilds it keeps the old text marked as updating;
 * when it can't be written (or fails to load) the card hides and the answers stay.
 */
function SummaryCard({ today }: { today: Date }) {
  const router = useRouter();
  const { radius } = useTheme();
  const summary = useAssistantSummary();

  if (summary.isPending) return <Skeleton height={220} radius={radius.xl} />;
  const data = summary.data;
  if (!data || data.status === 'unavailable' || !data.title) return null;

  return (
    <SuggestionCard
      tone="dawn"
      kicker={cardKicker(data, today)}
      title={data.title}
      body={data.headline}
      actionLabel="See why"
      onAction={() => router.push('/profile/summary')}
    />
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
        PREFERENCE_SECTIONS.map((section, i) => (
          <ListRow
            key={section}
            icon={SECTION_META[section].icon}
            title={SECTION_META[section].label}
            detail={sectionLine(section, prefs, sports.data)}
            divider={i > 0}
            onPress={() => router.push(routes.profileEdit(section))}
            accessibilityHint="Opens this question to change your answer"
          />
        ))
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
