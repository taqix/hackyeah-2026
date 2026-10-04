import { StyleSheet, View } from 'react-native';

import { usePlanVersions } from '@/api/hooks';
import type { PlanVersion } from '@/api/types';
import { BackButton, Body, Col, Content, Row, Screen, TopBar } from '@/components/layout';
import { Skeleton } from '@/components/ui';
import { useOpenChat } from '@/navigation/open-chat';

import { EmptyState, LoadError } from './states';
import { VersionEntry } from './version-entry';

/** 10.1 — Plan history: every accepted plan is a version, newest first; the active one is in use. */
export function PlanHistoryScreen() {
  const versions = usePlanVersions();
  const openChat = useOpenChat();

  // Chat and undo versions point back to the change card in the conversation.
  const actionFor = (version: PlanVersion) =>
    version.chat_message_id ? { label: 'See the chat', hint: 'Opens the chat', onPress: () => openChat() } : null;

  return (
    <Screen>
      <TopBar left={<BackButton />} title="Plan history" />
      <Content gap={24}>
        <Body>Every change is saved as a new version. Done sessions keep the version they were done in.</Body>
        {versions.isPending ? (
          <VersionsSkeleton />
        ) : versions.isError ? (
          <LoadError
            title="Plan history won't load."
            onRetry={() => void versions.refetch()}
            retrying={versions.isFetching}
          />
        ) : versions.data.length === 0 ? (
          <EmptyState
            icon="calendar-range"
            title="No versions yet."
            body="Your first plan will be version 1. Each week's plan and each change in chat adds one."
          />
        ) : (
          <View accessibilityRole="list" accessibilityLabel="Plan versions">
            {versions.data.map((version, i) => (
              <VersionEntry
                key={version.version}
                version={version}
                last={i === versions.data.length - 1}
                action={actionFor(version)}
              />
            ))}
          </View>
        )}
      </Content>
    </Screen>
  );
}

function VersionsSkeleton() {
  return (
    <View accessible accessibilityLabel="Loading plan history" style={styles.skeleton}>
      {[0, 1, 2].map((i) => (
        <Row key={i} gap={14} style={styles.row}>
          <Skeleton width={32} height={32} radius={16} />
          <Col gap={8} style={styles.grow}>
            <Skeleton width="40%" height={16} />
            <Skeleton width="52%" height={10} />
            <Skeleton width="92%" height={12} />
            <Skeleton width="70%" height={12} />
          </Col>
        </Row>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: { gap: 24 },
  row: { alignItems: 'flex-start' },
  grow: { flex: 1 },
});
