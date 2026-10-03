/**
 * Screen-level pieces of the thread that are not stored messages: the intro,
 * the question when chat opens about a session (8.1) and the status lines.
 * Stored messages render through ChatMessageView from ./cards.
 */
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, type IconName, PressableScale, Text } from '@/components/ui';
import { useTheme } from '@/theme';

/** A coach message on the left, on the soft bubble surface. */
export function CoachBubble({ children }: { children: string }) {
  const { colors } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`Coach: ${children}`}
      style={[styles.bubble, { backgroundColor: colors.surfaceBubble }]}>
      <Text>{children}</Text>
    </View>
  );
}

/** Quick replies send at once: they answer the coach, they don't edit the message. */
export function QuickReplies({
  items,
  disabled,
  onPick,
}: {
  items: string[];
  disabled: boolean;
  onPick: (text: string) => void;
}) {
  const { colors, fontFamily } = useTheme();
  return (
    <View role="group" aria-label="Quick replies" style={styles.replies}>
      {items.map((item) => (
        <PressableScale
          key={item}
          onPress={() => onPick(item)}
          disabled={disabled}
          accessibilityRole="button"
          aria-disabled={disabled}
          style={({ pressed }) => [
            styles.reply,
            {
              backgroundColor: colors.accentSoft,
              borderColor: pressed ? colors.accent : colors.accentSoftStrong,
              opacity: disabled ? 0.5 : 1,
            },
          ]}>
          <Text style={{ fontFamily: fontFamily.bodySemibold, fontSize: 15, lineHeight: 18, color: colors.accentText }}>
            {item}
          </Text>
        </PressableScale>
      ))}
    </View>
  );
}

/** A small status line under a message, a card or above the message box. */
export function FineLine({
  icon,
  danger,
  align = 'start',
  alert,
  children,
}: {
  icon?: IconName;
  danger?: boolean;
  align?: 'start' | 'center';
  alert?: boolean;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  const color = danger ? colors.dangerText : colors.textSecondary;
  return (
    <View
      accessible
      accessibilityRole={alert ? 'alert' : undefined}
      accessibilityLiveRegion={alert ? 'polite' : undefined}
      style={[styles.fine, align === 'center' ? styles.center : null]}>
      {icon ? <Icon name={icon} size={14} color={color} /> : null}
      <Text variant="caption" style={[styles.fineText, { color }]} align={align === 'center' ? 'center' : undefined}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    alignSelf: 'flex-start',
    maxWidth: '88%',
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
    borderBottomLeftRadius: 6,
  },
  replies: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reply: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  center: { justifyContent: 'center' },
  fineText: { flexShrink: 1 },
});
