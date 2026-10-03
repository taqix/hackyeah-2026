import { StyleSheet, View } from 'react-native';

import { Col } from '@/components/layout';
import { Button, Disc, Icon, Text } from '@/components/ui';
import { useTheme } from '@/theme';

/**
 * Import a workout file instead of typing: the system picker, one .fit or .gpx
 * file, parsed on the phone. The same row on every form, swims too.
 */
export function FileImport({
  onChoose,
  busy = false,
  error,
}: {
  onChoose: () => void;
  busy?: boolean;
  error?: string | null;
}) {
  const { colors, radius } = useTheme();
  return (
    <Col gap={8}>
      <View style={[styles.row, { borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSubtle }]}>
        <Disc icon="file-up" tone="info" size={36} />
        <View style={styles.text}>
          <Text variant="bodyStrong">Did it with a watch?</Text>
          <Text variant="caption" tone="secondary">
            Import its .fit or .gpx file.
          </Text>
        </View>
        <Button variant="secondary" size="sm" loading={busy} onPress={onChoose}>
          Choose file
        </Button>
      </View>
      {error ? (
        <Text variant="caption" tone="danger" accessibilityRole="alert" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </Col>
  );
}

/** The file whose numbers filled the form; Remove puts back what was there before. */
export function FileImported({ name, onRemove }: { name: string; onRemove: () => void }) {
  const { colors, radius } = useTheme();
  return (
    <View
      accessibilityRole="summary"
      accessibilityLiveRegion="polite"
      style={[styles.row, { borderRadius: radius.md, backgroundColor: colors.successSoft }]}>
      <View style={[styles.check, { backgroundColor: colors.surfaceCard }]}>
        <Icon name="check" size={18} strokeWidth={2.25} color={colors.success} />
      </View>
      <View style={styles.text}>
        <Text variant="bodyStrong" numberOfLines={1} ellipsizeMode="middle">
          {name}
        </Text>
        <Text variant="caption" tone="secondary">
          Read on your phone
        </Text>
      </View>
      <Button variant="ghost" size="sm" onPress={onRemove} accessibilityLabel={`Remove ${name}`}>
        Remove
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingLeft: 12,
    paddingRight: 10,
  },
  text: { flex: 1, minWidth: 0, gap: 2 },
  check: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
