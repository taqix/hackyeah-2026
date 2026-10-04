import type { StyleProp, ViewStyle } from 'react-native';

import { type SemanticColors, useTheme } from '@/theme';

import { Icon, type IconName } from './icon';
import { PressableScale, type PressState } from './pressable-scale';
import { Tooltip, type TooltipPlacement } from './tooltip';

export type IconButtonVariant = 'ghost' | 'secondary' | 'primary';

/** Same steps as Button: on a phone `pressed` stands in for hover; a ghost washes on the web. */
function look(variant: IconButtonVariant, colors: SemanticColors, { pressed, hovered }: PressState) {
  switch (variant) {
    case 'secondary':
      return {
        bg: pressed || hovered ? colors.surfaceSunken : colors.surfaceCard,
        fg: colors.textPrimary,
        border: colors.borderStrong,
      };
    case 'primary':
      return {
        bg: pressed ? colors.accentPressed : hovered ? colors.accentHover : colors.accent,
        fg: colors.textOnAccent,
        border: 'transparent',
      };
    default:
      return {
        bg: hovered ? colors.hoverWash : pressed ? colors.surfaceSunken : 'transparent',
        fg: colors.textPrimary,
        border: 'transparent',
      };
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
  /** Web hover label: the accessibility label unless given; null for none. */
  tooltip?: string | null;
  /** Side the hover label shows on ('top' by default). */
  tooltipPlacement?: TooltipPlacement;
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
  tooltip,
  tooltipPlacement,
  style,
}: IconButtonProps) {
  const { colors, layout } = useTheme();
  const d = size === 'sm' ? 36 : 44;
  const slop = Math.max(0, (layout.hitMin - d) / 2);
  const label = tooltip === undefined ? accessibilityLabel : tooltip;

  return (
    // Always wrapped, so a button that turns disabled keeps its place (and focus) in the tree.
    <Tooltip label={disabled ? '' : (label ?? '')} placement={tooltipPlacement}>
      <PressableScale
        onPress={onPress}
        disabled={disabled}
        hitSlop={slop}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        aria-disabled={disabled}
        style={(state) => {
          const v = look(variant, colors, state);
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
        {(state) => <Icon name={icon} size={size === 'sm' ? 18 : 20} color={color ?? look(variant, colors, state).fg} />}
      </PressableScale>
    </Tooltip>
  );
}
