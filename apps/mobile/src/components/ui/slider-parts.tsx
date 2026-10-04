import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { type SemanticColors, useTheme } from '@/theme';

import { FOCUS_RING_OFFSET, FOCUS_RING_WIDTH } from './focus-ring';
import { Icon, type IconName } from './icon';
import { Text } from './text';
import { webStyle } from './web-style';

/** Thumb diameter. Its centre stops THUMB/2 short of each end; ticks follow it. */
export const THUMB = 28;
/** Gesture area: 44 for the track row, plus the tick numbers under it. */
export const TRACK_HEIGHT = 44;
export const SLIDER_HEIGHT = 58;
const TRACK_TOP = 19;

export type SliderRange = { min: number; max: number; step: number };

export function stepCount(range: SliderRange) {
  return Math.round((range.max - range.min) / range.step) + 1;
}

export function stepValues(range: SliderRange) {
  return Array.from({ length: stepCount(range) }, (_, i) => range.min + i * range.step);
}

export function indexOf(range: SliderRange, value: number) {
  const last = stepCount(range) - 1;
  return Math.max(0, Math.min(last, Math.round((value - range.min) / range.step)));
}

/** Nearest step index under an x position on the track (UI thread). */
export function indexAt(x: number, width: number, count: number) {
  'worklet';
  const usable = Math.max(1, width - THUMB);
  const f = Math.min(1, Math.max(0, (x - THUMB / 2) / usable));
  return Math.round(f * (count - 1));
}

/** Thumb centre for a step index. */
export function centreOf(index: number, width: number, count: number) {
  'worklet';
  return THUMB / 2 + (count > 1 ? index / (count - 1) : 0) * (width - THUMB);
}

/**
 * The step a key moves a thumb to on the web (WAI-ARIA slider): arrows by one,
 * Page Up and Page Down by a fifth of the scale (at least two), Home and End
 * to the ends. Null for any other key.
 */
export function keyStep(key: string, index: number, count: number): number | null {
  const page = Math.max(2, Math.round((count - 1) / 5));
  const clamp = (next: number) => Math.max(0, Math.min(count - 1, next));
  switch (key) {
    case 'ArrowRight':
    case 'ArrowUp':
      return clamp(index + 1);
    case 'ArrowLeft':
    case 'ArrowDown':
      return clamp(index - 1);
    case 'PageUp':
      return clamp(index + page);
    case 'PageDown':
      return clamp(index - page);
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}

/** The kit's focus ring on a thumb while the slider has keyboard focus (web). */
export function thumbFocus(colors: SemanticColors, visible: boolean): ViewStyle | null {
  return visible
    ? {
        outlineStyle: 'solid',
        outlineWidth: FOCUS_RING_WIDTH,
        outlineOffset: FOCUS_RING_OFFSET,
        outlineColor: colors.focusRing,
      }
    : null;
}

/** The track takes clicks anywhere on it: a pointer cursor says so (web). */
export const TRACK_CURSOR = webStyle({ cursor: 'pointer' });

/** The value spelled out above the track, with its icon. Hidden: the slider reads it out. */
export function SliderValue({ icon, children }: { icon?: IconName; children: ReactNode }) {
  const { colors, fontFamily } = useTheme();
  return (
    <View
      aria-hidden
      style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {icon ? <Icon name={icon} size={18} color={colors.accentText} /> : null}
      <Text tabular style={{ fontFamily: fontFamily.bodySemibold, fontSize: 16, lineHeight: 21, color: colors.accentText }}>
        {children}
      </Text>
    </View>
  );
}

/** The grey track line. */
export function Track() {
  const { colors } = useTheme();
  return <View style={[styles.track, { pointerEvents: 'none', backgroundColor: colors.borderStrong }]} />;
}

export const trackStyles = StyleSheet.create({
  fill: { position: 'absolute', top: TRACK_TOP, height: 6, borderRadius: 3 },
  thumb: {
    position: 'absolute',
    top: TRACK_HEIGHT / 2 - THUMB / 2,
    left: 0,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    borderWidth: 2,
  },
});

type TicksProps = {
  range: SliderRange;
  /** Steps that get a longer tick and their number; every step by default. */
  marks?: readonly number[];
  width: number;
  /** Which ticks sit inside the value. */
  lit: (value: number) => boolean;
  /** Which numbers are the value. */
  on: (value: number) => boolean;
};

/** A tick per step under the track, and numbers at the marks. Decorative. */
export function Ticks({ range, marks, width, lit, on }: TicksProps) {
  const { colors, fontFamily } = useTheme();
  if (width <= 0) return null;
  const steps = stepValues(range);
  const numbered = marks ?? steps;
  const count = steps.length;
  const x = (v: number) => centreOf(indexOf(range, v), width, count);
  return (
    <View aria-hidden style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
      {steps.map((v) => (
        <View
          key={`t${v}`}
          style={{
            position: 'absolute',
            top: 29,
            left: x(v) - 1,
            width: 2,
            height: numbered.includes(v) ? 6 : 4,
            borderRadius: 1,
            backgroundColor: lit(v) ? colors.accent : colors.borderStrong,
          }}
        />
      ))}
      {numbered.map((v) => {
        const active = on(v);
        return (
          <Text
            key={`n${v}`}
            variant="caption"
            tabular
            numberOfLines={1}
            style={{
              position: 'absolute',
              top: 40,
              left: x(v) - 20,
              width: 40,
              textAlign: 'center',
              color: active ? colors.accentText : colors.textTertiary,
              fontFamily: active ? fontFamily.bodySemibold : fontFamily.bodyMedium,
            }}>
            {v}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    position: 'absolute',
    top: TRACK_TOP,
    left: 0,
    right: 0,
    height: 6,
    borderRadius: 3,
  },
});
