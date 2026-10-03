import { type StyleProp, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

export type StepsProps = {
  /** 1-based current step; segments up to it are filled. */
  step: number;
  total?: number;
  style?: StyleProp<ViewStyle>;
};

/** Onboarding progress: one 4 px segment per step. */
export function Steps({ step, total = 5, style }: StepsProps) {
  const { colors } = useTheme();
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${step} of ${total}`}
      accessibilityValue={{ min: 0, max: total, now: step }}
      style={[{ flexDirection: 'row', gap: 6 }, style]}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i < step ? colors.accent : colors.borderSubtle }}
        />
      ))}
    </View>
  );
}
