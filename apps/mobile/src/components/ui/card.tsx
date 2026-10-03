import type { ReactNode } from 'react';
import { type StyleProp, View, type ViewStyle } from 'react-native';

import { type Theme, useTheme } from '@/theme';

import { PressableScale } from './pressable-scale';

export type CardVariant = 'default' | 'sunken' | 'accent' | 'outline';

function surface(variant: CardVariant, theme: Theme): ViewStyle {
  const { colors, shadows } = theme;
  switch (variant) {
    case 'sunken':
      return { backgroundColor: colors.surfaceSunken, borderColor: 'transparent' };
    case 'accent':
      return { backgroundColor: colors.accentSoft, borderColor: 'transparent' };
    case 'outline':
      return { backgroundColor: 'transparent', borderColor: colors.borderStrong };
    default:
      return {
        backgroundColor: colors.surfaceCard,
        borderColor: colors.borderSubtle,
        ...shadows[1],
      };
  }
}

export type CardProps = {
  children: ReactNode;
  variant?: CardVariant;
  /** 20 by default (card padding). */
  padding?: number;
  /** Makes the whole card a button with the card press scale (0.99). */
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
};

/** Surface card: radius 24, hairline border, near-invisible warm shadow. Never nest default cards. */
export function Card({ children, variant = 'default', padding = 20, onPress, accessibilityLabel, accessibilityHint, style }: CardProps) {
  const theme = useTheme();
  // Padding 0 adds nothing: on web the shorthand goes inline and would beat a style's own paddings.
  const base: ViewStyle = { borderRadius: theme.radius.card, borderWidth: 1, ...(padding ? { padding } : null) };

  if (!onPress) {
    return <View style={[base, surface(variant, theme), style]}>{children}</View>;
  }
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={theme.motion.pressScaleCard}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={[base, surface(variant, theme), style]}>
      {children}
    </PressableScale>
  );
}
