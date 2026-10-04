import { LinearGradient } from 'expo-linear-gradient';
import { type DimensionValue, Platform, type StyleProp, StyleSheet, type ViewStyle } from 'react-native';
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';

import { type ColorScheme, useTheme } from '@/theme';

const PULSE = { '50%': { opacity: 0.45 } };
/** The web's sheen: a soft band that sweeps from off the left edge to off the right. */
const SWEEP = { from: { transform: [{ translateX: '-100%' as const }] }, to: { transform: [{ translateX: '100%' as const }] } };
const LOOP_MS = 1600;

/** The sheen's colour at its brightest, over the sunken fill. */
const SHEEN: Record<ColorScheme, readonly [string, string, string]> = {
  light: ['rgba(255,251,245,0)', 'rgba(255,251,245,0.75)', 'rgba(255,251,245,0)'],
  dark: ['rgba(243,237,227,0)', 'rgba(243,237,227,0.06)', 'rgba(243,237,227,0)'],
};

export type SkeletonProps = {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Loading placeholder bar. Pulses (1.6 s) on phones; on the web a sheen
 * sweeps across instead, which reads better on large placeholders. Holds still
 * under reduced motion. Hidden from screen readers.
 */
export function Skeleton({ width = '100%', height = 14, radius = 8, style }: SkeletonProps) {
  const { colors, motion, scheme } = useTheme();
  const reduced = useReducedMotion();
  const sheen = Platform.OS === 'web' && !reduced;
  return (
    <Animated.View
      aria-hidden
      accessibilityElementsHidden
      style={[
        { width, height, borderRadius: radius, backgroundColor: colors.surfaceSunken },
        sheen
          ? styles.clip
          : {
              animationName: reduced ? 'none' : PULSE,
              animationDuration: LOOP_MS,
              animationIterationCount: 'infinite',
              animationTimingFunction: cubicBezier(...motion.easeInOut),
            },
        style,
      ]}>
      {sheen ? (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              animationName: SWEEP,
              animationDuration: LOOP_MS,
              animationIterationCount: 'infinite',
              animationTimingFunction: cubicBezier(...motion.easeInOut),
            },
          ]}>
          <LinearGradient
            colors={SHEEN[scheme]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
});
