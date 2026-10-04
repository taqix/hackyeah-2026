import { type StyleProp, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

import { Text } from './text';

export type KbdProps = {
  /** One key or chord as printed on the keyboard ("Esc", "⌘K", "/"). */
  children: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * A key in a shortcut hint: a small raised chip with a heavier bottom edge.
 * Show it only where the shortcut works (the desktop web); phones have none.
 */
export function Kbd({ children, style }: KbdProps) {
  const { colors, fontFamily, radius } = useTheme();
  return (
    <View
      style={[
        {
          alignSelf: 'flex-start',
          minWidth: 22,
          height: 22,
          paddingHorizontal: 6,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radius.xs - 2,
          borderWidth: 1,
          borderBottomWidth: 2,
          borderColor: colors.borderStrong,
          backgroundColor: colors.surfaceCard,
        },
        style,
      ]}>
      <Text style={{ fontFamily: fontFamily.bodySemibold, fontSize: 11, lineHeight: 14, color: colors.textSecondary }}>
        {children}
      </Text>
    </View>
  );
}
