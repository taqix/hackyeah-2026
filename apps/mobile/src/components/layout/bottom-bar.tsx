import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

import { useBottomEdgePadding } from './keyboard-avoider';

/** '#RRGGBB' → 'rgba(r,g,b,a)': a fade must end in the page colour, not transparent black. */
function withAlpha(hex: string, alpha: number) {
  const n = parseInt(hex.slice(1, 7), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

export type BottomBarProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** The BottomBar's padding under its buttons: the home indicator, or a small gap over the keyboard. */
export function useBottomBarPadding(): number {
  return useBottomEdgePadding(20);
}

/**
 * Sticky bottom actions over the scroll: a short fade to the page colour, then
 * a row of buttons (gap 12). Pair with <Content bottomInset="bottomBar">.
 * While the keyboard is up it rides on top of it (Screen's KeyboardAvoider).
 * Never on a screen with the tab bar.
 */
export function BottomBar({ children, style }: BottomBarProps) {
  const { colors, layout } = useTheme();
  const paddingBottom = useBottomBarPadding();
  return (
    <View
      style={[
        styles.bar,
        { pointerEvents: 'box-none' },
        { paddingHorizontal: layout.gutter, paddingBottom },
        style,
      ]}>
      <LinearGradient
        colors={[withAlpha(colors.bgApp, 0), colors.bgApp, colors.bgApp]}
        locations={[0, 0.3, 1]}
        style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}
      />
      <View style={styles.row}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
});
