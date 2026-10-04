import { Children, type ReactNode, useState } from 'react';
import { type StyleProp, View, type ViewStyle } from 'react-native';

export type TileGridProps = {
  children: ReactNode;
  /** A tile never gets narrower than this; the row wraps instead. */
  minItemWidth: number;
  gap?: number;
  /** The tiles of a short last row share it instead of keeping the column width. */
  fillLastRow?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Equal columns of tiles for the desktop web: as many columns as fit
 * `minItemWidth`, every tile as wide as its column (unlike the layout Grid,
 * whose short last row stretches), and the tiles of a row equally tall.
 */
export function TileGrid({ children, minItemWidth, gap = 12, fillLastRow = false, style }: TileGridProps) {
  const [width, setWidth] = useState(0);
  const items = Children.toArray(children);
  const columns = width > 0 ? Math.max(1, Math.floor((width + gap) / (minItemWidth + gap))) : 0;
  // Whole pixels, so a full row never wraps on rounding.
  const span = (count: number) => Math.floor((width - gap * (count - 1)) / count);
  const shortRow = columns ? items.length % columns : 0;
  const firstOfLastRow = items.length - shortRow;

  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={[{ flexDirection: 'row', flexWrap: 'wrap', gap }, style]}>
      {items.map((child, index) => {
        let cell: ViewStyle = { flexGrow: 1, flexBasis: minItemWidth };
        if (columns) {
          const stretched = fillLastRow && shortRow > 0 && index >= firstOfLastRow;
          cell = { width: span(stretched ? shortRow : columns) };
        }
        return (
          <View key={index} style={cell}>
            {child}
          </View>
        );
      })}
    </View>
  );
}
