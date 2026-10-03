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

export type RangeValue = readonly [number, number];

export type RangeSliderProps = {
  /** Names the group ("Time of day"); each thumb reads "<thumb label> <label>". */
  label: string;
  icon?: IconName;
  range: SliderRange;
  value: RangeValue;
  onChange: (value: [number, number]) => void;
  /** The window spelled out above the track; the caller decides how the full range reads ("Any time"). */
  format: (value: RangeValue) => string;
  /** One end for screen readers ("7:00"). */
  formatValue?: (value: number) => string;
  /** Names of the two thumbs. */
  thumbLabels?: readonly [string, string];
  marks?: readonly number[];
  style?: StyleProp<ViewStyle>;
};

const SNAP = { duration: 90 };
const NONE = -1;

/**
 * A window on one track (onboarding RangeSlider): two thumbs, whole steps, at
 * least one step apart. A drag or tap moves the nearer thumb. Each thumb is
 * its own adjustable element for screen readers.
 */
export function RangeSlider({
  label,
  icon,
  range,
  value,
  onChange,
  format,
  formatValue = String,
  thumbLabels = ['Earliest', 'Latest'],
  marks,
  style,
}: RangeSliderProps) {
  const { colors, shadows } = useTheme();
  const reduced = useReducedMotion();
  const count = stepCount(range);
  const [a, b] = value;
  const ia = indexOf(range, a);
  const ib = Math.max(ia + 1, indexOf(range, b));
  const [width, setWidth] = useState(0);

  const trackWidth = useSharedValue(0);
  const startIndex = useSharedValue(ia);
  const endIndex = useSharedValue(ib);
  const startPos = useSharedValue(ia);
  const endPos = useSharedValue(ib);
  const active = useSharedValue(NONE);
  const dragging = useSharedValue(false);

  useEffect(() => {
    if (dragging.get()) return;
    startIndex.set(ia);
    endIndex.set(ib);
    startPos.set(reduced ? ia : withTiming(ia, SNAP));
    endPos.set(reduced ? ib : withTiming(ib, SNAP));
  }, [ia, ib, reduced, dragging, startIndex, endIndex, startPos, endPos]);

  // Rebuilt when onChange changes; Gesture Handler updates the attached handlers in place.
  const { min, step: stepSize } = range;
  const gesture = useMemo(() => {
    const pick = (x: number) => {
      'worklet';
      const w = trackWidth.get();
      const ca = centreOf(startIndex.get(), w, count);
      const cb = centreOf(endIndex.get(), w, count);
      if (x <= ca) return 0;
      if (x >= cb) return 1;
      return Math.abs(x - ca) <= Math.abs(x - cb) ? 0 : 1;
    };
    const moveTo = (which: number, x: number) => {
      'worklet';
      const raw = indexAt(x, trackWidth.get(), count);
      if (which === 0) {
        const i = Math.max(0, Math.min(raw, endIndex.get() - 1));
        if (i === startIndex.get()) return;
        startIndex.set(i);
        startPos.set(reduced ? i : withTiming(i, SNAP));
      } else {
        const j = Math.min(count - 1, Math.max(raw, startIndex.get() + 1));
        if (j === endIndex.get()) return;
        endIndex.set(j);
        endPos.set(reduced ? j : withTiming(j, SNAP));
      }
      scheduleOnRN(onChange, [min + startIndex.get() * stepSize, min + endIndex.get() * stepSize] as [number, number]);
    };
    const pan = Gesture.Pan()
      .activeOffsetX([-6, 6])
      .failOffsetY([-10, 10])
      .onStart((e) => {
        dragging.set(true);
        const which = pick(e.x - e.translationX);
        active.set(which);
        moveTo(which, e.x);
      })
      .onUpdate((e) => {
        if (active.get() !== NONE) moveTo(active.get(), e.x);
      })
      .onFinalize(() => {
        dragging.set(false);
        active.set(NONE);
      });
    const tap = Gesture.Tap().onEnd((e, success) => {
      if (success) moveTo(pick(e.x), e.x);
    });
    return Gesture.Race(pan, tap);
  }, [count, min, stepSize, onChange, reduced, trackWidth, startIndex, endIndex, startPos, endPos, active, dragging]);

  const fillStyle = useAnimatedStyle(() => {
    const w = trackWidth.get();
    const left = centreOf(startPos.get(), w, count);
    return { left, width: Math.max(0, centreOf(endPos.get(), w, count) - left) };
  });
  const startStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: centreOf(startPos.get(), trackWidth.get(), count) - THUMB / 2 },
      { scale: active.get() === 0 && !reduced ? 1.1 : 1 },
    ],
  }));
  const endStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: centreOf(endPos.get(), trackWidth.get(), count) - THUMB / 2 },
      { scale: active.get() === 1 && !reduced ? 1.1 : 1 },
    ],
  }));

  const adjust = (which: 0 | 1) => (event: AccessibilityActionEvent) => {
    const name = event.nativeEvent.actionName;
    const delta = name === 'increment' ? 1 : name === 'decrement' ? -1 : 0;
    if (!delta) return;
    const i = which === 0 ? Math.max(0, Math.min(ib - 1, ia + delta)) : ia;
    const j = which === 1 ? Math.min(count - 1, Math.max(ia + 1, ib + delta)) : ib;
    if (i !== ia || j !== ib) onChange([range.min + i * range.step, range.min + j * range.step]);
  };

  const mid = (count - 1) / 2;
  const thumbBase = [
    trackStyles.thumb,
    shadows[1],
    { backgroundColor: colors.surfaceCard, borderColor: colors.accent, opacity: width > 0 ? 1 : 0 },
  ];
  const actions = [{ name: 'increment' }, { name: 'decrement' }];
  const lower = label.toLowerCase();

  return (
    <View style={[{ gap: 10 }, style]}>
      <SliderValue icon={icon}>{format(value)}</SliderValue>
      <GestureDetector gesture={gesture}>
        <View
          role="group"
          accessibilityLabel={label}
          onLayout={(event) => {
            const w = event.nativeEvent.layout.width;
            trackWidth.set(w);
            setWidth(w);
          }}
          style={{ height: SLIDER_HEIGHT }}>
          <Track />
          <Animated.View pointerEvents="none" style={[trackStyles.fill, { backgroundColor: colors.accent }, fillStyle]} />
          <Ticks
            range={range}
            marks={marks}
            width={width}
            lit={(v) => v >= a && v <= b}
            on={(v) => v === a || v === b}
          />
          <Animated.View
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={`${thumbLabels[0]} ${lower}`}
            accessibilityValue={{ min: range.min, max: range.max, now: a, text: formatValue(a) }}
            accessibilityActions={actions}
            onAccessibilityAction={adjust(0)}
            style={[thumbBase, { zIndex: ia > mid ? 3 : 2 }, startStyle]}
          />
          <Animated.View
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={`${thumbLabels[1]} ${lower}`}
            accessibilityValue={{ min: range.min, max: range.max, now: b, text: formatValue(b) }}
            accessibilityActions={actions}
            onAccessibilityAction={adjust(1)}
            style={[thumbBase, { zIndex: ib < mid ? 3 : 2 }, endStyle]}
          />
        </View>
      </GestureDetector>
    </View>
  );
}
