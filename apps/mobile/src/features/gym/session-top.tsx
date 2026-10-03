import { View } from 'react-native';

import { IconButton, Text } from '@/components/ui';
import { TopBar } from '@/components/layout';
import { useNow } from '@/lib/clock';
import { useTheme } from '@/theme';

import { formatElapsed } from './format';

/** Session clock in the top bar: time since the session started. */
export function Elapsed({ startedAt }: { startedAt: number }) {
  const { colors, fontFamily } = useTheme();
  const time = formatElapsed(useNow(1000).getTime() - startedAt);
  return (
    <View
      accessible
      accessibilityRole="timer"
      accessibilityLabel={`Session time ${time}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        height: 32,
        paddingHorizontal: 12,
        borderRadius: 999,
        backgroundColor: colors.surfaceSunken,
      }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent }} />
      <Text tabular style={{ fontFamily: fontFamily.displaySemibold, fontSize: 15, lineHeight: 18 }}>
        {time}
      </Text>
    </View>
  );
}

/** Top bar for a guided session: plan sheet left, clock centre, end right. */
export function SessionTop({ startedAt, onPlan, onEnd }: { startedAt: number; onPlan: () => void; onEnd: () => void }) {
  return (
    <TopBar
      left={<IconButton icon="list-checks" accessibilityLabel="Session plan" onPress={onPlan} />}
      title={<Elapsed startedAt={startedAt} />}
      right={<IconButton icon="x" accessibilityLabel="End session" onPress={onEnd} />}
    />
  );
}
