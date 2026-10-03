import type { ReactNode } from 'react';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { Text } from '@/components/ui/text';

export type TopBarProps = {
  left?: ReactNode;
  /** A string renders as a centred subheading; pass a node for anything else. */
  title?: ReactNode;
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** 56 high: back/close at the left, actions at the right, title centred between equal sides. */
export function TopBar({ left, title, right, style }: TopBarProps) {
  return (
    <View style={[styles.bar, style]}>
      <View style={[styles.side, styles.left]}>{left}</View>
      {typeof title === 'string' ? (
        <Text variant="subheading" numberOfLines={1} accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
      ) : (
        title
      )}
      <View style={[styles.side, styles.right]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingHorizontal: 12,
    gap: 8,
  },
  side: {
    flex: 1,
    minWidth: 44,
    flexDirection: 'row',
    alignItems: 'center',
  },
  left: { justifyContent: 'flex-start' },
  right: { justifyContent: 'flex-end' },
  title: { flexShrink: 1, textAlign: 'center' },
});
