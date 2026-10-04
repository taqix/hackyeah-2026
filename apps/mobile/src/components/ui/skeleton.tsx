import type { DimensionValue, StyleProp, ViewStyle } from 'react-native';
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';

import { useTheme } from '@/theme';

const PULSE = { '50%': { opacity: 0.45 } };

export type SkeletonProps = {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

/** Loading placeholder bar. Pulses (1.6 s); holds still under reduced motion. Hidden from screen readers. */
export function Skeleton({ width = '100%', height = 14, radius = 8, style }: SkeletonProps) {
  const { colors, motion } = useTheme();
  const reduced = useReducedMotion();
  return (
    <Animated.View
      aria-hidden
      accessibilityElementsHidden
      style={[
        { width, height, borderRadius: radius, backgroundColor: colors.surfaceSunken },
        {
          animationName: reduced ? 'none' : PULSE,
          animationDuration: 1600,
          animationIterationCount: 'infinite',
          animationTimingFunction: cubicBezier(...motion.easeInOut),
        },
        style,
      ]}
    />
  );
}
