import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { useLog } from '@/api/hooks';
import { Col, Content, Row, Screen, TopBar } from '@/components/layout';
import { Button, IconButton, Skeleton, Text } from '@/components/ui';
import { useTheme } from '@/theme';

import { FeedbackForm } from './feedback-form';

/** Close and Save both keep the log and land on Today, dropping the logging screens underneath. */
function useLeaveToToday() {
  const router = useRouter();
  return () => {
    if (router.canDismiss()) router.dismissAll();
    router.replace('/(tabs)');
  };
}

/** Completion & feedback (7), a modal after any session is logged (log-it form, gym review). */
export function FeedbackScreen({ logId }: { logId: string | undefined }) {
  const log = useLog(logId);
  const leave = useLeaveToToday();

  return (
    <Screen>
      <TopBar right={<IconButton icon="x" accessibilityLabel="Close" onPress={leave} />} />
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
