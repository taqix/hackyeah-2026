import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useCommitLog, useLog } from '@/api/hooks';
import { isApiError } from '@/api/types';
import { Col, Content, Row, Screen, TopBar } from '@/components/layout';
import { Button, IconButton, Skeleton, Spinner, Text } from '@/components/ui';
import { useTheme } from '@/theme';

import { FeedbackForm } from './feedback-form';

/** Lands on Today, dropping the logging screens underneath. */
function useLeaveToToday() {
  const router = useRouter();
  return () => {
    if (router.canDismiss()) router.dismissAll();
    router.replace('/(tabs)');
  };
}

/** Why closing didn't save. Offline and server hiccups keep the draft, saved at the next start. */
function closeErrorText(error: unknown): string {
  if (isApiError(error, 'offline') || isApiError(error, 'timeout') || isApiError(error, 'unknown')) {
    return "This workout isn't saved yet. Check your connection and try again, or close and we'll save it the next time you open the app.";
  }
  return isApiError(error) ? error.message : "We couldn't save this workout. Try again.";
}

/**
 * Completion & feedback (7), a modal after any session is logged (log-it form,
 * gym review). Save sends the log with its feedback. Close saves the log
 * without feedback (it can be given later); if that fails, the log stays on
 * this phone and Close a second time leaves anyway.
 */
export function FeedbackScreen({ logId }: { logId: string | undefined }) {
  const log = useLog(logId);
  const commit = useCommitLog();
  const leave = useLeaveToToday();
  const { colors, layout } = useTheme();

  const saveAndLeave = () => {
    const current = log.data;
    if (!current || current.actuals_locked) return leave();
    commit.mutate(current.id, { onSuccess: leave });
  };
  const close = () => (commit.isError ? leave() : saveAndLeave());

  return (
    <Screen>
      <TopBar
        right={
          commit.isPending ? (
            <View style={styles.closing}>
              <Spinner color={colors.textTertiary} accessibilityLabel="Saving" />
            </View>
          ) : (
            <IconButton icon="x" accessibilityLabel="Close" onPress={close} />
          )
        }
      />
      {commit.isError ? (
        <Row gap={12} style={[styles.closeError, { paddingHorizontal: layout.gutter }]}>
          <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.fill}>
            <Text variant="bodySm" tone="danger">
              {closeErrorText(commit.error)}
            </Text>
          </View>
          <Button variant="secondary" size="sm" icon="rotate-ccw" onPress={saveAndLeave}>
            Try again
          </Button>
        </Row>
      ) : null}
      {log.data ? (
        <FeedbackForm key={log.data.id} log={log.data} onDone={leave} />
      ) : log.isError || !logId ? (
        <LoadError onRetry={logId ? () => void log.refetch() : undefined} retrying={log.isFetching} />
      ) : (
        <FeedbackSkeleton />
      )}
    </Screen>
  );
}

function FeedbackSkeleton() {
  const { radius } = useTheme();
  return (
    <Content gap={24} scroll={false}>
      <Row gap={16}>
        <Skeleton width={64} height={64} radius={32} />
        <Col gap={10} style={{ flex: 1 }}>
          <Skeleton width="70%" height={12} />
          <Skeleton width="85%" height={32} radius={10} />
        </Col>
      </Row>
      <Col gap={8}>
        <Skeleton width="40%" height={18} />
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} height={68} radius={radius.md} />
        ))}
      </Col>
      <View accessible accessibilityLabel="Loading" accessibilityRole="progressbar" />
    </Content>
  );
}

function LoadError({ onRetry, retrying }: { onRetry?: () => void; retrying: boolean }) {
  return (
    <Content gap={20}>
      <Col gap={8} accessibilityRole="alert">
        <Text variant="heading">We couldn&apos;t load this workout</Text>
        <Text variant="bodySm">
          {onRetry ? 'Check your connection, then try again.' : 'It may have been removed. Close this to go back to Today.'}
        </Text>
      </Col>
      {onRetry ? (
        <Button variant="secondary" icon="rotate-ccw" loading={retrying} onPress={onRetry} style={{ alignSelf: 'flex-start' }}>
          Try again
        </Button>
      ) : null}
    </Content>
  );
}

const styles = StyleSheet.create({
  closing: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  closeError: { alignItems: 'flex-start', paddingBottom: 12 },
  fill: { flex: 1, minWidth: 0 },
});
