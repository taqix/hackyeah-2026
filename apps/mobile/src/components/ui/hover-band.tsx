import { Platform, type StyleProp, StyleSheet, type ViewStyle } from 'react-native';
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';

import { useTheme } from '@/theme';

/** How far the band reaches past the row's content on each side. */
const REACH = 12;

/** The row's own start and end padding, read from its style (a number, or none). */
function paddingOf(style: StyleProp<ViewStyle>): [number, number] {
  const flat = StyleSheet.flatten(style) ?? {};
  const first = (...values: unknown[]) => values.find((value): value is number => typeof value === 'number') ?? 0;
  return [
    first(flat.paddingLeft, flat.paddingStart, flat.paddingHorizontal, flat.padding),
    first(flat.paddingRight, flat.paddingEnd, flat.paddingHorizontal, flat.padding),
  ];
}

export type HoverBandProps = {
  visible: boolean;
  /** The row's style, for its horizontal padding. */
  rowStyle?: StyleProp<ViewStyle>;
  /** Stop at the row's end edge (a control sits there) instead of reaching past the content. */
  flushEnd?: boolean;
};

/**
 * The web hover step of a row without a fill (ListRow, ExerciseRow): a soft
 * rounded wash behind it that reaches 12 points past the content, into the
 * gutter or the card's padding, and fades in. It sits under the row's content
 * and takes no space. Nothing on iOS and Android.
 */
export function HoverBand({ visible, rowStyle, flushEnd = false }: HoverBandProps) {
  const { colors, radius, motion } = useTheme();
  const reduced = useReducedMotion();
  if (Platform.OS !== 'web') return null;
  const [start, end] = paddingOf(rowStyle);
  return (
    <Animated.View
      aria-hidden
      style={[
        styles.band,
        {
          left: start - REACH,
          right: flushEnd ? 0 : end - REACH,
          borderRadius: radius.sm,
          backgroundColor: colors.hoverWash,
          opacity: visible ? 1 : 0,
          transitionProperty: 'opacity',
          transitionDuration: reduced ? 0 : motion.durFast,
          transitionTimingFunction: cubicBezier(...motion.easeOut),
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  band: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    // Under the row's content: the pressable's scale makes the row its own stacking context.
    zIndex: -1,
    pointerEvents: 'none',
  },
});
