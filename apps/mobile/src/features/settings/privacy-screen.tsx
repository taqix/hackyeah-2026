import { BackButton, Col, Content, Screen, Section, TopBar } from '@/components/layout';

import { CalendarConnectionRow, StepsConnectionRow, WatchConnectionRow } from './connection-rows';
import { SeesList } from './sees-list';

/**
 * 9.7 — Data and privacy, under Settings: what's connected, and exactly what our
 * assistant sees. Notes after sessions feed the description it keeps of the person.
 */
export function PrivacyScreen() {
  return (
    <Screen>
      <TopBar left={<BackButton />} title="Data and privacy" />
      <Content gap={24}>
        <Col gap={0}>
          <Section>Connected</Section>
          <CalendarConnectionRow />
          <StepsConnectionRow />
          <WatchConnectionRow />
        </Col>
        <Col gap={12}>
          <Section>What our assistant sees</Section>
          <SeesList />
        </Col>
      </Content>
    </Screen>
  );
}
