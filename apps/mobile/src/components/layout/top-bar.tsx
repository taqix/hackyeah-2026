import type { ReactNode } from 'react';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { Text } from '@/components/ui/text';

import { DESKTOP_CONTENT_MAX_WIDTH, DESKTOP_GUTTER, useLayout } from './responsive';

export type TopBarProps = {
  left?: ReactNode;
  /** A string renders as a centred subheading; pass a node for anything else. */
  title?: ReactNode;
  right?: ReactNode;
  /**
   * Desktop web: the content column the bar lines up with, as the screen's
   * Content `maxWidth` (1160 by default; `'none'` spans the page).
   */
  maxWidth?: number | 'none';
  style?: StyleProp<ViewStyle>;
};

/**
 * 56 high: back/close at the left, actions at the right, title centred between
 * equal sides. On the desktop web it is a compact row over the page's content
 * column instead: back, then the title, actions at the column's end.
 */
export function TopBar({ left, title, right, maxWidth = DESKTOP_CONTENT_MAX_WIDTH, style }: TopBarProps) {
  const { isDesktop } = useLayout();
  const heading =
    typeof title === 'string' ? (
      <Text
        variant="subheading"
        numberOfLines={1}
        accessibilityRole="header"
        style={isDesktop ? styles.desktopTitle : styles.title}>
        {title}
      </Text>
    ) : (
      title
    );

  if (isDesktop) {
    return (
      <View style={[styles.desktopBar, maxWidth === 'none' ? null : { maxWidth: maxWidth + DESKTOP_GUTTER * 2 }, style]}>
        {left}
        <View style={styles.desktopMiddle}>{heading}</View>
        {right ? <View style={styles.desktopRight}>{right}</View> : null}
      </View>
    );
  }

  return (
    <View style={[styles.bar, style]}>
      <View style={[styles.side, styles.left]}>{left}</View>
      {heading}
      <View style={[styles.side, styles.right]}>{right}</View>
    </View>
  );
}

/** A desktop back button's glyph sits this far inside its pill; the row starts that much before the gutter. */
const DESKTOP_CONTROL_INSET = 12;

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
  desktopBar: {
    width: '100%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 56,
    paddingTop: 16,
    paddingHorizontal: DESKTOP_GUTTER - DESKTOP_CONTROL_INSET,
  },
  desktopMiddle: { flex: 1, minWidth: 0 },
  desktopTitle: { flexShrink: 1 },
  desktopRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
