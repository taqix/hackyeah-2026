import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

/** '#RRGGBB' → 'rgba(r,g,b,a)': a fade must end in the page colour, not transparent black. */
function withAlpha(hex: string, alpha: number) {
  const n = parseInt(hex.slice(1, 7), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

export type BottomBarProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * Sticky bottom actions over the scroll: a short fade to the page colour, then
 * a row of buttons (gap 12). Pair with <Content bottomInset="bottomBar">.
 * Never on a screen with the tab bar.
 */
export function BottomBar({ children, style }: BottomBarProps) {
  const { colors, layout } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.bar,
        { paddingHorizontal: layout.gutter, paddingBottom: Math.max(insets.bottom, 20) },
        style,
      ]}>
      <LinearGradient
        pointerEvents="none"
        colors={[withAlpha(colors.bgApp, 0), colors.bgApp, colors.bgApp]}
        locations={[0, 0.3, 1]}
        style={StyleSheet.absoluteFill}
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
