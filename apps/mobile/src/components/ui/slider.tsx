import { useEffect, useMemo, useState } from 'react';
import { type AccessibilityActionEvent, type StyleProp, View, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useTheme } from '@/theme';

import type { IconName } from './icon';
import {
  centreOf,
  indexAt,
  indexOf,
  SLIDER_HEIGHT,
  type SliderRange,
  SliderValue,
  stepCount,
  THUMB,
  Ticks,
  Track,
  trackStyles,
} from './slider-parts';

export type SliderProps = {
  /** Names the slider for screen readers ("Sessions a week"). */
  label: string;
  icon?: IconName;
  range: SliderRange;
  value: number;
  onChange: (value: number) => void;
  /** Spelled-out value above the track and for screen readers ("3 days a week"). */
  format?: (value: number) => string;
  /** Steps that get a number under the track; every step by default. */
  marks?: readonly number[];
  style?: StyleProp<ViewStyle>;
};

const SNAP = { duration: 90 };

/**
 * A number on a scale (onboarding Slider): drag or tap the track; it snaps to
 * whole steps. Vertical drags fall through to the scroll view. Screen readers
 * get one adjustable element with increment/decrement.
 */
export function Slider({ label, icon, range, value, onChange, format = String, marks, style }: SliderProps) {
  const { colors, shadows } = useTheme();
  const reduced = useReducedMotion();
  const count = stepCount(range);
  const index = indexOf(range, value);
  const [width, setWidth] = useState(0);

  const trackWidth = useSharedValue(0);
  const position = useSharedValue(index);
  const last = useSharedValue(index);
  const dragging = useSharedValue(false);
  const lifted = useSharedValue(0);

  useEffect(() => {
    if (dragging.get()) return;
    last.set(index);
    position.set(reduced ? index : withTiming(index, SNAP));
  }, [index, reduced, dragging, last, position]);

  // Rebuilt when onChange changes; Gesture Handler updates the attached handlers in place.
  const { min, step: stepSize } = range;
  const gesture = useMemo(() => {
    const moveTo = (x: number) => {
      'worklet';
      const i = indexAt(x, trackWidth.get(), count);
      if (i === last.get()) return;
      last.set(i);
      position.set(reduced ? i : withTiming(i, SNAP));
      scheduleOnRN(onChange, min + i * stepSize);
    };
    const pan = Gesture.Pan()
      .activeOffsetX([-6, 6])
      .failOffsetY([-10, 10])
      .onStart((e) => {
        dragging.set(true);
        lifted.set(reduced ? 1 : withTiming(1, SNAP));
        moveTo(e.x);
      })
      .onUpdate((e) => moveTo(e.x))
      .onFinalize(() => {
        dragging.set(false);
        lifted.set(reduced ? 0 : withTiming(0, SNAP));
      });
    const tap = Gesture.Tap().onEnd((e, success) => {
      if (success) moveTo(e.x);
    });
    return Gesture.Race(pan, tap);
  }, [count, min, stepSize, onChange, reduced, trackWidth, last, position, dragging, lifted]);

  const fillStyle = useAnimatedStyle(() => ({
    width: centreOf(position.get(), trackWidth.get(), count),
  }));
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: centreOf(position.get(), trackWidth.get(), count) - THUMB / 2 },
      { scale: 1 + 0.1 * lifted.get() },
    ],
  }));

  const step = (event: AccessibilityActionEvent) => {
    const delta = event.nativeEvent.actionName === 'increment' ? 1 : event.nativeEvent.actionName === 'decrement' ? -1 : 0;
    const next = Math.max(0, Math.min(count - 1, index + delta));
    if (next !== index) onChange(range.min + next * range.step);
  };

  return (
    <View style={[{ gap: 10 }, style]}>
      <SliderValue icon={icon}>{format(value)}</SliderValue>
      <GestureDetector gesture={gesture}>
        <View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={label}
          accessibilityValue={{ min: range.min, max: range.max, now: value, text: format(value) }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={step}
          onLayout={(event) => {
            const w = event.nativeEvent.layout.width;
            trackWidth.set(w);
            setWidth(w);
          }}
          style={{ height: SLIDER_HEIGHT }}>
          <Track />
          <Animated.View pointerEvents="none" style={[trackStyles.fill, { left: 0, backgroundColor: colors.accent }, fillStyle]} />
          <Ticks range={range} marks={marks} width={width} lit={(v) => v <= value} on={(v) => v === value} />
          <Animated.View
            pointerEvents="none"
            style={[
              trackStyles.thumb,
              shadows[1],
              { backgroundColor: colors.surfaceCard, borderColor: colors.accent, opacity: width > 0 ? 1 : 0 },
              thumbStyle,
            ]}
          />
        </View>
      </GestureDetector>
    </View>
  );
}
