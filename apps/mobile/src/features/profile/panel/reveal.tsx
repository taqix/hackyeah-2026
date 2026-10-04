import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';

import { useTheme } from '@/theme';

/** A short rise into place. CSS keyframes run once, when the view mounts. */
const RISE = {
  from: { opacity: 0, transform: [{ translateY: 10 }] },
  to: { opacity: 1, transform: [{ translateY: 0 }] },
};

const STAGGER_MS = 60;

type RevealProps = {
  children: ReactNode;
  /** Position in the page: each step starts a little later. */
  order?: number;
  style?: StyleProp<ViewStyle>;
};

/** A desktop card's entrance: a quick fade up, staggered by `order`. Still under reduced motion. */
export function Reveal({ children, order = 0, style }: RevealProps) {
  const { motion } = useTheme();
  const reduced = useReducedMotion();
  return (
    <Animated.View
      style={[
        reduced
          ? null
          : {
              animationName: RISE,
              animationDuration: motion.durSlow,
              animationDelay: order * STAGGER_MS,
              animationFillMode: 'backwards',
              animationTimingFunction: cubicBezier(...motion.easeOut),
            },
        style,
      ]}>
      {children}
    </Animated.View>
  );
}
