import type { ReactNode } from 'react';
import type { ColorValue, StyleProp, ViewStyle } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { Icon } from './icon';

const SPIN = {
  from: { transform: [{ rotate: '0deg' }] },
  to: { transform: [{ rotate: '360deg' }] },
};

/** Rotates its child forever (1.1 s, linear). Stops under reduced motion. */
export function Spin({ active = true, children }: { active?: boolean; children: ReactNode }) {
  const reduced = useReducedMotion();
  const on = active && !reduced;
  return (
    <Animated.View
      style={{
        animationName: on ? SPIN : 'none',
        animationDuration: 1100,
        animationIterationCount: 'infinite',
        animationTimingFunction: 'linear',
      }}>
      {children}
    </Animated.View>
  );
}

export type SpinnerProps = {
  size?: number;
  color?: ColorValue;
  /** Announced to screen readers; pass null when a parent already says it is busy. */
  accessibilityLabel?: string | null;
  style?: StyleProp<ViewStyle>;
};

/** The busy indicator: a spinning loader-circle, as in the prototype. */
export function Spinner({ size = 20, color, accessibilityLabel = 'Loading', style }: SpinnerProps) {
  const label = accessibilityLabel ?? undefined;
  return (
    <Animated.View
      style={style}
      accessible={!!label}
      accessibilityRole={label ? 'progressbar' : undefined}
      accessibilityLabel={label}
      accessibilityState={label ? { busy: true } : undefined}>
      <Spin>
        <Icon name="loader-circle" size={size} color={color} strokeWidth={2} />
      </Spin>
    </Animated.View>
  );
}
