import { type ReactNode, type Ref, useEffect, useRef } from 'react';
import { Keyboard, Platform, type ScrollViewProps, type StyleProp, TextInput, View, type ViewStyle } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

import { useBottomBarPadding } from './bottom-bar';
import { useKeyboardLifted } from './keyboard-avoider';

/** Space to leave for a BottomBar above its safe-area padding: 20 fade + 56 button + 36 air. */
export const BOTTOM_BAR_CLEARANCE = 112;

/** Room kept under a focused field when it is scrolled above the keyboard or a bottom bar. */
const REVEAL_MARGIN = 16;

export type BottomInset = 'safe' | 'tabBar' | 'bottomBar' | number;

export type ContentProps = Omit<ScrollViewProps, 'contentContainerStyle' | 'children'> & {
  children: ReactNode;
  /** Space between sections; 24 by default. */
  gap?: number;
  /**
   * What sits under the content: nothing but the home indicator ('safe',
   * default), the floating tab bar, a BottomBar, or a fixed number of points.
   */
  bottomInset?: BottomInset;
  /** false renders a plain View with the same padding (fixed screens). */
  scroll?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  ref?: Ref<ScrollView>;
};

/**
 * The screen body: gutter 20, 8 at the top, stacked sections, clearance at the
 * bottom. Screen ends it at the keyboard's top while the keyboard is up; then
 * the focused field is scrolled into view, clear of a bottom bar.
 */
export function Content({
  children,
  gap = 24,
  bottomInset = 'safe',
  scroll = true,
  contentContainerStyle,
  style,
  ref,
  onLayout,
  ...rest
}: ContentProps) {
  const { layout } = useTheme();
  const insets = useSafeAreaInsets();
  const lifted = useKeyboardLifted();
  const barPadding = useBottomBarPadding();
  const reduced = useReducedMotion();
  const scrollRef = useRef<ScrollView | null>(null);
  const viewport = useRef(0);

  const bottom =
    typeof bottomInset === 'number'
      ? bottomInset
      : bottomInset === 'tabBar'
        ? layout.tabBarClearance + Math.max(0, insets.bottom - 24)
        : bottomInset === 'bottomBar'
          ? BOTTOM_BAR_CLEARANCE + barPadding
          : (lifted ? 0 : insets.bottom) + 24;
  // What covers the end of the viewport: the bar the bottom padding makes room for.
  const cover = bottomInset === 'safe' ? 0 : bottom;
  const padding: ViewStyle = { paddingHorizontal: layout.gutter, paddingTop: 8, paddingBottom: bottom, gap };

  /** Scrolls the focused field (if it is in this scroll view) above the keyboard and any bottom bar. */
  const revealFocused = () => {
    const view = scrollRef.current;
    const frame = view?.getNativeScrollRef();
    if (Platform.OS === 'web' || !view || !frame) return;
    const input = TextInput.State.currentlyFocusedInput();
    if (!input) return;
    input.measureLayout(
      view.getInnerViewNode(),
      (_left, top, _width, height) =>
        input.measureInWindow((_x, inputY) =>
          frame.measureInWindow((_frameX, frameY, _frameWidth, frameHeight) => {
            // Where the field sits in the content against where it shows gives the scroll offset.
            const scrolled = frameY + top - inputY;
            const visible = frameHeight - cover;
            const end = top + height + REVEAL_MARGIN;
            if (visible > 0 && end > scrolled + visible) view.scrollTo({ y: end - visible, animated: !reduced });
          }),
        ),
      // Not inside this scroll view: nothing to reveal.
      () => undefined,
    );
  };

  // Each time the keyboard comes up (or changes, on Android), after Screen has made room for it.
  useEffect(() => {
    if (!scroll || Platform.OS === 'web') return undefined;
    const subscription = Keyboard.addListener('keyboardDidShow', () => requestAnimationFrame(revealFocused));
    return () => subscription.remove();
  });

  if (!scroll) {
    return <View style={[{ flex: 1 }, padding, style, contentContainerStyle]}>{children}</View>;
  }
  return (
    <ScrollView
      ref={(node: ScrollView | null) => {
        scrollRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
      }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      showsVerticalScrollIndicator={false}
      {...rest}
      onLayout={(event) => {
        const height = event.nativeEvent.layout.height;
        const shrank = height < viewport.current;
        viewport.current = height;
        // The keyboard just took room from the screen.
        if (shrank && Keyboard.isVisible()) revealFocused();
        onLayout?.(event);
      }}
      style={[{ flex: 1 }, style]}
      contentContainerStyle={[padding, contentContainerStyle]}>
      {children}
    </ScrollView>
  );
}
