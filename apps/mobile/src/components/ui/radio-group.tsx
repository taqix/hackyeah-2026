import { type ReactNode, useRef } from 'react';
import { type StyleProp, View, type ViewStyle } from 'react-native';

import { useArrowKeyRadios } from './web-keyboard';

export type RadioGroupProps = {
  /** Read as the group's name (usually the question). */
  label: string;
  children: ReactNode;
  /** 8 between cards; use 0 for plain rows. */
  gap?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Wraps Radio or RadioCard options so assistive tech reads them as one choice.
 * On the web the arrow keys move between the options and choose.
 */
export function RadioGroup({ label, children, gap = 8, style }: RadioGroupProps) {
  const group = useRef<View>(null);
  useArrowKeyRadios(group);
  return (
    <View ref={group} accessibilityRole="radiogroup" accessibilityLabel={label} style={[{ gap }, style]}>
      {children}
    </View>
  );
}
