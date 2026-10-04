import { type ReactNode, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { useTheme } from '@/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export type CountdownRingProps = {
  /** 0..1 of the time left. */
  value: number;
  /** Effort uses the accent, rest uses recovery. */
  color: string;
  size: number;
  stroke?: number;
  /** How often `value` changes, so the arc glides between ticks. */
  tickMs?: number;
  accessibilityLabel: string;
  children?: ReactNode;
};

/**
 * The kit ring with a chosen colour (the kit's ProgressRing is accent only).
 * The arc glides linearly between ticks; under reduced motion it steps.
 */
export function CountdownRing({ value, color, size, stroke = 8, tickMs = 250, accessibilityLabel, children }: CountdownRingProps) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const v = Math.max(0, Math.min(1, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const progress = useSharedValue(v);

  useEffect(() => {
    progress.set(reduced ? v : withTiming(v, { duration: tickMs, easing: Easing.linear }));
  }, [v, reduced, progress, tickMs]);

  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: c * (1 - progress.get()) }));

  return (
    <View
      accessible
      accessibilityRole="timer"
      accessibilityLabel={accessibilityLabel}
      style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={colors.borderSubtle} strokeWidth={stroke} />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          animatedProps={animatedProps}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.centre]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  centre: { alignItems: 'center', justifyContent: 'center' },
});
