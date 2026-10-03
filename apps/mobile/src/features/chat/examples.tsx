import { StyleSheet } from 'react-native';

import { Card, Icon, ListRow, Text } from '@/components/ui';
import { useTheme } from '@/theme';

import { EXAMPLES } from './copy';

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

const styles = StyleSheet.create({
  title: { paddingTop: 14, paddingHorizontal: 18, paddingBottom: 4 },
  row: { minHeight: 62, paddingVertical: 9, paddingHorizontal: 18 },
});
