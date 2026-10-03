import { View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { useTheme } from '@/theme';

export type StepState = 'done' | 'current' | 'next';

/** Status disc shared by set rows and the session plan: a check when done, else the number. */
export function StepDisc({ n, state }: { n: number; state: StepState }) {
  const { colors, fontFamily } = useTheme();
  const look = {
    done: { backgroundColor: colors.accent, borderColor: colors.accent, borderWidth: 1.5, color: colors.textOnAccent },
    current: { backgroundColor: colors.surfaceCard, borderColor: colors.accent, borderWidth: 2, color: colors.accentText },
    next: { backgroundColor: 'transparent', borderColor: colors.borderStrong, borderWidth: 1.5, color: colors.textTertiary },
  }[state];
  return (
    <View
      aria-hidden
      style={{
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: look.backgroundColor,
        borderColor: look.borderColor,
        borderWidth: look.borderWidth,
      }}>
      {state === 'done' ? (
        <Icon name="check" size={15} strokeWidth={2.5} color={look.color} />
      ) : (
        <Text tabular style={{ fontFamily: fontFamily.displaySemibold, fontSize: 13, lineHeight: 15, color: look.color }}>
          {n}
        </Text>
      )}
    </View>
  );
}
