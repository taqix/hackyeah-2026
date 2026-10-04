import { type ReactNode, useState } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';

import { useTheme } from '@/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type PressState = { pressed: boolean };

export type PressableScaleProps = Omit<PressableProps, 'style' | 'children'> & {
  /** 0.97 for buttons and chips (default), 0.99 for cards and rows. */
  scaleTo?: number;
  style?: StyleProp<ViewStyle> | ((state: PressState) => StyleProp<ViewStyle>);
  children?: ReactNode | ((state: PressState) => ReactNode);
};

/**
 * Pressable that shrinks slightly while held (README › Press). The pressed flag
 * also drives colour changes through a short CSS transition; under reduced
 * motion the scale is skipped.
 */
export function PressableScale({
  scaleTo,
  style,
  children,
  onPressIn,
  onPressOut,
  ...rest
}: PressableScaleProps) {
  const { motion } = useTheme();
  const reduced = useReducedMotion();
  const [pressed, setPressed] = useState(false);
  const state = { pressed };
  const scale = pressed && !reduced ? (scaleTo ?? motion.pressScale) : 1;
  const resolved = typeof style === 'function' ? style(state) : style;

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
      style={[
        resolved,
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
