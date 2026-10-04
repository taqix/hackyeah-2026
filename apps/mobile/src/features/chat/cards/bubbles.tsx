/** Message bubbles, quick replies and the quiet option (design/prototype/chat.jsx: Bubble, Reply, Options). */
import type { ReactNode } from 'react';
import { View } from 'react-native';

import type { ChatMessage, SessionRef } from '@/api/types';
import { useLayout } from '@/components/layout';
import { Icon, PressableScale, Text } from '@/components/ui';
import { useNow } from '@/lib/clock';
import { sportIcon } from '@/lib/sport-visuals';
import { useTheme } from '@/theme';

import { aboutLabel } from './format';
import { Fine } from './parts';

type UserText = Extract<ChatMessage, { kind: 'text' }>;
type CoachText = Extract<ChatMessage, { kind: 'reply' }>;

/**
 * Coach on the left on a soft surface, you on the right in the accent. Tells
 * screen readers who said it. On the desktop web both keep to 85% of the
 * column, so a line stays easy to read in a wide thread.
 */
function Bubble({ me, text, context, foot }: { me: boolean; text: string; context?: ReactNode; foot?: ReactNode }) {
  const { colors } = useTheme();
  const { isDesktop } = useLayout();
  return (
    <View
      style={{
        alignSelf: me ? 'flex-end' : 'flex-start',
        maxWidth: me || isDesktop ? '85%' : '92%',
        alignItems: me ? 'flex-end' : 'flex-start',
        gap: 6,
      }}>
      {context}
      <View
        accessible
        accessibilityLabel={`${me ? 'You' : 'Coach'}: ${text}`}
        style={{
          paddingVertical: 11,
          paddingHorizontal: 16,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          borderBottomLeftRadius: me ? 20 : 6,
          borderBottomRightRadius: me ? 6 : 20,
          backgroundColor: me ? colors.accent : colors.surfaceBubble,
        }}>
        <Text tone={me ? 'onAccent' : 'primary'}>{text}</Text>
      </View>
      {foot}
    </View>
  );
}

/** What the message is about, when chat opened from a session: "Today · Walk-run intervals". */
function AboutLine({ about }: { about: SessionRef }) {
  const { colors } = useTheme();
  const today = useNow();
  const label = aboutLabel(about, today);
  return (
    <View
      accessible
      accessibilityLabel={`About ${label}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Icon name={sportIcon(about.sport_id)} size={13} color={colors.textSecondary} />
      <Text variant="caption" tone="secondary" numberOfLines={1} style={{ flexShrink: 1 }}>
        {label}
      </Text>
    </View>
  );
}

export function UserMessage({ message }: { message: UserText }) {
  return (
    <Bubble me text={message.text} context={message.about ? <AboutLine about={message.about} /> : null} />
  );
}

/** A quick reply: sends at once, it never edits the message box. */
function Option({ label, disabled, onPress }: { label: string; disabled: boolean; onPress: () => void }) {
  const { colors, fontFamily } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      aria-disabled={disabled}
      style={({ pressed, hovered }) => ({
        height: 44,
        paddingHorizontal: 16,
        justifyContent: 'center',
        borderRadius: 999,
        borderWidth: 1,
        borderColor: pressed || hovered ? colors.accent : colors.accentSoftStrong,
        backgroundColor: colors.accentSoft,
        opacity: disabled ? 0.4 : 1,
      })}>
      <Text numberOfLines={1} style={{ fontFamily: fontFamily.bodySemibold, fontSize: 15, lineHeight: 18, color: colors.accentText }}>
        {label}
      </Text>
    </PressableScale>
  );
}

/** The last, quietest answer: an underlined text button, never a chip ("Skip it this time"). */
function QuietOption({
  label,
  note,
  disabled,
  onPress,
}: {
  label: string;
  note: string | null;
  disabled: boolean;
  onPress: () => void;
}) {
  const { colors, fontFamily } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 10 }}>
      <PressableScale
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={note ? `${label}. ${note}` : label}
        aria-disabled={disabled}
        style={{ minHeight: 44, justifyContent: 'center', opacity: disabled ? 0.4 : 1 }}>
        {({ hovered }) => (
          <Text
            style={{
              fontFamily: fontFamily.bodySemibold,
              fontSize: 15,
              lineHeight: 18,
              color: hovered ? colors.textPrimary : colors.textSecondary,
              textDecorationLine: 'underline',
            }}>
            {label}
          </Text>
        )}
      </PressableScale>
      {note ? (
        <Text variant="caption" tone="secondary" importantForAccessibility="no" accessibilityElementsHidden>
          {note}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * A coach message that changed nothing: always says so underneath. Quick replies
 * and the quiet option stay only on the newest message, and wait while a request runs.
 */
export function CoachReply({
  message,
  isLatest,
  busy,
  onQuickReply,
}: {
  message: CoachText;
  isLatest: boolean;
  busy: boolean;
  onQuickReply: (text: string) => void;
}) {
  const foot =
    message.foot === 'nothing_saved' ? (
      <Fine icon="circle-dashed">Nothing saved yet</Fine>
    ) : (
      <Fine icon="lock">Plan unchanged</Fine>
    );
  const quick = isLatest ? message.quick_replies : [];
  const quiet = isLatest ? message.quiet_option : null;
  return (
    <View style={{ alignSelf: 'stretch', gap: 10 }}>
      <Bubble me={false} text={message.text} foot={foot} />
      {quick.length ? (
        <View role="group" aria-label="Quick replies" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {quick.map((text) => (
            <Option key={text} label={text} disabled={busy} onPress={() => onQuickReply(text)} />
          ))}
        </View>
      ) : null}
      {quiet ? (
        <QuietOption label={quiet.label} note={quiet.note} disabled={busy} onPress={() => onQuickReply(quiet.label)} />
      ) : null}
    </View>
  );
}
