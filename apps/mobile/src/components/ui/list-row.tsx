import type { ReactNode } from 'react';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

import { Disc, type DiscTone } from './disc';
import { HoverBand } from './hover-band';
import { Icon, type IconName } from './icon';
import { PressableScale } from './pressable-scale';
import { Text } from './text';

export type ListRowProps = {
  title: string;
  /** Small caption above the title (Review: "Time" over "3 days a week · 20 min"). */
  label?: string;
  /** Secondary line under the title. */
  detail?: string;
  /** Short value at the right, before the chevron (Settings: "Phone"). */
  value?: string;
  /** Leading icon in a Disc. */
  icon?: IconName;
  discTone?: DiscTone;
  discSize?: number;
  /** Custom leading element instead of the Disc. */
  leading?: ReactNode;
  /** Custom trailing element (a small Button, a check). */
  right?: ReactNode;
  /** Makes the row a button and shows a chevron (unless `chevron` is false). */
  onPress?: () => void;
  chevron?: boolean;
  /** Hairline above the row, as in the prototype's lists. */
  divider?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * A row in a list: Review, You, Settings, Privacy. With onPress it opens
 * another screen; on the web a soft band shows under the mouse.
 */
export function ListRow({
  title,
  label,
  detail,
  value,
  icon,
  discTone = 'accent',
  discSize = 40,
  leading,
  right,
  onPress,
  chevron,
  divider = false,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  style,
}: ListRowProps) {
  const { colors, fontFamily, motion } = useTheme();
  const showChevron = chevron ?? !!onPress;

  const content = (
    <>
      {leading ?? (icon ? <Disc icon={icon} tone={discTone} size={discSize} /> : null)}
      <View style={styles.text}>
        {label ? <Text variant="caption">{label}</Text> : null}
        <Text style={{ fontFamily: fontFamily.bodySemibold, fontSize: 16, lineHeight: 21 }}>{title}</Text>
        {detail ? <Text variant="bodySm">{detail}</Text> : null}
      </View>
      {value ? (
        <Text variant="bodySm" numberOfLines={1} style={styles.value}>
          {value}
        </Text>
      ) : null}
      {right}
      {showChevron ? <Icon name="chevron-right" size={18} color={colors.textTertiary} /> : null}
    </>
  );

  const rowStyle = [
    styles.row,
    divider ? { borderTopWidth: 1, borderTopColor: colors.borderSubtle } : null,
    disabled ? { opacity: 0.45 } : null,
    style,
  ];

  if (!onPress) {
    return <View style={rowStyle}>{content}</View>;
  }
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      scaleTo={motion.pressScaleCard}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      aria-disabled={disabled}
      style={rowStyle}>
      {({ hovered }) => (
        <>
          <HoverBand visible={hovered} rowStyle={style} />
          {content}
        </>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 60,
    paddingVertical: 8,
  },
  text: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  value: {
    flexShrink: 0,
    maxWidth: '45%',
  },
});
