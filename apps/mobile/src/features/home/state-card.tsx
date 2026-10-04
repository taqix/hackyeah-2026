import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, type IconName, Text } from '@/components/ui';
import { useTheme } from '@/theme';

type StateCardProps = {
  icon: IconName;
  kicker: string;
  title: string;
  body?: string;
  /** Buttons, in a wrapping row. */
  actions?: ReactNode;
  /** Announced as an alert (5.8, 5.13). */
  alert?: boolean;
  /** Rendered last (an info line under a hairline). */
  children?: ReactNode;
};

/**
 * The hero slot for plan and app states (prototype HeroCard, sunken tone): same
 * radius and title scale as SuggestionCard, so the top of Home keeps its shape.
 */
export function StateCard({ icon, kicker, title, body, actions, alert, children }: StateCardProps) {
  const { colors, radius, fontFamily } = useTheme();
  return (
    <View
      accessibilityRole={alert ? 'alert' : undefined}
      style={[styles.card, { borderRadius: radius.xl, backgroundColor: colors.surfaceSunken }]}>
      <View style={styles.kicker}>
        <View style={[StyleSheet.absoluteFill, styles.kickerFill, { backgroundColor: colors.surfaceCard }]} />
        <Icon name={icon} size={14} strokeWidth={2} color={colors.textSecondary} />
        <Text style={{ fontFamily: fontFamily.bodySemibold, fontSize: 12, lineHeight: 14, color: colors.textSecondary }}>
          {kicker}
        </Text>
      </View>
      <Text
        accessibilityRole="header"
        style={{ fontFamily: fontFamily.displayBold, fontSize: 27, lineHeight: 29, letterSpacing: -0.54 }}>
        {title}
      </Text>
      {body ? (
        <Text variant="bodySm" style={{ fontSize: 15, lineHeight: 21 }}>
          {body}
        </Text>
      ) : null}
      {actions ? <View style={styles.actions}>{actions}</View> : null}
      {children}
    </View>
  );
}

/** An info line under a hairline, at the bottom of a StateCard. */
export function StateCardNote({ icon, children }: { icon: IconName; children: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.note, { borderTopColor: colors.hairlineOnTint }]}>
      <View style={{ marginTop: 1 }}>
        <Icon name={icon} size={16} color={colors.info} />
      </View>
      <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 20,
    gap: 10,
  },
  kicker: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingLeft: 8,
    paddingRight: 10,
    borderRadius: 999,
    overflow: 'hidden',
  },
  kickerFill: {
    opacity: 0.72,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 6,
    paddingTop: 12,
    borderTopWidth: 1,
  },
});
