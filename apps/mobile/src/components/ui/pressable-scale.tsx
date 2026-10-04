import { type ReactNode, useState } from 'react';
import { Platform, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';

import { useTheme } from '@/theme';

import { FOCUS_RING_OFFSET, FOCUS_RING_WIDTH } from './focus-ring';
import { focusIsVisible, noBrowserOutline } from './focus-visible';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type PressState = {
  pressed: boolean;
  /** Focused from the keyboard on the web (:focus-visible); always false on iOS and Android. */
  focusVisible: boolean;
};

export type PressableScaleProps = Omit<PressableProps, 'style' | 'children'> & {
  /** 0.97 for buttons and chips (default), 0.99 for cards and rows. */
  scaleTo?: number;
  /**
   * Keyboard focus on the web. 'outline' (default) draws the kit's ring around
   * the pressable, following its corners; 'inset' draws it just inside, for a
   * row in a list that clips its children. 'none' hides the browser's outline:
   * the children draw the ring from `focusVisible` (FocusRing), for a pressable
   * whose visible shape is smaller than its touch area.
   */
  focusRing?: 'outline' | 'inset' | 'none';
  style?: StyleProp<ViewStyle> | ((state: PressState) => StyleProp<ViewStyle>);
  children?: ReactNode | ((state: PressState) => ReactNode);
};

/**
 * Pressable that shrinks slightly while held (README › Press). The pressed flag
 * also drives colour changes through a short CSS transition; under reduced
 * motion the scale is skipped. On the web, keyboard focus shows the kit's
 * rounded focus ring instead of the browser's outline.
 */
export function PressableScale({
  scaleTo,
  focusRing = 'outline',
  style,
  children,
  onPressIn,
  onPressOut,
  onFocus,
  onBlur,
  ...rest
}: PressableScaleProps) {
  const { colors, motion } = useTheme();
  const reduced = useReducedMotion();
  const [pressed, setPressed] = useState(false);
  const [focusVisible, setFocusVisible] = useState(false);
  const state = { pressed, focusVisible };
  const scale = pressed && !reduced ? (scaleTo ?? motion.pressScale) : 1;
  const resolved = typeof style === 'function' ? style(state) : style;
  const focusStyle: ViewStyle | null =
    focusRing === 'none'
      ? noBrowserOutline
      : focusVisible
        ? {
            outlineStyle: 'solid',
            outlineWidth: FOCUS_RING_WIDTH,
            outlineOffset: focusRing === 'inset' ? -FOCUS_RING_WIDTH : FOCUS_RING_OFFSET,
            outlineColor: colors.focusRing,
          }
        : null;

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(event) => {
        setPressed(true);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        setPressed(false);
        onPressOut?.(event);
      }}
      onFocus={(event) => {
        setFocusVisible(focusIsVisible(event));
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocusVisible(false);
        onBlur?.(event);
      }}
      style={[
        resolved,
        Platform.OS === 'web' ? focusStyle : null,
        {
          transform: [{ scale }],
          transitionProperty: ['transform', 'backgroundColor', 'borderColor'],
          transitionDuration: reduced ? 0 : motion.durFast,
          transitionTimingFunction: cubicBezier(...motion.easeOut),
        },
      ]}>
      {typeof children === 'function' ? children(state) : children}
    </AnimatedPressable>
  );
}
