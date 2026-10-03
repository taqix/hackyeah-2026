import { useEffect } from 'react';
import { AccessibilityInfo, View } from 'react-native';

import { isApiError } from '@/api/types';
import { Button, Card, Icon, Text } from '@/components/ui';
import { Row } from '@/components/layout';
import { useTheme } from '@/theme';

import { requestErrorMessage } from './auth-routes';

type RequestAlertProps = {
  error: unknown;
  /** Try again by default; `action` replaces it when retrying can't help ("Sign in instead"). */
  onRetry: () => void;
  action?: { label: string; onPress: () => void };
  /** Overrides the offline/server copy. */
  message?: string;
};

/** A request that failed for a reason the person can't fix in the form: offline or a server error. */
export function RequestAlert({ error, onRetry, action, message }: RequestAlertProps) {
  const { colors } = useTheme();
  const offline = isApiError(error, 'offline');
  return (
    <View accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Card variant="sunken" padding={16} style={{ gap: 12 }}>
        <Row gap={10} style={{ alignItems: 'flex-start' }}>
          <Icon name={offline ? 'wifi-off' : 'circle-alert'} size={18} color={offline ? colors.info : colors.danger} />
          <Text variant="bodySm" tone="primary" style={{ flex: 1 }}>
            {message ?? requestErrorMessage(error)}
          </Text>
        </Row>
        {action ? (
          <Button size="sm" variant="secondary" onPress={action.onPress} style={{ alignSelf: 'flex-start' }}>
            {action.label}
          </Button>
        ) : (
          <Button size="sm" variant="secondary" icon="refresh-cw" onPress={onRetry} style={{ alignSelf: 'flex-start' }}>
            Try again
          </Button>
        )}
      </Card>
    </View>
  );
}

/** Quiet confirmation that something was sent (Forgot password?). Announced once when it appears. */
export function SentNote({ children }: { children: string }) {
  const { colors, radius } = useTheme();

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(children);
  }, [children]);

  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: radius.md,
        backgroundColor: colors.successSoft,
      }}>
      <Icon name="circle-check" size={18} color={colors.success} />
      <Text variant="bodySm" tone="primary" style={{ flex: 1 }}>
        {children}
      </Text>
    </View>
  );
}
