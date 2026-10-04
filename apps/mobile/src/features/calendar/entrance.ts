import { cubicBezier } from 'react-native-reanimated';

import { motion } from '@/theme';

const RISE = {
  from: { opacity: 0, transform: [{ translateY: 10 }] },
  to: { opacity: 1, transform: [{ translateY: 0 }] },
};

/**
 * A desktop section's entrance: a short rise and fade, a little later for each
 * later section, and nothing under reduced motion. A CSS animation, so the
 * section is never left hidden if the page is not drawing frames yet.
 */
export function entrance(order: number, reduced: boolean) {
  if (reduced) return null;
  return {
    animationName: RISE,
    animationDuration: 280,
    animationDelay: order * 70,
    animationFillMode: 'backwards',
    animationTimingFunction: cubicBezier(...motion.easeOut),
  } as const;
}
