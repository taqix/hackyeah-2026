import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { suggestionInk } from '@/components/ui';
import { useTheme } from '@/theme';

/** Indeterminate progress on the building hero (5.7). Under reduced motion only the track shows. */
export function WorkingBar({ label }: { label: string }) {
  const { motion } = useTheme();
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduced || !width) return;
    progress.set(0);
    progress.set(
      withRepeat(withTiming(1, { duration: 1600, easing: Easing.bezier(...motion.easeInOut) }), -1, false),
    );
    return () => cancelAnimation(progress);
  }, [reduced, width, progress, motion.easeInOut]);

  // A bar 40% wide slides from just off the left edge to just off the right.
  const slide = useAnimatedStyle(() => ({
    transform: [{ translateX: width * (-0.4 + 1.4 * progress.get()) }],
  }));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ marginTop: 8, height: 4, borderRadius: 2, overflow: 'hidden', backgroundColor: suggestionInk.track }}>
      {reduced || !width ? null : (
        <Animated.View
          style={[{ width: width * 0.4, height: 4, borderRadius: 2, backgroundColor: suggestionInk.text }, slide]}
        />
      )}
    </View>
  );
}
