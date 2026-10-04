import { StyleSheet, View } from 'react-native';

import { Row } from '@/components/layout';
import { Icon, Text } from '@/components/ui';
import { useTheme } from '@/theme';

/** What the Calendar shows and reads: only sessions, never what's in the person's own calendar. */
export function PrivacyNote() {
  const { colors } = useTheme();
  return (
    <Row gap={10} style={styles.privacy}>
      <View style={styles.privacyIcon}>
        <Icon name="eye-off" size={16} color={colors.textSecondary} />
      </View>
      <Text variant="bodySm" style={styles.privacyText}>
        Only your sessions show here. We read when you&apos;re busy, never what&apos;s in your calendar. Plans go one
        week ahead.
      </Text>
    </Row>
  );
}

const styles = StyleSheet.create({
  privacy: { alignItems: 'flex-start' },
  privacyIcon: { marginTop: 2 },
  privacyText: { flex: 1 },
});
