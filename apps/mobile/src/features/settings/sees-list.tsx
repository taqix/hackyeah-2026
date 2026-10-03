import { View } from 'react-native';

import { Col, Row } from '@/components/layout';
import { Icon, Text } from '@/components/ui';
import { useTheme } from '@/theme';

/** Each line is a promise about what the assistant reads; check it against the backend before shipping. */
const SEES: { yes: boolean; text: string }[] = [
  { yes: true, text: 'Your answers' },
  { yes: true, text: "Your free times, never what's in your calendar" },
  { yes: true, text: 'Your sessions, how they felt and your notes' },
  { yes: true, text: "Whether you'd choose a session again" },
  { yes: false, text: 'Your name, email or steps' },
];

function Sees({ yes, text }: { yes: boolean; text: string }) {
  const { colors } = useTheme();
  return (
    <Row
      gap={10}
      style={{ alignItems: 'flex-start' }}
      accessible
      accessibilityLabel={`${yes ? 'Sees' : 'Never sees'}: ${text}`}>
      <View style={{ marginTop: 1 }}>
        <Icon name={yes ? 'check' : 'x'} size={18} strokeWidth={2} color={yes ? colors.success : colors.textTertiary} />
      </View>
      <Text variant="bodySm" tone="primary" style={{ flex: 1 }}>
        {text}
      </Text>
    </Row>
  );
}

/** 9.7 — What our assistant sees: yes or never, line by line. */
export function SeesList() {
  return (
    <Col gap={12}>
      {SEES.map((item) => (
        <Sees key={item.text} {...item} />
      ))}
      <Text variant="caption">
        It builds your plan, keeps a short description of you from your sessions, and writes your summary.
      </Text>
    </Col>
  );
}
