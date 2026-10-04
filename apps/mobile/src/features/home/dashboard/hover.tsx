import { StyleSheet } from 'react-native';
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';

import { useTheme } from '@/theme';

/**
 * README › Hover: the background shifts one step. The kit's hover wash laid
 * behind the content does that on any fill, tinted or not, in both themes. Put
 * it first in a pressable with a corner radius and `overflow: 'hidden'`, and
 * show it from the pressable's `hovered` state.
 */
export function HoverTint({ visible }: { visible: boolean }) {
  const { colors, motion } = useTheme();
  const reduced = useReducedMotion();
  return (
    <Animated.View
      aria-hidden
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: colors.hoverWash,
          opacity: visible ? 1 : 0,
          pointerEvents: 'none',
          transitionProperty: 'opacity',
          transitionDuration: reduced ? 0 : motion.durFast,
          transitionTimingFunction: cubicBezier(...motion.easeOut),
        },
      ]}
    />
  );
}
