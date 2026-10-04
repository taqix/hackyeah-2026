import { StyleSheet, View } from 'react-native';

import type { PlanVersion } from '@/api/types';
import { Col, Row } from '@/components/layout';
import { Badge, Disc, Icon, Text, TextLink } from '@/components/ui';
import { useTheme } from '@/theme';

import { VERSION_SOURCES, versionWhen } from './version-source';

type VersionEntryProps = {
  version: PlanVersion;
  /** The last entry has no line down to the next one. */
  last: boolean;
  action?: { label: string; onPress: () => void; hint?: string } | null;
};

/** One version of the plan: where it came from, when, its summary, and what was done in it. */
export function VersionEntry({ version, last, action }: VersionEntryProps) {
  const { colors } = useTheme();
  const source = VERSION_SOURCES[version.source];
  return (
    <View style={styles.entry}>
      <View style={styles.rail}>
        <Disc
          icon={source.icon}
          size={32}
          tone={version.active ? 'accent' : 'quiet'}
          style={version.active ? { backgroundColor: colors.accentSoftStrong } : null}
        />
        {last ? null : <View style={[styles.line, { backgroundColor: colors.borderSubtle }]} />}
      </View>
      <Col gap={6} style={[styles.body, !last && styles.bodySpaced]}>
        <View style={styles.titleRow}>
          <Text variant="subheading" accessibilityRole="header">
            Version {version.version}
          </Text>
          {version.active ? (
            <Badge tone="accent" style={styles.badge}>
              In use
            </Badge>
          ) : null}
        </View>
        <Text variant="caption" tone="secondary" tabular>
          {source.label} · {versionWhen(version)}
        </Text>
        <Text variant="bodySm" tone="primary">
          {version.summary}
        </Text>
        {version.kept_note ? (
          <Row gap={6} style={styles.kept}>
            <View style={styles.keptIcon}>
              <Icon name="check" size={14} color={colors.successText} />
            </View>
            <Text variant="bodySm" style={styles.keptText}>
              {version.kept_note}
            </Text>
          </Row>
        ) : null}
        {action ? (
          <TextLink onPress={action.onPress} accessibilityHint={action.hint} style={styles.action}>
            {action.label}
          </TextLink>
        ) : null}
      </Col>
    </View>
  );
}

const styles = StyleSheet.create({
  entry: { flexDirection: 'row', gap: 14 },
  rail: { width: 32, alignItems: 'center' },
  line: { flex: 1, width: 2, marginTop: 6, borderRadius: 1 },
  body: { flex: 1, minWidth: 0 },
  bodySpaced: { paddingBottom: 24 },
  titleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  badge: { alignSelf: 'center' },
  kept: { alignItems: 'flex-start' },
  keptIcon: { marginTop: 3 },
  keptText: { flex: 1 },
  action: { marginTop: -6, marginBottom: -12 },
});
