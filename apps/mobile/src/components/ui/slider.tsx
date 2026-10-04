import { useEffect, useMemo, useRef, useState } from 'react';
import { type AccessibilityActionEvent, Platform, type StyleProp, View, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useTheme } from '@/theme';

import { noBrowserOutline } from './focus-visible';
import type { IconName } from './icon';
import {
  centreOf,
  indexAt,
  indexOf,
  keyStep,
  SLIDER_HEIGHT,
  type SliderRange,
  SliderValue,
  stepCount,
  THUMB,
  thumbFocus,
  Ticks,
  Track,
  TRACK_CURSOR,
  trackStyles,
} from './slider-parts';
import { useWebKeyboard } from './web-keyboard';

const IS_WEB = Platform.OS === 'web';

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
 * get one adjustable element with increment/decrement. On the web the mouse
 * drags or clicks the same way, and the slider is a tab stop: arrow keys step,
 * Page Up/Down jump, Home/End go to the ends, and the thumb shows the ring.
 */
export function Slider({ label, icon, range, value, onChange, format = String, marks, style }: SliderProps) {
  const { colors, shadows } = useTheme();
  const reduced = useReducedMotion();
  const count = stepCount(range);
  const index = indexOf(range, value);
  const [width, setWidth] = useState(0);
  const [focusVisible, setFocusVisible] = useState(false);
  const slider = useRef<View>(null);

  useWebKeyboard(slider, {
    onKeyDown: (event) => {
      const next = keyStep(event.key, index, count);
      if (next === null) return;
      event.preventDefault();
      if (next !== index) onChange(range.min + next * range.step);
    },
    onFocusVisibleChange: setFocusVisible,
  });

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
          ref={slider}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={label}
          accessibilityValue={{ min: range.min, max: range.max, now: value, text: format(value) }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={step}
          // React Native Web reads the value from aria-* only, and needs the tab stop spelled out.
          tabIndex={IS_WEB ? 0 : undefined}
          aria-valuemin={IS_WEB ? range.min : undefined}
          aria-valuemax={IS_WEB ? range.max : undefined}
          aria-valuenow={IS_WEB ? value : undefined}
          aria-valuetext={IS_WEB ? format(value) : undefined}
          onLayout={(event) => {
            const w = event.nativeEvent.layout.width;
            trackWidth.set(w);
            setWidth(w);
          }}
          style={[{ height: SLIDER_HEIGHT }, noBrowserOutline, TRACK_CURSOR]}>
          <Track />
          <Animated.View style={[trackStyles.fill, { pointerEvents: 'none', left: 0, backgroundColor: colors.accent }, fillStyle]} />
          <Ticks range={range} marks={marks} width={width} lit={(v) => v <= value} on={(v) => v === value} />
          <Animated.View
            style={[
              trackStyles.thumb,
              { pointerEvents: 'none' },
              shadows[1],
              { backgroundColor: colors.surfaceCard, borderColor: colors.accent, opacity: width > 0 ? 1 : 0 },
              thumbFocus(colors, focusVisible),
              thumbStyle,
            ]}
          />
        </View>
      </GestureDetector>
    </View>
  );
}
