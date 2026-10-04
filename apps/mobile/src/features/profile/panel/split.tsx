import type { ReactNode } from 'react';
import { type StyleProp, View, type ViewStyle } from 'react-native';

type SplitProps = {
  main: ReactNode;
  side: ReactNode;
  /** Narrowest each column gets before the side column wraps under the main one. */
  mainBasis?: number;
  sideBasis?: number;
  /** How the room left over is shared, main to side. */
  grow?: readonly [number, number];
  gap?: number;
  /** The side column stays in view while the main one scrolls (desktop web). */
  stickySide?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * A main and a side column that sit side by side when both fit the page's own
 * width (whatever the sidebar and a docked chat leave), and stack otherwise.
 * Desktop only: phones keep their single column.
 */
export function Split({
  main,
  side,
  mainBasis = 480,
  sideBasis = 300,
  grow = [3, 2],
  gap = 24,
  stickySide = false,
  style,
}: SplitProps) {
  return (
    <View style={[{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap }, style]}>
      <View style={{ flexGrow: grow[0], flexShrink: 1, flexBasis: mainBasis, minWidth: 0, gap }}>{main}</View>
      <View
        style={[
          { flexGrow: grow[1], flexShrink: 1, flexBasis: sideBasis, minWidth: 0, gap },
          // A web-only position: React Native's types don't list it.
          stickySide ? ({ position: 'sticky', top: 24 } as unknown as ViewStyle) : null,
        ]}>
        {side}
      </View>
    </View>
  );
}
