import type { ReactNode } from 'react';
import { type StyleProp, View, type ViewStyle } from 'react-native';

export type RadioGroupProps = {
  /** Read as the group's name (usually the question). */
  label: string;
  children: ReactNode;
  /** 8 between cards; use 0 for plain rows. */
  gap?: number;
  style?: StyleProp<ViewStyle>;
};

/** Wraps Radio or RadioCard options so assistive tech reads them as one choice. */
export function RadioGroup({ label, children, gap = 8, style }: RadioGroupProps) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={[{ gap }, style]}>
      {children}
    </View>
  );
}
