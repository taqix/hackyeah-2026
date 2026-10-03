import type { StyleProp, ViewStyle } from 'react-native';

import { type SemanticColors, useTheme } from '@/theme';

import { Icon, type IconName } from './icon';
import { PressableScale } from './pressable-scale';

export type IconButtonVariant = 'ghost' | 'secondary' | 'primary';

function look(variant: IconButtonVariant, colors: SemanticColors, pressed: boolean) {
  switch (variant) {
    case 'secondary':
      return { bg: pressed ? colors.surfaceSunken : colors.surfaceCard, fg: colors.textPrimary, border: colors.borderStrong };
    case 'primary':
      return { bg: pressed ? colors.accentPressed : colors.accent, fg: colors.textOnAccent, border: 'transparent' };
    default:
      return { bg: pressed ? colors.surfaceSunken : 'transparent', fg: colors.textPrimary, border: 'transparent' };
  }
}

export type IconButtonProps = {
  icon: IconName;
  /** Required: the button has no visible text. */
  accessibilityLabel: string;
  onPress?: () => void;
  variant?: IconButtonVariant;
  /** sm 36, md 44. Both reach 44 with hitSlop. */
  size?: 'sm' | 'md';
  /** Overrides the variant's icon color (e.g. secondary text for a quiet eye toggle). */
  color?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  variant = 'ghost',
  size = 'md',
  color,
  disabled = false,
  style,
}: IconButtonProps) {
  const { colors, layout } = useTheme();
  const d = size === 'sm' ? 36 : 44;
  const slop = Math.max(0, (layout.hitMin - d) / 2);

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      hitSlop={slop}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={({ pressed }) => {
        const v = look(variant, colors, pressed);
        return [
          {
            width: d,
            height: d,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: v.border,
            backgroundColor: v.bg,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: disabled ? 0.4 : 1,
          },
          style,
        ];
      }}>
      {({ pressed }) => (
        <Icon name={icon} size={size === 'sm' ? 18 : 20} color={color ?? look(variant, colors, pressed).fg} />
      )}
    </PressableScale>
  );
}
