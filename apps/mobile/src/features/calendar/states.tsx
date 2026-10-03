import { View } from 'react-native';

import { Col } from '@/components/layout';
import { Button, Card, Disc, type IconName, Text } from '@/components/ui';

type LoadErrorProps = {
  title: string;
  onRetry: () => void;
  retrying?: boolean;
  /** A secondary Try again, for a section under the screen's main content. */
  quiet?: boolean;
};

/** Something couldn't be fetched: what happened and Try again. */
export function LoadError({ title, onRetry, retrying = false, quiet = false }: LoadErrorProps) {
  return (
    <View accessibilityRole="alert">
      <Card>
        <Col gap={14}>
          <Disc icon="cloud-off" tone="danger" size={40} />
          <Col gap={6}>
            <Text variant="heading">{title}</Text>
            <Text variant="bodySm">Check your connection, then try again. Anything you&apos;ve logged is safe.</Text>
          </Col>
          <Button
            icon="rotate-ccw"
            variant={quiet ? 'secondary' : 'primary'}
            loading={retrying}
            onPress={onRetry}
            style={{ alignSelf: 'flex-start' }}>
            Try again
          </Button>
        </Col>
      </Card>
    </View>
  );
}

type EmptyStateProps = {
  icon: IconName;
  title: string;
  body: string;
  action?: { label: string; onPress: () => void };
};

/** Nothing to show yet, said plainly, with the one way forward. */
export function EmptyState({ icon, title, body, action }: EmptyStateProps) {
  return (
    <Card variant="sunken">
      <Col gap={14}>
        <Disc icon={icon} tone="quiet" size={40} />
        <Col gap={6}>
          <Text variant="heading">{title}</Text>
          <Text variant="bodySm">{body}</Text>
        </Col>
        {action ? (
          <Button variant="secondary" onPress={action.onPress} style={{ alignSelf: 'flex-start' }}>
            {action.label}
          </Button>
        ) : null}
      </Col>
    </Card>
  );
}
