import { StyleSheet, View } from 'react-native';

import { Col } from '@/components/layout';
import { Button, Disc, Icon, Text } from '@/components/ui';
import { useTheme } from '@/theme';

import { useFileDrop } from './use-file-drop';

/**
 * Import a workout file instead of typing: the system picker, one .fit or .gpx
 * file, parsed on the phone. The same row on every form, swims too. In a
 * browser with a mouse, a file can also be dropped on the row.
 */
export function FileImport({
  onChoose,
  onDropFile,
  busy = false,
  error,
}: {
  onChoose: () => void;
  /** A file dropped on the row (web); touch screens never drag one. */
  onDropFile?: (file: File) => void;
  busy?: boolean;
  error?: string | null;
}) {
  const { colors, radius } = useTheme();
  const { dropRef, dragging } = useFileDrop((file) => onDropFile?.(file));
  return (
    <Col gap={8}>
      <View
        ref={onDropFile ? dropRef : undefined}
        style={[
          styles.row,
          {
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: dragging ? colors.accent : colors.borderSubtle,
            backgroundColor: dragging ? colors.accentSoft : undefined,
          },
        ]}>
        <Disc icon="file-up" tone={dragging ? 'accent' : 'info'} size={36} />
        <View style={styles.text}>
          <Text variant="bodyStrong">{dragging ? 'Drop it to fill the form' : 'Did it with a watch?'}</Text>
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
export function FileImported({
  name,
  onRemove,
  detail = 'Read on your phone',
}: {
  name: string;
  onRemove: () => void;
  /** Where the file was read; the desktop web reads it in the browser. */
  detail?: string;
}) {
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
          {detail}
        </Text>
      </View>
      <Button variant="ghost" size="sm" onPress={onRemove} accessibilityLabel={`Remove ${name}`}>
        Remove
      </Button>
    </View>
  );
}

/**
 * The desktop web's import area: drop a .fit or .gpx file from the desktop
 * onto it, or choose one. It lights up while a file is held over it.
 */
export function FileDropZone({
  onChoose,
  onDropFile,
  busy = false,
  error,
}: {
  onChoose: () => void;
  onDropFile: (file: File) => void;
  busy?: boolean;
  error?: string | null;
}) {
  const { colors, radius } = useTheme();
  const { dropRef, dragging } = useFileDrop(onDropFile);
  return (
    <Col gap={8}>
      <View
        ref={dropRef}
        style={[
          styles.zone,
          {
            borderRadius: radius.lg,
            borderColor: dragging ? colors.accent : colors.borderStrong,
            backgroundColor: dragging ? colors.accentSoft : colors.surfaceSunken,
          },
        ]}>
        <Disc icon="file-up" tone={dragging ? 'accent' : 'info'} size={48} />
        <View style={styles.text}>
          <Text variant="bodyStrong">{dragging ? 'Drop it to fill the form' : 'Did it with a watch?'}</Text>
          <Text variant="bodySm" tone="secondary">
            Drop its .fit or .gpx file here, or choose it.
          </Text>
        </View>
        <Button variant="secondary" loading={busy} onPress={onChoose}>
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

const styles = StyleSheet.create({
  zone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    minHeight: 96,
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
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
