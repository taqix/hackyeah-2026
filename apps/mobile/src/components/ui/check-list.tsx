import { type StyleProp, View, type ViewStyle } from 'react-native';

import { CheckRow } from './check-row';

export type CheckOption<T extends string> = { value: T; label: string };

export type CheckListProps<T extends string> = {
  /** Read as the group's name (usually the question). */
  label: string;
  options: readonly CheckOption<T>[];
  values: readonly T[];
  onToggle: (value: T) => void;
  style?: StyleProp<ViewStyle>;
};

/** A checkbox list; nothing checked is a full answer. */
export function CheckList<T extends string>({ label, options, values, onToggle, style }: CheckListProps<T>) {
  return (
    <View role="group" accessibilityLabel={label} style={style}>
      {options.map((option) => (
        <CheckRow
          key={option.value}
          label={option.label}
          checked={values.includes(option.value)}
          onPress={() => onToggle(option.value)}
        />
      ))}
    </View>
  );
}
