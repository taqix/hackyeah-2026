import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { type Edge, SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

export type ScreenProps = {
  children: ReactNode;
  /**
   * Safe-area edges to pad. Bottom is left out by default: Content and
   * BottomBar add the bottom inset themselves so scrolled content runs under
   * the home indicator.
   */
  edges?: readonly Edge[];
  style?: StyleProp<ViewStyle>;
};

/** Every screen's root: flat paper background, safe-area padding, status bar matching the theme. */
export function Screen({ children, edges = ['top', 'left', 'right'], style }: ScreenProps) {
  const { colors, scheme } = useTheme();
  return (
    <SafeAreaView edges={edges} style={[{ flex: 1, backgroundColor: colors.bgApp }, style]}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      {children}
    </SafeAreaView>
  );
}
