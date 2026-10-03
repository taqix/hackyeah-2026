import type { ReactNode, Ref } from 'react';
import { type ScrollViewProps, type StyleProp, View, type ViewStyle } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

/** Space to leave for a BottomBar above its safe-area padding: 20 fade + 56 button + 36 air. */
export const BOTTOM_BAR_CLEARANCE = 112;

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

/** The screen body: gutter 20, 8 at the top, stacked sections, clearance at the bottom. */
export function Content({
  children,
  gap = 24,
  bottomInset = 'safe',
  scroll = true,
  contentContainerStyle,
  style,
  ref,
  ...rest
}: ContentProps) {
  const { layout } = useTheme();
  const insets = useSafeAreaInsets();
  const bottom =
    typeof bottomInset === 'number'
      ? bottomInset
      : bottomInset === 'tabBar'
        ? layout.tabBarClearance + Math.max(0, insets.bottom - 24)
        : bottomInset === 'bottomBar'
          ? BOTTOM_BAR_CLEARANCE + Math.max(insets.bottom, 20)
          : insets.bottom + 24;
  const padding: ViewStyle = { paddingHorizontal: layout.gutter, paddingTop: 8, paddingBottom: bottom, gap };

  if (!scroll) {
    return <View style={[{ flex: 1 }, padding, style, contentContainerStyle]}>{children}</View>;
  }
  return (
    <ScrollView
      ref={ref}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets
      showsVerticalScrollIndicator={false}
      {...rest}
      style={[{ flex: 1 }, style]}
      contentContainerStyle={[padding, contentContainerStyle]}>
      {children}
    </ScrollView>
  );
}
