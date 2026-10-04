import type { ReactNode } from 'react';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { motion } from '@/theme';

/**
 * Rises into place as it fades in (on the web the preset starts just below).
 * A preset, not custom initial values: on the web Reanimated pins an element
 * entering with custom values to absolute coordinates once it finishes.
 * Reanimated skips it when the system asks for reduced motion.
 */
const RISE = FadeInDown.duration(motion.durSlow);

/**
 * A message that arrives while the thread is open eases in (desktop web).
 * Wrap the thread in `LayoutAnimationConfig skipEntering` so what is already
 * there when it first shows doesn't move. Without `animate` nothing is wrapped.
 */
export function Entrance({ animate, children }: { animate: boolean; children: ReactNode }) {
  if (!animate) return children;
  return <Animated.View entering={RISE}>{children}</Animated.View>;
}
