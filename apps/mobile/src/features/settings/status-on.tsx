import { View } from 'react-native';

import { Row } from '@/components/layout';
import { Text } from '@/components/ui';
import { useTheme } from '@/theme';

/** A connection that works: a green dot and "On". */
export function StatusOn() {
  const { colors } = useTheme();
  return (
    <Row gap={6}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success }} />
      <Text variant="caption" tone="success">
        On
      </Text>
    </Row>
  );
}

/** A quiet status in place of an action ("Later", "Not available"). */
export function StatusNote({ children }: { children: string }) {
  return <Text variant="caption">{children}</Text>;
}
