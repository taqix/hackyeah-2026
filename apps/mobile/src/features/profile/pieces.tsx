import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Icon, type IconName, PressableScale, Skeleton, Text } from '@/components/ui';
import { Col, Row } from '@/components/layout';
import { useTheme } from '@/theme';

/** Quiet note on a sunken card (prototype Note). */
export function Note({ icon, children }: { icon: IconName; children: string }) {
  const { colors } = useTheme();
  return (
    <Card variant="sunken" padding={16}>
      <Row gap={12} style={styles.top}>
        <View style={styles.nudge}>
          <Icon name={icon} size={18} color={colors.textSecondary} />
        </View>
        <Text variant="bodySm" style={styles.fill}>
          {children}
        </Text>
      </Row>
    </Card>
  );
}

/** A small info icon and a caption, as under 9.3's facts. */
export function InfoCaption({ children }: { children: string }) {
  const { colors } = useTheme();
  return (
    <Row gap={8} style={styles.top}>
      <View style={styles.nudge}>
        <Icon name="info" size={16} color={colors.textTertiary} />
      </View>
      <Text variant="caption" style={styles.fill}>
        {children}
      </Text>
    </Row>
  );
}

/** A load failure with Try again. */
export function ErrorState({ title, onRetry }: { title: string; onRetry: () => void }) {
  return (
    <View accessibilityRole="alert" style={styles.message}>
      <Col gap={6}>
        <Text variant="subheading">{title}</Text>
        <Text variant="bodySm">Check your connection, then try again.</Text>
      </Col>
      <Button variant="secondary" size="sm" icon="refresh-cw" onPress={onRetry} style={styles.inline}>
        Try again
      </Button>
    </View>
  );
}

/** Placeholder rows while a list loads. */
export function RowsSkeleton({ count = 3, disc = 40 }: { count?: number; disc?: number }) {
  return (
    <Col gap={0} accessibilityLabel="Loading" accessible>
      {Array.from({ length: count }, (_, i) => (
        <Row key={i} gap={14} style={styles.skeletonRow}>
          <Skeleton width={disc} height={disc} radius={disc / 2} />
          <Col gap={8} style={styles.fill}>
            <Skeleton width="45%" height={14} />
            <Skeleton width="75%" height={12} />
          </Col>
        </Row>
      ))}
    </Col>
  );
}

/** One statement of the summary: its text and source; opens Why we think this (9.3). */
export function StatementRow({
  text,
  source,
  icon,
  divider,
  onPress,
}: {
  text: string;
  source: string;
  icon: IconName;
  divider?: boolean;
  onPress: () => void;
}) {
  const { colors, motion } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={motion.pressScaleCard}
      accessibilityRole="button"
      accessibilityLabel={`${text} Source: ${source}.`}
      accessibilityHint="Shows why we think this"
      style={[styles.statement, divider ? { borderTopWidth: 1, borderTopColor: colors.borderSubtle } : null]}>
      <Col gap={6} style={styles.fill}>
        <Text variant="body">{text}</Text>
        <Row gap={6}>
          <Icon name={icon} size={14} color={colors.textTertiary} />
          <Text variant="caption" style={styles.fill}>
            {source}
          </Text>
        </Row>
      </Col>
      <Icon name="chevron-right" size={18} color={colors.textTertiary} />
    </PressableScale>
  );
}

/** A titled block of rows (Section heading, then rows with hairlines between). */
export function Group({ title, children, gap = 4 }: { title: string; children: ReactNode; gap?: number }) {
  return (
    <Col gap={gap}>
      <Text variant="section" accessibilityRole="header">
        {title}
      </Text>
      <View>{children}</View>
    </Col>
  );
}

const styles = StyleSheet.create({
  top: { alignItems: 'flex-start' },
  nudge: { marginTop: 1 },
  fill: { flex: 1, minWidth: 0 },
  inline: { alignSelf: 'flex-start' },
  message: { gap: 14, paddingVertical: 8 },
  skeletonRow: { minHeight: 60, paddingVertical: 8 },
  statement: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    minHeight: 56,
  },
});
