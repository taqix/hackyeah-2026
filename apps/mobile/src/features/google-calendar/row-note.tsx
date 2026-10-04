import { useEffect } from 'react';
import { AccessibilityInfo } from 'react-native';

import { Text } from '@/components/ui';

/** A problem with the last action, announced and shown under the rows. */
export function RowNote({ children }: { children: string }) {
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(children);
  }, [children]);
  return (
    <Text variant="bodySm" tone="danger" accessibilityRole="alert" style={{ paddingBottom: 8 }}>
      {children}
    </Text>
  );
}
