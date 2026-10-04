import { useRouter } from 'expo-router';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { usePlanVersions } from '@/api/hooks';
import { Col, Row, Section } from '@/components/layout';
import { Skeleton, Text } from '@/components/ui';

import { LoadError } from './states';
import { VersionEntry } from './version-entry';

/** The version in use, with a link to every version (10.1). */
export function PlanHistorySection({ style }: { style?: StyleProp<ViewStyle> }) {
  const router = useRouter();
  const versions = usePlanVersions();

  if (versions.isPending) {
    return (
      <Col gap={14} style={[styles.history, style]}>
        <Skeleton width={120} height={18} />
        <Row gap={14} style={styles.historySkeleton}>
          <Skeleton width={32} height={32} radius={16} />
          <Col gap={8} style={styles.grow}>
            <Skeleton width="40%" height={14} />
            <Skeleton width="56%" height={10} />
            <Skeleton width="90%" height={12} />
          </Col>
        </Row>
      </Col>
    );
  }
  if (versions.isError) {
    return (
      <Col gap={14} style={[styles.history, style]}>
        <Section>Plan history</Section>
        <LoadError
          title="Plan history won't load."
          onRetry={() => void versions.refetch()}
          retrying={versions.isFetching}
          quiet
        />
      </Col>
    );
  }
  const list = versions.data;
  const inUse = list.find((v) => v.active) ?? list[0];
  if (!inUse) return null;

  return (
    <Col gap={14} style={[styles.history, style]}>
      <View style={styles.historyHeader}>
        <Section>Plan history</Section>
        <Text variant="caption" tabular>
          {list.length} {list.length === 1 ? 'version' : 'versions'}
        </Text>
      </View>
      <VersionEntry
        version={inUse}
        last
        action={{
          label: 'See every version',
          hint: 'Opens the plan history',
          onPress: () => router.push('/plan-history'),
        }}
      />
    </Col>
  );
}

const styles = StyleSheet.create({
  history: { marginTop: 8 },
  historyHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  historySkeleton: { alignItems: 'flex-start' },
  grow: { flex: 1 },
});
