import type { ReactNode } from 'react';
import { type StyleProp, View, type ViewStyle } from 'react-native';

export type ChipGroupProps = {
  /** Read as the group's name (usually the question). */
  label: string;
  children: ReactNode;
  gap?: number;
  style?: StyleProp<ViewStyle>;
};

/** Wrapping row of Tags for a multiple-choice question. */
export function ChipGroup({ label, children, gap = 8, style }: ChipGroupProps) {
  return (
    <View role="group" accessibilityLabel={label} style={[{ flexDirection: 'row', flexWrap: 'wrap', gap }, style]}>
      {children}
    </View>
  );
}
