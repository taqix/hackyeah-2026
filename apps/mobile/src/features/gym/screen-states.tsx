import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, IconButton, Spinner, Text } from '@/components/ui';
import { Screen, TopBar } from '@/components/layout';
import { useTheme } from '@/theme';

function Frame({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const { layout } = useTheme();
  return (
    <Screen>
      <TopBar right={<IconButton icon="x" accessibilityLabel="Close" onPress={onClose} />} />
      <View style={[styles.centre, { paddingHorizontal: layout.gutter }]}>{children}</View>
    </Screen>
  );
}

export function GymLoading({ onClose }: { onClose: () => void }) {
  const { colors } = useTheme();
  return (
    <Frame onClose={onClose}>
      <Spinner size={24} color={colors.textTertiary} />
    </Frame>
  );
}

export function GymError({ title, onRetry, onClose }: { title: string; onRetry: () => void; onClose: () => void }) {
  return (
    <Frame onClose={onClose}>
      <View accessibilityRole="alert" style={styles.message}>
        <Text variant="heading" align="center">
          {title}
        </Text>
        <Text variant="bodySm" align="center">
          Check your connection, then try again.
        </Text>
      </View>
      <Button variant="secondary" onPress={onRetry} icon="refresh-cw">
        Try again
      </Button>
    </Frame>
  );
}

export type GymNoticeProps = {
  title: string;
  body: string;
  action: string;
  onAction: () => void;
  onClose: () => void;
};

/** A session that can't be guided: already logged, skipped, or not a gym session. */
export function GymNotice({ title, body, action, onAction, onClose }: GymNoticeProps) {
  return (
    <Frame onClose={onClose}>
      <View style={styles.message}>
        <Text variant="heading" align="center" accessibilityRole="header">
          {title}
        </Text>
        <Text variant="bodySm" align="center">
          {body}
        </Text>
      </View>
      <Button onPress={onAction}>{action}</Button>
    </Frame>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, paddingBottom: 56 },
  message: { gap: 8, maxWidth: 320 },
});
