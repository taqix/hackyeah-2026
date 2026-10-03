import { type StyleProp, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

export type DividerProps = {
  /** Horizontal (default) or a vertical rule inside a row. */
  vertical?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** 1 px hairline in border-subtle, for list dividers. */
export function Divider({ vertical = false, style }: DividerProps) {
  const { colors } = useTheme();
  return (
    <View
      aria-hidden
      style={[
        vertical ? { width: 1, alignSelf: 'stretch' } : { height: 1, alignSelf: 'stretch' },
        { backgroundColor: colors.borderSubtle },
        style,
      ]}
    />
  );
}
