import { useEffect, type ReactNode } from 'react';
import { Platform, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { useTheme } from '@/theme';

import { Text } from './text';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export type ProgressRingProps = {
  /** 0..1 */
  value: number;
  size?: number;
  stroke?: number;
  /** Short text in the middle ("2/3"). */
  label?: string;
  /** Custom centre content instead of the label. */
  children?: ReactNode;
  /** What the ring means ("2 of 3 sessions done this week"). */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

const IS_WEB = Platform.OS === 'web';

/**
 * Accent arc on a hairline track; eases to a new value (600 ms, skipped under
 * reduced motion). Vector all the way, so it stays crisp at any size; pass a
 * thicker `stroke` with a larger `size`.
 */
export function ProgressRing({ value, size = 56, stroke = 5, label, children, accessibilityLabel, style }: ProgressRingProps) {
  const { colors, fontFamily, motion } = useTheme();
  const reduced = useReducedMotion();
  const v = Math.max(0, Math.min(1, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const progress = useSharedValue(v);

  useEffect(() => {
    progress.set(reduced ? v : withTiming(v, { duration: motion.durCalm, easing: Easing.bezier(...motion.easeOut) }));
  }, [v, reduced, progress, motion]);

  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: c * (1 - progress.get()) }));

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(v * 100) }}
      // React Native Web reads the value from aria-* only.
      aria-valuemin={IS_WEB ? 0 : undefined}
      aria-valuemax={IS_WEB ? 100 : undefined}
      aria-valuenow={IS_WEB ? Math.round(v * 100) : undefined}
      style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={colors.borderSubtle} strokeWidth={stroke} />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={colors.accent}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          animatedProps={animatedProps}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.centre]}>
        {children ??
          (label ? (
            <Text
              tabular
              style={{
                fontFamily: fontFamily.displaySemibold,
                fontSize: Math.round(size * 0.26),
                lineHeight: Math.round(size * 0.3),
              }}>
              {label}
            </Text>
          ) : null)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centre: { alignItems: 'center', justifyContent: 'center' },
});
