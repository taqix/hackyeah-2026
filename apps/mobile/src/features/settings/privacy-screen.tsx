import { BackButton, Col, Content, Screen, Section, TopBar } from '@/components/layout';

import { CalendarConnectionRow, CalendarExportRow, StepsConnectionRow, WatchConnectionRow } from './connection-rows';
import { GoogleCalendarRows } from './google-calendar-rows';
import { SeesList } from './sees-list';
import { useCalendarAccess } from './use-calendar-access';

/**
 * 9.7 — Data and privacy, under Settings: what's connected, and exactly what our
 * assistant sees. Notes after sessions feed the description it keeps of the person.
 */
export function PrivacyScreen() {
  // One reading of calendar access for both rows, so connecting in one updates the other.
  const calendar = useCalendarAccess();
  return (
    <Screen>
      <TopBar left={<BackButton />} title="Data and privacy" />
      <Content gap={24}>
        <Col gap={0}>
          <Section>Connected</Section>
          <CalendarConnectionRow calendar={calendar} />
          <CalendarExportRow calendar={calendar} />
          <GoogleCalendarRows />
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
