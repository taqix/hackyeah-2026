import { type ReactNode, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';

import { LayoutScope } from '@/components/layout';
import { noBrowserOutline } from '@/components/ui';
import { useTheme } from '@/theme';

export type DialogSize = 'sm' | 'md';

const WIDTH: Record<DialogSize, number> = { sm: 560, md: 640 };
const MAX_HEIGHT = 860;
/** Air around the dialog inside the page area. */
const MARGIN = 32;

const FADE_IN = { from: { opacity: 0 }, to: { opacity: 1 } };
const RISE_IN = {
  from: { opacity: 0, transform: [{ translateY: 14 }, { scale: 0.98 }] },
  to: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
};

export type RouteDialogProps = {
  size: DialogSize;
  /** Show it as a dialog over the page (desktop widths); otherwise the screen fills the page as before. */
  framed: boolean;
  /** Closes it: the route goes back to the page under it. */
  onDismiss: () => void;
  /** Whether this route is the top of the stack: Escape closes only that one. */
  isTop: () => boolean;
  children: ReactNode;
};

/**
 * A root-stack route as a centred dialog over the page it was opened from,
 * on the desktop web: the page dims, a click on it or Escape goes back, and
 * the screen inside keeps its phone layout (a phone-sized card). The views
 * are the same in both looks, so crossing the breakpoint never remounts the
 * screen.
 */
export function RouteDialog({ size, framed, onDismiss, isTop, children }: RouteDialogProps) {
  const { colors, shadows, motion } = useTheme();
  const reduced = useReducedMotion();
  const { height } = useWindowDimensions();
  const card = useRef<View>(null);

  useEffect(() => {
    if (!framed) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || !isTop()) return;
      event.preventDefault();
      onDismiss();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [framed, isTop, onDismiss]);

  // Keyboard and screen-reader users start inside the dialog.
  useEffect(() => {
    const node: unknown = card.current;
    if (framed && typeof HTMLElement !== 'undefined' && node instanceof HTMLElement) node.focus({ preventScroll: true });
  }, [framed]);

  const animation = { animationDuration: reduced ? 1 : motion.durSlow, animationTimingFunction: cubicBezier(...motion.easeOut) };

  return (
    <View style={styles.fill}>
      {framed ? (
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay, animationName: FADE_IN }, animation]}>
          <Pressable accessible={false} focusable={false} onPress={onDismiss} style={StyleSheet.absoluteFill} />
        </Animated.View>
      ) : null}
      <View style={framed ? styles.center : styles.fill}>
        <Animated.View
          ref={card}
          role={framed ? 'dialog' : undefined}
          aria-modal={framed}
          tabIndex={framed ? -1 : undefined}
          style={
            framed
              ? [
                  styles.card,
                  shadows[3],
                  noBrowserOutline,
                  {
                    width: WIDTH[size],
                    height: Math.min(MAX_HEIGHT, height - MARGIN * 2),
                    backgroundColor: colors.bgApp,
                    borderColor: colors.borderSubtle,
                    animationName: RISE_IN,
                  },
                  animation,
                ]
              : styles.fill
          }>
          <LayoutScope mode="compact">{children}</LayoutScope>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: MARGIN,
    pointerEvents: 'box-none',
  },
  card: {
    maxWidth: '100%',
    borderRadius: 28,
    borderWidth: 1,
    overflow: 'hidden',
  },
});
