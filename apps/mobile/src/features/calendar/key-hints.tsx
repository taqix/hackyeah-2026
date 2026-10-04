import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, type IconName, Text } from '@/components/ui';
import { useTheme } from '@/theme';

/** The month's keyboard shortcuts (desktop web), small and quiet beside the legend. */
export function KeyHints() {
  return (
    <View style={styles.hints}>
      <Hint label="Today">
        <Key>T</Key>
      </Hint>
      <Hint label="Month">
        <Key>P</Key>
        <Key>N</Key>
      </Hint>
      <Hint label="Day">
        <Key icon="chevron-left" />
        <Key icon="chevron-up" />
        <Key icon="chevron-down" />
        <Key icon="chevron-right" />
      </Hint>
    </View>
  );
}

function Hint({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.hint}>
      <View style={styles.keys}>{children}</View>
      <Text variant="caption">{label}</Text>
    </View>
  );
}

/** A key cap: a letter, or an arrow drawn as a chevron. */
function Key({ children, icon }: { children?: string; icon?: IconName }) {
  const { colors, fontFamily } = useTheme();
  return (
    <View style={[styles.key, { borderColor: colors.borderStrong, backgroundColor: colors.surfaceCard }]}>
      {icon ? (
        <Icon name={icon} size={12} color={colors.textSecondary} strokeWidth={2.25} />
      ) : (
        <Text variant="caption" tone="secondary" style={{ fontFamily: fontFamily.bodySemibold, fontSize: 11 }}>
          {children}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hints: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 16, rowGap: 6 },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  keys: { flexDirection: 'row', gap: 3 },
  key: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    borderRadius: 5,
    borderWidth: 1,
    borderBottomWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
