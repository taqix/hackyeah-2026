import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

import { Badge, type BadgeTone } from './badge';
import { Card, type CardVariant } from './card';
import { Disc, type DiscTone } from './disc';
import type { IconName } from './icon';
import { Text } from './text';

/** How a change reads: good news, bad news, or neither. The colour follows it, not the arrow. */
export type StatDeltaTone = 'positive' | 'negative' | 'neutral';

const DELTA_TONE: Record<StatDeltaTone, BadgeTone> = { positive: 'success', negative: 'danger', neutral: 'neutral' };
const TREND_ICON: Record<'up' | 'down', IconName> = { up: 'trending-up', down: 'trending-down' };

export type StatTileProps = {
  /** What is counted ("Sessions this week"). */
  label: string;
  /** The number, formatted by the caller ("3", "1:24", "12.5"). */
  value: string | number;
  /** Small text after the number ("min", "of 4"). */
  unit?: string;
  /** The change against the last period, in a small pill ("+1"). */
  delta?: string;
  deltaTone?: StatDeltaTone;
  /** An arrow in the pill: which way the number went. */
  trend?: 'up' | 'down';
  /** A quiet line after the pill, or under the number ("vs last week"). */
  hint?: string;
  icon?: IconName;
  iconTone?: DiscTone;
  variant?: CardVariant;
  /** Makes the tile a button; on the web it lifts under the mouse. */
  onPress?: () => void;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
};

/** One number for a dashboard: label, a big tabular value with its unit, and an optional change and hint. */
export function StatTile({
  label,
  value,
  unit,
  delta,
  deltaTone = 'neutral',
  trend,
  hint,
  icon,
  iconTone = 'accent',
  variant = 'default',
  onPress,
  accessibilityHint,
  style,
}: StatTileProps) {
  const { fontFamily } = useTheme();
  const spoken = [label, unit ? `${value} ${unit}` : String(value), delta, hint].filter(Boolean).join(', ');
  return (
    <Card
      variant={variant}
      onPress={onPress}
      accessibilityLabel={onPress ? spoken : undefined}
      accessibilityHint={accessibilityHint}
      style={[styles.tile, style]}>
      <View style={styles.head}>
        {icon ? <Disc icon={icon} tone={iconTone} size={32} /> : null}
        <Text variant="label" tone="secondary" numberOfLines={2} style={styles.label}>
          {label}
        </Text>
      </View>
      <View style={styles.value}>
        <Text
          tabular
          numberOfLines={1}
          style={{ fontFamily: fontFamily.displaySemibold, fontSize: 32, lineHeight: 36, letterSpacing: -0.5 }}>
          {value}
        </Text>
        {unit ? (
          <Text variant="label" tone="tertiary">
            {unit}
          </Text>
        ) : null}
      </View>
      {delta || hint ? (
        <View style={styles.foot}>
          {delta ? (
            <Badge tone={DELTA_TONE[deltaTone]} icon={trend ? TREND_ICON[trend] : undefined}>
              {delta}
            </Badge>
          ) : null}
          {hint ? (
            <Text variant="caption" style={styles.hint}>
              {hint}
            </Text>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  tile: { gap: 12, minWidth: 0 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  label: { flex: 1, minWidth: 0 },
  value: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  foot: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  hint: { flexShrink: 1 },
});
