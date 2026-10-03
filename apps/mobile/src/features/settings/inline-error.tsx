import { Col } from '@/components/layout';
import { Button, Text } from '@/components/ui';

type InlineErrorProps = {
  message: string;
  onRetry: () => void;
  retrying?: boolean;
};

/** A section that failed to load: what happened, and Try again. */
export function InlineError({ message, onRetry, retrying = false }: InlineErrorProps) {
  return (
    <Col gap={10} style={{ paddingVertical: 8 }}>
      <Text variant="bodySm" accessibilityRole="alert">
        {message}
      </Text>
      <Button
        variant="secondary"
        size="sm"
        icon="refresh-cw"
        onPress={onRetry}
        loading={retrying}
        style={{ alignSelf: 'flex-start' }}>
        Try again
      </Button>
    </Col>
  );
}
