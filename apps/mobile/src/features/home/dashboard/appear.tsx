import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';

import { useTheme } from '@/theme';

/** Where content slides in from: below on first show, the side a week was paged from. */
export type AppearFrom = 'below' | 'left' | 'right';

// Module constants: a new keyframes object on every render would restart the animation.
const KEYFRAMES = {
  below: { from: { opacity: 0, transform: [{ translateY: 10 }] }, to: { opacity: 1, transform: [{ translateY: 0 }] } },
  left: { from: { opacity: 0, transform: [{ translateX: -18 }] }, to: { opacity: 1, transform: [{ translateX: 0 }] } },
  right: { from: { opacity: 0, transform: [{ translateX: 18 }] }, to: { opacity: 1, transform: [{ translateX: 0 }] } },
} as const;

/** Siblings start this far apart, so a group comes in as a short cascade. */
const STAGGER_MS = 45;

type AppearProps = {
  children: ReactNode;
  /** Position among siblings; each step delays the start a little. */
  index?: number;
  from?: AppearFrom;
  style?: StyleProp<ViewStyle>;
};

/**
 * A fade with a short slide when the content mounts (README › Motion: fades
 * and short slides). Key it to replay. Content shows at once under reduced motion.
 */
export function Appear({ children, index = 0, from = 'below', style }: AppearProps) {
  const { motion } = useTheme();
  const reduced = useReducedMotion();
  return (
    <Animated.View
      style={[
        style,
        reduced
          ? null
          : {
              animationName: KEYFRAMES[from],
              animationDuration: 280,
              animationDelay: index * STAGGER_MS,
              animationFillMode: 'backwards',
              animationTimingFunction: cubicBezier(...motion.easeOut),
            },
      ]}>
      {children}
    </Animated.View>
  );
}
