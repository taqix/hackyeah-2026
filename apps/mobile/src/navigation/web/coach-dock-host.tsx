import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';

import { useSession } from '@/api/hooks';
import { ChatPanel } from '@/features/chat/panel';
import { useTheme } from '@/theme';

import { useCoachDock } from './coach-dock';
import { DOCK_WIDTH, DRAWER_WIDTH, MAIN_MIN, SHELL_INSET, SIDEBAR_WIDTH } from './shell-metrics';
import { usePresence } from './use-presence';

/** DOM ids: Escape closes the dock while focus is inside, opening it focuses its message box, CSS styles the grip. */
export const COACH_DOCK_ID = 'movo-coach-dock';
export const COACH_DOCK_RESIZE_ID = 'movo-coach-dock-resize';

const SLIDE_MS = 280;

/** Escape closes the dock (the drawer from anywhere, the column while focus is in it); focus moves in and back out. */
function useDockKeyboard(mode: CoachDockHostProps['mode']) {
  const { open, openKey, hide } = useCoachDock();
  const returnTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      const inside = document.getElementById(COACH_DOCK_ID)?.contains(document.activeElement) ?? false;
      if (mode === 'docked' && !inside) return;
      event.preventDefault();
      hide();
    };
    // Capture: the drawer sits over everything, so it closes before a dialog under it would.
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [open, mode, hide]);

  useEffect(() => {
    const node = document.getElementById(COACH_DOCK_ID);
    if (open) {
      const active = document.activeElement;
      if (active instanceof HTMLElement && !node?.contains(active)) returnTo.current = active;
      // A touch screen would raise its keyboard over the panel: only a mouse or keyboard gets the box focused.
      if (!window.matchMedia('(pointer: fine)').matches) return undefined;
      const timer = setTimeout(() => node?.querySelector<HTMLElement>('textarea, input')?.focus({ preventScroll: true }), 60);
      return () => clearTimeout(timer);
    }
    const lost = document.activeElement === document.body || (node?.contains(document.activeElement) ?? false);
    if (lost && returnTo.current?.isConnected) returnTo.current.focus({ preventScroll: true });
    returnTo.current = null;
    return undefined;
  }, [open, openKey]);
}

export type CoachDockHostProps = {
  /** 'docked': a column beside the page (wide windows). 'drawer': slides over the dimmed page (medium ones). */
  mode: 'docked' | 'drawer';
  /** The docked column's width, as last dragged. */
  width: number;
  onResize: (width: number) => void;
};

/**
 * Where the coach lives on the desktop web: the chat panel in a floating card,
 * docked beside the page on wide windows (the page narrows; drag its edge to
 * resize) or sliding over it on medium ones. The panel mounts on the first
 * open and stays, so the draft and the thread survive closing it, and it
 * keeps its place when the window crosses between the two.
 */
export function CoachDockHost({ mode, width, onResize }: CoachDockHostProps) {
  const { colors, shadows, motion } = useTheme();
  const reduced = useReducedMotion();
  const dock = useCoachDock();
  const session = useSession();
  const viewport = useWindowDimensions();
  const duration = reduced ? 1 : SLIDE_MS;
  const { shown, entered } = usePresence(dock.open, duration);
  const [mounted, setMounted] = useState(dock.open);
  if (dock.open && !mounted) setMounted(true);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ startX: number; startWidth: number } | null>(null);
  useDockKeyboard(mode);

  const drawer = mode === 'drawer';
  const maxWidth = Math.max(DOCK_WIDTH.min, Math.min(DOCK_WIDTH.max, viewport.width - SIDEBAR_WIDTH.rail - MAIN_MIN));
  const columnWidth = Math.min(Math.max(width, DOCK_WIDTH.min), maxWidth);
  const drawerWidth = Math.min(DRAWER_WIDTH, viewport.width - SIDEBAR_WIDTH.rail - SHELL_INSET * 2);
  const easing = cubicBezier(...motion.easeInOut);

  useEffect(() => {
    if (!dragging) return undefined;
    // The page's text would be selected as the pointer sweeps over it.
    const previous = document.body.style.userSelect;
    document.body.style.userSelect = 'none';
    return () => {
      document.body.style.userSelect = previous;
    };
  }, [dragging]);

  const endDrag = () => {
    drag.current = null;
    setDragging(false);
  };

  return (
    <>
      {drawer ? (
        <Animated.View
          style={[
            styles.backdrop,
            {
              display: shown ? 'flex' : 'none',
              backgroundColor: colors.overlay,
              opacity: entered ? 1 : 0,
              transitionProperty: 'opacity',
              transitionDuration: duration,
              transitionTimingFunction: easing,
            },
          ]}>
          <Pressable accessible={false} focusable={false} onPress={dock.hide} style={StyleSheet.absoluteFill} />
        </Animated.View>
      ) : null}
      <Animated.View
        nativeID={COACH_DOCK_ID}
        role={drawer ? 'dialog' : 'complementary'}
        aria-modal={drawer}
        aria-label="Coach"
        style={
          drawer
            ? [
                styles.drawer,
                {
                  width: drawerWidth,
                  display: shown ? 'flex' : 'none',
                  transform: [{ translateX: entered ? 0 : drawerWidth + SHELL_INSET * 2 }],
                  transitionProperty: 'transform',
                  transitionDuration: duration,
                  transitionTimingFunction: easing,
                },
              ]
            : [
                styles.column,
                {
                  width: entered ? columnWidth + SHELL_INSET : 0,
                  display: shown ? 'flex' : 'none',
                  transitionProperty: 'width',
                  transitionDuration: dragging ? 0 : duration,
                  transitionTimingFunction: easing,
                },
              ]
        }>
        <View style={drawer ? styles.fill : [styles.columnInner, { width: columnWidth + SHELL_INSET }]}>
          <View
            style={[
              styles.card,
              shadows[drawer ? 3 : 2],
              { backgroundColor: colors.bgApp, borderColor: colors.borderSubtle },
            ]}>
            {mounted ? (
              <ChatPanel
                key={session.data?.user.id ?? 'signed-out'}
                params={dock.params}
                openKey={dock.openKey}
                variant="dock"
                onClose={dock.hide}
              />
            ) : null}
          </View>
          {drawer ? null : (
            <View
              nativeID={COACH_DOCK_RESIZE_ID}
              aria-hidden
              onStartShouldSetResponder={() => true}
              onResponderTerminationRequest={() => false}
              onResponderGrant={(event) => {
                drag.current = { startX: event.nativeEvent.pageX, startWidth: columnWidth };
                setDragging(true);
              }}
              onResponderMove={(event) => {
                const start = drag.current;
                if (!start) return;
                const next = start.startWidth + start.startX - event.nativeEvent.pageX;
                onResize(Math.min(Math.max(next, DOCK_WIDTH.min), maxWidth));
              }}
              onResponderRelease={endDrag}
              onResponderTerminate={endDrag}
              style={styles.handle}>
              <View style={[styles.grip, { backgroundColor: dragging ? colors.accent : colors.borderStrong }]} />
            </View>
          )}
        </View>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 20,
  },
  drawer: {
    position: 'absolute',
    top: SHELL_INSET,
    bottom: SHELL_INSET,
    right: SHELL_INSET,
    zIndex: 21,
  },
  column: {
    // The card keeps its width while the column opens, so it slides in from the window's edge.
    alignItems: 'flex-end',
    overflow: 'hidden',
    zIndex: 3,
  },
  columnInner: {
    flex: 1,
    paddingVertical: SHELL_INSET,
    paddingRight: SHELL_INSET,
  },
  fill: { flex: 1 },
  card: {
    flex: 1,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
  },
  handle: {
    position: 'absolute',
    left: 0,
    top: SHELL_INSET + 32,
    bottom: SHELL_INSET + 32,
    width: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Shown while hovered or held, by the global stylesheet (app/+html.tsx).
  grip: {
    width: 4,
    height: 40,
    borderRadius: 2,
  },
});
