import { cubicBezier, useReducedMotion } from 'react-native-reanimated';

import { motion } from '@/theme';

const RISE = {
  from: { opacity: 0, transform: [{ translateY: 14 }] },
  to: { opacity: 1, transform: [{ translateY: 0 }] },
};

/**
 * The desktop sign-in screens' entrance: a piece rises a few pixels into
 * place, `step` steps into a short stagger. A CSS animation rather than an
 * entering animation: on the web, an entering animation with initial values
 * pins the view with absolute positioning once it ends, which breaks the
 * layout when it changes later (a resize). Nothing moves under reduced motion.
 */
export function useRise() {
  const reduced = useReducedMotion();
  return (step: number) =>
    reduced
      ? null
      : ({
          opacity: 0,
          animationName: RISE,
          animationDuration: motion.durCalm,
          animationDelay: 80 + step * 70,
          animationFillMode: 'forwards',
          animationTimingFunction: cubicBezier(...motion.easeOut),
        } as const);
}

/** A piece's entrance style, or null when it should not move. */
export type RiseStyle = ReturnType<ReturnType<typeof useRise>>;
