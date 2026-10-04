import { type ReactNode, type Ref, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { useBottomEdgePadding } from '@/components/layout';
import { Icon, IconButton, type IconName, noBrowserOutline, Text } from '@/components/ui';
import { useTheme } from '@/theme';

import { FineLine } from './bubbles';
import { BUSY_HINT, HINT, OFFLINE_NOTE } from './copy';
import { useHover } from './hover';

const MAX_INPUT_HEIGHT = 120;

export type ComposerAbout = { icon: IconName; label: string };

export type ComposerProps = {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  /** A change is running: the box is locked, one change at a time. */
  busy: boolean;
  /** Nothing can be sent yet (no plan to change): the box is locked; `top` says why. */
  disabled?: boolean;
  /** The last message waits unsent: the offline note replaces the hint. */
  offline: boolean;
  /** The attached session (8.1, 8.15), removable. */
  about: ComposerAbout | null;
  onRemoveAbout: () => void;
  /** Replaces the hint line (an Undo that didn't go through). */
  top?: ReactNode;
  inputRef?: Ref<TextInput>;
  /** Esc in the box (web): the dock closes. */
  onEscape?: () => void;
  /** Desktop page: the box's widest, centred under the thread. */
  maxWidth?: number;
};

/** The message box: hint or offline note, the attached session, the field and Send. No voice input. */
export function Composer({
  value,
  onChangeText,
  onSend,
  busy,
  disabled = false,
  offline,
  about,
  onRemoveAbout,
  top,
  inputRef,
  onEscape,
  maxWidth,
}: ComposerProps) {
  const { colors, layout, type } = useTheme();
  // Under the box: the home indicator, or a little air above the keyboard (Screen lifts the box onto it).
  const bottomPadding = useBottomEdgePadding(16);
  const [focused, setFocused] = useState(false);
  // Web textareas don't grow by themselves: follow the content height, back to one line when cleared.
  const [webContentHeight, setWebContentHeight] = useState(0);
  const line = type.body.lineHeight;
  const webHeight = value ? Math.min(MAX_INPUT_HEIGHT, Math.max(line, webContentHeight)) : line;
  const locked = busy || disabled;
  const ring = focused && !locked;
  const canSend = value.trim().length > 0 && !locked && !offline;

  return (
    <View
      style={[
        styles.wrap,
        { paddingHorizontal: layout.gutter, paddingBottom: bottomPadding, backgroundColor: colors.bgApp },
        maxWidth ? { width: '100%', maxWidth: maxWidth + 2 * layout.gutter, alignSelf: 'center' } : null,
      ]}>
      {offline ? (
        <OfflineNote />
      ) : (
        (top ?? <FineLine align="center">{busy ? BUSY_HINT : HINT}</FineLine>)
      )}
      <View style={styles.row}>
        <View style={styles.fieldWrap}>
          {ring ? (
            <View
              pointerEvents="none"
              style={[styles.ring, { borderRadius: (about ? 24 : 26) + 4, borderColor: colors.focusRing }]}
            />
          ) : null}
          <View
            style={[
              styles.field,
              about ? styles.fieldWithAbout : null,
              {
                borderRadius: about ? 24 : 26,
                borderColor: ring ? colors.accent : colors.borderStrong,
                backgroundColor: locked ? colors.surfaceSunken : colors.surfaceCard,
              },
            ]}>
            {about ? <AboutChip {...about} onRemove={onRemoveAbout} /> : null}
            <TextInput
              ref={inputRef}
              value={value}
              onChangeText={onChangeText}
              editable={!locked}
              multiline
              placeholder={busy ? 'Updating your plan…' : 'Message your coach…'}
              placeholderTextColor={busy ? colors.textSecondary : colors.textTertiary}
              selectionColor={colors.accent}
              accessibilityLabel="Message"
              aria-disabled={locked}
              autoComplete="off"
              enterKeyHint={Platform.OS === 'web' ? 'send' : undefined}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onContentSizeChange={
                Platform.OS === 'web'
                  ? (event) => setWebContentHeight(event.nativeEvent.contentSize.height)
                  : undefined
              }
              onKeyPress={(event) => {
                // Web: Enter sends, Shift+Enter adds a line, Esc closes the dock. Phones keep Return for new lines.
                if (Platform.OS !== 'web') return;
                const key = event.nativeEvent as { key: string; shiftKey?: boolean; isComposing?: boolean; keyCode?: number };
                // Enter that confirms an input method's composition (accents, CJK) isn't a send; Safari says 229.
                if (key.isComposing || key.keyCode === 229) return;
                if (key.key === 'Escape' && onEscape) {
                  event.preventDefault();
                  onEscape();
                  return;
                }
                if (key.key !== 'Enter' || key.shiftKey) return;
                event.preventDefault();
                if (canSend) onSend();
              }}
              style={[
                styles.input,
                {
                  fontFamily: type.body.fontFamily,
                  fontSize: type.body.fontSize,
                  lineHeight: type.body.lineHeight,
                  color: colors.textPrimary,
                },
                about ? styles.inputWithAbout : null,
                Platform.OS === 'web' ? { height: webHeight } : null,
              ]}
            />
          </View>
        </View>
        <IconButton
          icon="arrow-up"
          accessibilityLabel="Send"
          variant="primary"
          disabled={!canSend}
          onPress={onSend}
          style={styles.send}
        />
      </View>
    </View>
  );
}

/** What the message is about, when chat opens from a session. */
function AboutChip({ icon, label, onRemove }: ComposerAbout & { onRemove: () => void }) {
  const { colors, fontFamily } = useTheme();
  const { hovered, hoverProps } = useHover();
  return (
    <View style={[styles.chip, { backgroundColor: colors.accentSoft }]}>
      <Icon name={icon} size={14} color={colors.accentText} />
      <Text
        numberOfLines={1}
        style={[styles.chipText, { fontFamily: fontFamily.bodySemibold, color: colors.accentText }]}>
        {label}
      </Text>
      <Pressable
        {...hoverProps}
        onPress={onRemove}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${label}`}
        style={({ pressed }) => [
          styles.chipClose,
          pressed || hovered ? { backgroundColor: colors.accentSoftStrong } : null,
        ]}>
        <Icon name="x" size={14} color={colors.accentText} />
      </Pressable>
    </View>
  );
}

/** 8.14: replaces the hint while a message waits unsent. */
function OfflineNote() {
  const { colors, radius } = useTheme();
  return (
    <View
      role="status"
      accessibilityLiveRegion="polite"
      style={[styles.offline, { borderRadius: radius.md, backgroundColor: colors.infoSoft }]}>
      <Icon name="wifi-off" size={16} color={colors.info} />
      <Text variant="bodySm" tone="primary" style={styles.offlineText}>
        {OFFLINE_NOTE}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 8, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  fieldWrap: { flex: 1, minWidth: 0 },
  ring: { position: 'absolute', top: -4, left: -4, right: -4, bottom: -4, borderWidth: 4 },
  field: {
    minHeight: 52,
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderWidth: 1,
  },
  fieldWithAbout: { paddingTop: 9, paddingRight: 16, paddingBottom: 13, paddingLeft: 9 },
  input: {
    maxHeight: MAX_INPUT_HEIGHT,
    padding: 0,
    margin: 0,
    textAlignVertical: 'center',
    backgroundColor: 'transparent',
    // The field draws its own focus ring; hide the browser's square one inside it.
    ...noBrowserOutline,
  },
  inputWithAbout: { paddingLeft: 7 },
  send: { marginBottom: 4 },
  chip: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingLeft: 10,
    paddingRight: 4,
    borderRadius: 999,
  },
  chipText: { flexShrink: 1, fontSize: 13, lineHeight: 16 },
  chipClose: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  offline: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 14 },
  offlineText: { flex: 1 },
});
