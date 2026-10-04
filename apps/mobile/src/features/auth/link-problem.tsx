import { useRouter } from 'expo-router';

import { isApiError } from '@/api/types';
import { Button } from '@/components/ui';
import { Body, Col, Content, H1, Screen } from '@/components/layout';

import { requestErrorMessage } from './auth-routes';

type LinkProblemProps = {
  title: string;
  error?: unknown;
  /** Overrides the error's own message. */
  message?: string;
  /** Offered when the failure was the connection: the link itself may still work. */
  onRetry?: () => void;
};

/** An Auth link (Google's return, a confirmation or reset email) that didn't sign the person in. */
export function LinkProblem({ title, error, message, onRetry }: LinkProblemProps) {
  const router = useRouter();
  const connection = isApiError(error) && (error.code === 'offline' || error.code === 'timeout');
  // A connection problem gets the usual offline copy; Auth's own reasons (an expired link) are already plain.
  const text = message ?? (isApiError(error) && !connection ? error.message : requestErrorMessage(error));

  return (
    <Screen>
      <Content gap={20}>
        <Col gap={8} accessibilityRole="alert">
          <H1>{title}</H1>
          <Body>{text}</Body>
        </Col>
        <Col gap={8}>
          {connection && onRetry ? (
            <Button size="lg" fullWidth icon="refresh-cw" onPress={onRetry}>
              Try again
            </Button>
          ) : null}
          <Button
            size="lg"
            fullWidth
            variant={connection && onRetry ? 'secondary' : 'primary'}
            onPress={() => router.replace('/welcome')}>
            Back to sign in
          </Button>
        </Col>
      </Content>
    </Screen>
  );
}
