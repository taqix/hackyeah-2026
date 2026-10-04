/**
 * Home's plan and app states (5.7, 5.8, 5.11, 5.12, 5.13): what replaces the
 * week, or the hero, when there is no week to show yet.
 */
import { View } from 'react-native';

import { Col, Row } from '@/components/layout';
import { Button, Icon, Skeleton, SuggestionCard, Text } from '@/components/ui';
import { capitalize } from '@/lib/dates';
import { useTheme } from '@/theme';

import { StateCard, StateCardNote } from './state-card';
import { WorkingBar } from './working-bar';

/** 5.7: the first plan is being generated, right after onboarding's Build plan. */
export function BuildingHero({ answers }: { answers: string | null }) {
  const body = `${answers ? `${capitalize(answers)}. ` : ''}This takes about a minute.`;
  return (
    <>
      <View role="status" accessibilityLiveRegion="polite">
        <SuggestionCard tone="sage" kicker="Your first week" title="Building your week." body={body}>
          <WorkingBar label="Building your plan" />
        </SuggestionCard>
      </View>
      <Text variant="caption" align="center">
        You can leave this screen. We&apos;ll keep going.
      </Text>
    </>
  );
}

type BuildFailedProps = {
  message: string | null;
  /**
   * The plan assistant is not connected yet (ai_unavailable): not something
   * that went wrong, so it reads as waiting, and nothing retries on its own.
   */
  unavailable: boolean;
  answers: string | null;
  retrying: boolean;
  retryFailed: boolean;
  onRetry: () => void;
  onReviewAnswers: () => void;
};

/** 5.8: generation failed. No partial plan; the answers are kept. */
export function BuildFailed({
  message,
  unavailable,
  answers,
  retrying,
  retryFailed,
  onRetry,
  onReviewAnswers,
}: BuildFailedProps) {
  return (
    <>
      <StateCard
        alert
        icon={unavailable ? 'calendar-clock' : 'calendar-x'}
        kicker="Your first week"
        title={unavailable ? 'Plan not built yet.' : "Plan didn't build."}
        body={
          message ?? 'Something went wrong on our side. Your answers are saved, so trying again only takes a moment.'
        }
        actions={
          <>
            <Button icon="rotate-ccw" loading={retrying} onPress={onRetry}>
              Try again
            </Button>
            <Button variant="ghost" onPress={onReviewAnswers}>
              Review answers
            </Button>
          </>
        }
      />
      {retryFailed ? <RetryError /> : null}
      {answers ? <Text variant="caption">From your answers: {answers}.</Text> : null}
    </>
  );
}

/** Saved answers but no plan requested yet (status none): offer to build it. */
export function NoPlanYet({ building, failed, onBuild }: { building: boolean; failed: boolean; onBuild: () => void }) {
  return (
    <>
      <StateCard
        icon="calendar"
        kicker="Your first week"
        title="No plan yet."
        body="Your answers are saved. Build your first week whenever you're ready."
        actions={
          <Button icon="calendar-plus" loading={building} onPress={onBuild}>
            Build my plan
          </Button>
        }
      />
      {failed ? <RetryError /> : null}
    </>
  );
}

/**
 * A weekly plan or a re-plan from saved answers that didn't go through, above
 * the week it left as it was. Not an error state: the plan still works.
 */
export function PlanNote({ message }: { message: string }) {
  const { colors, radius } = useTheme();
  return (
    <View
      role="status"
      accessibilityLiveRegion="polite"
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        padding: 14,
        borderRadius: radius.card,
        backgroundColor: colors.surfaceSunken,
      }}>
      <View style={{ marginTop: 2 }}>
        <Icon name="info" size={16} color={colors.info} />
      </View>
      <Text variant="bodySm" style={{ flex: 1 }}>
        {message}
      </Text>
    </View>
  );
}

function RetryError() {
  return (
    <Text variant="bodySm" tone="danger" accessibilityRole="alert">
      That didn&apos;t go through. Check your connection, then try again.
    </Text>
  );
}

type QuietWeekProps = {
  kicker: string;
  /** "Walk and Run are both switched off in your choices.", or null. */
  note: string | null;
  onReviewChoices: () => void;
  onOpenChat: () => void;
};

/** 5.11: a valid plan with no sessions (nothing fits the current choices), not an error. */
export function QuietWeekHero({ kicker, note, onReviewChoices, onOpenChat }: QuietWeekProps) {
  return (
    <StateCard
      icon="calendar"
      kicker={kicker}
      title="A quiet week."
      body="No session fits your current choices. You can change them whenever you're ready."
      actions={
        <>
          <Button variant="secondary" onPress={onReviewChoices}>
            Review choices
          </Button>
          <Button variant="ghost" onPress={onOpenChat}>
            Open chat
          </Button>
        </>
      }>
      {note ? <StateCardNote icon="info">{note}</StateCardNote> : null}
    </StateCard>
  );
}

/** 5.13: the plan can't be fetched. */
export function PlanLoadError({ offline, retrying, onRetry }: { offline: boolean; retrying: boolean; onRetry: () => void }) {
  return (
    <StateCard
      alert
      icon="cloud-off"
      kicker={offline ? 'No connection' : 'Something went wrong'}
      title="Plan won't load."
      body={
        offline
          ? "Check your connection, then try again. Anything you've logged is safe."
          : "Try again in a moment. Anything you've logged is safe."
      }
      actions={
        <Button icon="rotate-ccw" loading={retrying} onPress={onRetry}>
          Try again
        </Button>
      }
    />
  );
}

/** 5.12: the greeting while the first load runs. Shapes match the loaded screen so nothing jumps. */
export function HeaderSkeleton() {
  return (
    <Col gap={10} style={{ paddingTop: 2 }}>
      <Skeleton width={196} height={14} />
      <Skeleton width={258} height={32} radius={10} />
      <Skeleton width={118} height={32} radius={10} />
    </Col>
  );
}

/** 5.12: the hero, steps and list while a week loads. */
export function WeekSkeleton() {
  return (
    <>
      <Skeleton height={236} radius={32} />
      <Skeleton height={64} radius={18} />
      <Col gap={18} style={{ marginTop: 8 }}>
        <Skeleton width={104} height={18} />
        {[0, 1, 2].map((i) => (
          <Row key={i} gap={14}>
            <Skeleton width={44} height={30} />
            <Col gap={6} style={{ flex: 1 }}>
              <Skeleton width={i === 1 ? '62%' : '48%'} height={14} />
              <Skeleton width="30%" height={10} />
            </Col>
          </Row>
        ))}
      </Col>
    </>
  );
}
