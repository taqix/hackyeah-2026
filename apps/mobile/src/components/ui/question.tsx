import { type StyleProp, View, type ViewStyle } from 'react-native';

import { Text } from './text';

export type QuestionProps = {
  /** The question, word for word, as a section heading. */
  children: string;
  /** Shows a quiet "Optional" tag at the right. */
  optional?: boolean;
  hint?: string;
  style?: StyleProp<ViewStyle>;
};

export function Question({ children, optional = false, hint, style }: QuestionProps) {
  return (
    <View style={[{ gap: 4 }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <Text variant="section" accessibilityRole="header" style={{ flex: 1 }}>
          {children}
        </Text>
        {optional ? <Text variant="caption">Optional</Text> : null}
      </View>
      {hint ? <Text variant="bodySm">{hint}</Text> : null}
    </View>
  );
}
