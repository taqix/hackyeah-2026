import { Col, Content, H1, Screen } from '@/components/layout';
import { Card, Text } from '@/components/ui';

/**
 * Shown instead of the app when a Supabase build lacks its configuration, so
 * it never falls back to the demo data silently. For developers: it names the
 * variables to set in apps/mobile/.env.
 */
export function SetupScreen({ missing }: { missing: string[] }) {
  return (
    <Screen>
      <Content gap={20}>
        <Col gap={8}>
          <H1>Almost ready</H1>
          <Text tone="secondary">
            This build isn&apos;t connected to a server yet. Add these to apps/mobile/.env, then restart the app:
          </Text>
        </Col>
        <Card>
          <Col gap={8}>
            {missing.map((name) => (
              <Text key={name} variant="label" selectable>
                {name}
              </Text>
            ))}
          </Col>
        </Card>
        <Text tone="tertiary">
          apps/mobile/.env.example explains each value. To try the app with demo data instead, set
          EXPO_PUBLIC_API_MODE=mock.
        </Text>
      </Content>
    </Screen>
  );
}
