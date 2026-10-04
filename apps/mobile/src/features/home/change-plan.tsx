import { type StyleProp, View, type ViewStyle } from 'react-native';

import { Col, Section } from '@/components/layout';
import { Tag } from '@/components/ui';
import { useOpenChat } from '@/navigation/open-chat';

/** Two starter requests. Each opens chat with the request filled in; anything else starts from the chat button. */
export function ChangePlan({ style }: { style?: StyleProp<ViewStyle> }) {
  const openChat = useOpenChat();
  return (
    <Col gap={10} style={[{ marginTop: 8 }, style]}>
      <Section>Need a change?</Section>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Tag icon="timer" label="Shorter sessions" onPress={() => openChat({ prefill: 'Can my sessions be shorter?' })} />
        <Tag
          icon="calendar-days"
          label="Other days"
          onPress={() => openChat({ prefill: 'Can we move my sessions to other days?' })}
        />
      </View>
    </Col>
  );
}
