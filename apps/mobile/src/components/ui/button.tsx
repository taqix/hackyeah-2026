import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { palette, type SemanticColors, useTheme } from '@/theme';

import { Icon, type IconName } from './icon';
import { PressableScale, type PressState } from './pressable-scale';
import { Spinner } from './spinner';
import { Text } from './text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'inverse' | 'light';
export type ButtonSize = 'sm' | 'md' | 'lg';

const SIZES = {
  sm: { height: 36, paddingX: 14, font: 14, icon: 16, gap: 6 },
  md: { height: 48, paddingX: 20, font: 16, icon: 18, gap: 8 },
  lg: { height: 56, paddingX: 26, font: 18, icon: 20, gap: 10 },
} as const;

type Look = { bg: string; fg: string; border: string; opacity?: number };

/**
 * components.js Button variants. On a phone `pressed` stands in for the hover
 * step; on the web a mouse over the button takes it (README › Hover), and a
 * fill-less ghost washes over whatever surface it sits on.
 */
function look(variant: ButtonVariant, colors: SemanticColors, { pressed, hovered }: PressState): Look {
  switch (variant) {
    case 'secondary':
      return {
        bg: pressed || hovered ? colors.surfaceSunken : colors.surfaceCard,
        fg: colors.textPrimary,
        border: colors.borderStrong,
      };
    case 'ghost':
      return {
        bg: hovered ? colors.hoverWash : pressed ? colors.surfaceSunken : 'transparent',
        fg: colors.textPrimary,
        border: 'transparent',
      };
    case 'inverse':
      return { bg: colors.surfaceInverse, fg: colors.textInverse, border: 'transparent', opacity: hovered ? 0.88 : 1 };
    case 'light':
      // On SuggestionCard: the hero is dark in both themes, so the button stays paper on ink.
      return { bg: pressed || hovered ? palette.paper100 : palette.paper0, fg: palette.ink900, border: 'transparent' };
    default:
      return {
        bg: pressed ? colors.accentPressed : hovered ? colors.accentHover : colors.accent,
        fg: colors.textOnAccent,
        border: 'transparent',
      };
  }
}

export type ButtonProps = {
  children: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  iconRight?: IconName;
  /** Fills the row or column; in a row next to other buttons it takes the rest. */
  fullWidth?: boolean;
  disabled?: boolean;
  /** Shows a spinner in place of the leading icon and blocks presses. */
  loading?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  children,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  fullWidth = false,
  disabled = false,
  loading = false,
  accessibilityLabel,
  accessibilityHint,
  style,
}: ButtonProps) {
  const { colors, fontFamily, layout } = useTheme();
  const s = SIZES[size];
  const inactive = disabled || loading;
  const slop = Math.max(0, (layout.hitMin - s.height) / 2);

  return (
    <PressableScale
      onPress={onPress}
      disabled={inactive}
      hitSlop={{ top: slop, bottom: slop, left: 0, right: 0 }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      aria-disabled={inactive} aria-busy={loading}
      style={(state) => {
        const v = look(variant, colors, state);
        return [
          styles.base,
          {
            height: s.height,
            paddingHorizontal: s.paddingX,
            backgroundColor: v.bg,
            borderColor: v.border,
            opacity: disabled ? 0.4 : (v.opacity ?? 1),
          },
          fullWidth ? styles.full : null,
          style,
        ];
      }}>
      {(state) => {
        const v = look(variant, colors, state);
        return (
          <View style={[styles.row, { gap: s.gap }]}>
            {loading ? (
              <Spinner size={s.icon} color={v.fg} accessibilityLabel={null} />
            ) : icon ? (
              <Icon name={icon} size={s.icon} color={v.fg} />
            ) : null}
            <Text
              numberOfLines={1}
              style={{
                fontFamily: fontFamily.bodySemibold,
                fontSize: s.font,
                lineHeight: Math.round(s.font * 1.2),
                color: v.fg,
              }}>
              {children}
            </Text>
            {iconRight ? <Icon name={iconRight} size={s.icon} color={v.fg} /> : null}
          </View>
        );
      }}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
  },
  full: {
    alignSelf: 'stretch',
    width: '100%',
    flexShrink: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
