import { View } from 'react-native';

import { Icon, IconButton, Text, TextLink } from '@/components/ui';
import { useTheme } from '@/theme';

type PlanUpdatedProps = {
  /** The chat change card's one-line summary. */
  summary: string;
  /** "last night" */
  when: string;
  onSeeChat: () => void;
  onDismiss: () => void;
};

/**
 * 5.4: the one note Home keeps. The plan changed in chat; the changed sessions
 * carry an Updated tag in the list and the old → new values stay in chat.
 */
export function PlanUpdated({ summary, when, onSeeChat, onDismiss }: PlanUpdatedProps) {
  const { colors, radius } = useTheme();
  return (
    <View
      role="status"
      accessibilityLiveRegion="polite"
      style={{
        gap: 4,
        paddingTop: 6,
        paddingRight: 4,
        paddingBottom: 4,
        paddingLeft: 16,
        borderRadius: radius.card,
        backgroundColor: colors.accentSoft,
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 }}>
        <Icon name="check" size={18} strokeWidth={2} color={colors.accentText} />
        <Text variant="bodyStrong" style={{ flex: 1, minWidth: 0 }}>
          Plan updated
          <Text variant="caption" tone="secondary">
            {` · ${when}`}
          </Text>
        </Text>
        <IconButton icon="x" accessibilityLabel="Dismiss" onPress={onDismiss} />
      </View>
      <Text variant="bodySm" style={{ paddingRight: 12 }}>
        {summary}
      </Text>
      <TextLink onPress={onSeeChat}>See the chat</TextLink>
    </View>
  );
}
