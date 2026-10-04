import { type ReactNode, useState } from 'react';
import { Platform, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';

import { useTheme } from '@/theme';

import { FOCUS_RING_OFFSET, FOCUS_RING_WIDTH } from './focus-ring';
import { focusIsVisible, noBrowserOutline } from './focus-visible';
import { webStyle } from './web-style';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const IS_WEB = Platform.OS === 'web';

/** What a press changes eases in; on the web a hover's lift, shadow and fade do too. */
const TRANSITION_PROPERTY: ('transform' | 'backgroundColor' | 'borderColor' | 'boxShadow' | 'opacity')[] = IS_WEB
  ? ['transform', 'backgroundColor', 'borderColor', 'boxShadow', 'opacity']
  : ['transform', 'backgroundColor', 'borderColor'];

/*
 * Web cursors. React Native Web lets a disabled pressable's own box ignore the
 * pointer, so it is given back to show the cursor over the whole control.
 */
const DISABLED_CURSOR = webStyle({ cursor: 'not-allowed', pointerEvents: 'auto' });
const BUSY_CURSOR = webStyle({ cursor: 'progress', pointerEvents: 'auto' });

export type PressState = {
  pressed: boolean;
  /** A mouse is over it on the web (touch never hovers); always false on iOS and Android. */
  hovered: boolean;
  /** Focused from the keyboard on the web (:focus-visible); always false on iOS and Android. */
  focusVisible: boolean;
};

export type PressableScaleProps = Omit<PressableProps, 'style' | 'children'> & {
  /** 0.97 for buttons and chips (default), 0.99 for cards and rows. */
  scaleTo?: number;
  /** Web: rises this many points while hovered, for cards that lift (0, none, by default). */
  lift?: number;
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
 * rounded focus ring instead of the browser's outline, a mouse over it sets
 * `hovered` for the hover step (README › Hover), and the cursor says whether it
 * can be pressed (not-allowed when disabled, progress while `aria-busy`).
 */
export function PressableScale({
  scaleTo,
  lift = 0,
  focusRing = 'outline',
  style,
  children,
  disabled,
  'aria-busy': busy,
  onPressIn,
  onPressOut,
  onHoverIn,
  onHoverOut,
  onFocus,
  onBlur,
  ...rest
}: PressableScaleProps) {
  const { colors, motion } = useTheme();
  const reduced = useReducedMotion();
  const [pressed, setPressed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focusVisible, setFocusVisible] = useState(false);
  const inactive = disabled === true;
  const state: PressState = { pressed, hovered: hovered && !inactive, focusVisible };
  const scale = pressed && !reduced ? (scaleTo ?? motion.pressScale) : 1;
  // A held card settles back down; reduced motion keeps it still.
  const rise = state.hovered && !pressed && !reduced ? lift : 0;
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
      disabled={disabled}
      aria-busy={busy}
      onPressIn={(event) => {
        setPressed(true);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        setPressed(false);
        onPressOut?.(event);
      }}
      // Hover is a web state: iOS and Android get the caller's handlers untouched.
      onHoverIn={
        IS_WEB
          ? (event) => {
              setHovered(true);
              onHoverIn?.(event);
            }
          : onHoverIn
      }
      onHoverOut={
        IS_WEB
          ? (event) => {
              setHovered(false);
              onHoverOut?.(event);
            }
          : onHoverOut
      }
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
        IS_WEB ? focusStyle : null,
        busy ? BUSY_CURSOR : inactive ? DISABLED_CURSOR : null,
        {
          transform: IS_WEB && lift ? [{ translateY: -rise }, { scale }] : [{ scale }],
          transitionProperty: TRANSITION_PROPERTY,
          transitionDuration: reduced ? 0 : motion.durFast,
          transitionTimingFunction: cubicBezier(...motion.easeOut),
        },
      ]}>
      {typeof children === 'function' ? children(state) : children}
    </AnimatedPressable>
  );
}
