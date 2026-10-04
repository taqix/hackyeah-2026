import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  type KeyboardEvent,
  type KeyboardMetrics,
  LayoutAnimation,
  Platform,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const LiftedContext = createContext(false);

/** Air between a bottom bar or message box and the keyboard, in place of the home-indicator inset. */
export const KEYBOARD_GAP = 12;

/** Whether the keyboard is up and the screen around this component was lifted above it. */
export function useKeyboardLifted(): boolean {
  return useContext(LiftedContext);
}

/** Bottom padding for a bar at the screen's foot: the safe area, or a small gap over the keyboard. */
export function useBottomEdgePadding(min: number): number {
  const insets = useSafeAreaInsets();
  return useKeyboardLifted() ? KEYBOARD_GAP : Math.max(insets.bottom, min);
}

/** iOS hands over the keyboard's own duration and curve: move with it. Android has no animation. */
function followKeyboard(event: KeyboardEvent | null) {
  if (Platform.OS !== 'ios' || !event?.duration) return;
  const duration = Math.max(event.duration, 10);
  LayoutAnimation.configureNext({
    duration,
    update: { duration, type: LayoutAnimation.Types[event.easing] ?? LayoutAnimation.Types.keyboard },
  });
}

/**
 * How far the keyboard covers this view, measured in window coordinates so a
 * view inside a page sheet or a sheet's modal gets it right too. The keyboard's
 * top is `screenY`; iOS reports 0 under Prefer Cross-Fade Transitions, which
 * says nothing about the overlap.
 */
function overlap(view: View | null, keyboard: KeyboardMetrics, apply: (lift: number) => void) {
  if (!view || keyboard.screenY <= 0) return;
  view.measureInWindow((_x, y, _width, height) => apply(Math.max(0, Math.round(y + height - keyboard.screenY))));
}

/** Sets the lift once per change, moving with the keyboard on iOS. */
function lifter(current: { current: number }, setLift: (lift: number) => void) {
  return (next: number, event: KeyboardEvent | null) => {
    if (next === current.current) return;
    current.current = next;
    followKeyboard(event);
    setLift(next);
  };
}

export type KeyboardAvoiderProps = {
  children: ReactNode;
  /** Style of the inner view that holds the children and ends at the keyboard's top. */
  style?: StyleProp<ViewStyle>;
};

/**
 * Ends its children at the software keyboard's top while it is up, on iOS and
 * Android alike, so a scroll view inside shrinks and still scrolls to its end,
 * and a bottom bar (absolutely placed at the inner view's foot) rides above
 * the keyboard instead of under it. Android draws edge to edge, so its window
 * no longer shrinks for the keyboard by itself. The browser handles its own
 * keyboard, so on the web this is a plain view.
 *
 * Every Screen has one; a Sheet has its own (its modal is a separate window).
 * Descendants read `useKeyboardLifted()` to drop their home-indicator padding.
 */
export function KeyboardAvoider({ children, style }: KeyboardAvoiderProps) {
  const ref = useRef<View>(null);
  const [lift, setLift] = useState(0);
  const current = useRef(0);

  useEffect(() => {
    if (Platform.OS === 'web') return undefined;
    const ios = Platform.OS === 'ios';
    const apply = lifter(current, setLift);
    const show = (event: KeyboardEvent) => overlap(ref.current, event.endCoordinates, (next) => apply(next, event));
    const hide = (event: KeyboardEvent) => apply(0, event);
    // iOS: the "will" events come with the keyboard's animation. Android only has "did".
    const subscriptions = [
      Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', show),
      Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', hide),
    ];
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, []);

  return (
    <View
      ref={ref}
      style={styles.fill}
      onLayout={() => {
        // A screen opened while the keyboard is already up (Android sends no new event).
        const metrics = Platform.OS !== 'web' && Keyboard.isVisible() ? Keyboard.metrics() : undefined;
        if (metrics) overlap(ref.current, metrics, (next) => lifter(current, setLift)(next, null));
      }}>
      <View style={[styles.fill, { marginBottom: lift }, style]}>
        <LiftedContext value={lift > 0}>{children}</LiftedContext>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Touches pass through to whatever lies behind (a sheet's dim); children still get theirs.
  fill: { flex: 1, pointerEvents: 'box-none' },
});
