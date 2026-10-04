import { StyleSheet, View } from 'react-native';

import { Card, Icon, ListRow, PressableScale, Text } from '@/components/ui';
import { useTheme } from '@/theme';

import { type Example, EXAMPLES } from './copy';

/** Empty state (8): what can be asked. A tap fills the message box so the wording can be edited first. */
export function Examples({ onPick }: { onPick: (text: string) => void }) {
  const { colors } = useTheme();
  return (
    <Card padding={0}>
      <Text variant="label" tone="tertiary" accessibilityRole="header" style={styles.title}>
        Try asking
      </Text>
      {EXAMPLES.map((example, index) => (
        <ListRow
          key={example.label}
          icon={example.icon}
          discTone="quiet"
          discSize={36}
          title={example.label}
          detail={`“${example.text}”`}
          divider={index > 0}
          chevron={false}
          right={<Icon name="arrow-up-left" size={18} color={colors.textTertiary} />}
          onPress={() => onPick(example.text)}
          accessibilityLabel={`${example.label}: ${example.text}`}
          accessibilityHint="Puts this in the message box"
          style={styles.row}
        />
      ))}
    </Card>
  );
}

/** The same empty state in a narrow column (the desktop dock): the examples as chips. A click fills the box. */
export function ExampleChips({ onPick }: { onPick: (text: string) => void }) {
  return (
    <View style={styles.chipsBlock}>
      <Text variant="label" tone="tertiary" accessibilityRole="header">
        Try asking
      </Text>
      <View role="group" aria-label="Try asking" style={styles.chips}>
        {EXAMPLES.map((example) => (
          <ExampleChip key={example.label} example={example} onPick={onPick} />
        ))}
      </View>
    </View>
  );
}

/** One example: its icon and words; a mouse over it shows that it goes into the box. */
function ExampleChip({ example, onPick }: { example: Example; onPick: (text: string) => void }) {
  const { colors, fontFamily } = useTheme();
  return (
    <PressableScale
      onPress={() => onPick(example.text)}
      accessibilityRole="button"
      accessibilityLabel={`${example.label}: ${example.text}`}
      accessibilityHint="Puts this in the message box"
      style={({ pressed, hovered }) => [
        styles.chip,
        {
          backgroundColor: hovered || pressed ? colors.surfaceSunken : colors.surfaceCard,
          borderColor: hovered || pressed ? colors.borderStrong : colors.borderSubtle,
        },
      ]}>
      {({ hovered }) => (
        <>
          <Icon
            name={hovered ? 'arrow-up-left' : example.icon}
            size={16}
            color={hovered ? colors.accentText : colors.textSecondary}
          />
          <Text
            numberOfLines={1}
            style={[styles.chipText, { fontFamily: fontFamily.bodyMedium, color: colors.textPrimary }]}>
            {example.text}
          </Text>
        </>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  title: { paddingTop: 14, paddingHorizontal: 18, paddingBottom: 4 },
  row: { minHeight: 62, paddingVertical: 9, paddingHorizontal: 18 },
  chipsBlock: { gap: 10, paddingTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    maxWidth: '100%',
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingLeft: 12,
    paddingRight: 14,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: { flexShrink: 1, fontSize: 14, lineHeight: 18 },
});
