import { BackButton, Col, Content, PageHeader, Screen, Section, TopBar, useLayout } from '@/components/layout';
import { BackLink, PanelCard, Reveal, Split } from '@/features/profile/panel';
import { useGoogleCalendarConnect } from '@/features/google-calendar';
import { deviceCalendarSupported } from '@/services/calendar';

import {
  CalendarConnectionRow,
  CalendarExportRow,
  PhoneOnlyRow,
  StepsConnectionRow,
  WatchConnectionRow,
} from './connection-rows';
import { GoogleCalendarRows } from './google-calendar-rows';
import { SeesList } from './sees-list';
import { useCalendarAccess } from './use-calendar-access';

/**
 * 9.7 — Data and privacy, under Settings: what's connected, and exactly what our
 * assistant sees. Notes after sessions feed the description it keeps of the person.
 */
export function PrivacyScreen() {
  const { isDesktop } = useLayout();
  const connections = deviceCalendarSupported ? <DeviceConnections /> : <WebConnections />;

  if (isDesktop) {
    return (
      <Screen>
        <Content gap={24} maxWidth={1040}>
          <BackLink label="Settings" href="/settings" />
          <Reveal>
            <PageHeader title="Data and privacy" subtitle="What's connected, and exactly what our assistant sees." />
          </Reveal>
          <Split
            stickySide
            main={
              <Reveal order={1}>
                <PanelCard title="Connected" gap={4}>
                  {connections}
                </PanelCard>
              </Reveal>
            }
            side={
              <Reveal order={2}>
                <PanelCard title="What our assistant sees" gap={16}>
                  <SeesList />
                </PanelCard>
              </Reveal>
            }
          />
        </Content>
      </Screen>
    );
  }
  return (
    <Screen>
      <TopBar left={<BackButton />} title="Data and privacy" />
      <Content gap={24}>
        <Col gap={0}>
          <Section>Connected</Section>
          {connections}
        </Col>
        <Col gap={12}>
          <Section>What our assistant sees</Section>
          <SeesList />
        </Col>
      </Content>
    </Screen>
  );
}

/** iOS and Android: the phone's own calendar and its export, Google Calendar, steps and watches. */
function DeviceConnections() {
  // One reading of calendar access for both rows, so connecting in one updates the other.
  const calendar = useCalendarAccess();
  return (
    <>
      <CalendarConnectionRow calendar={calendar} />
      <CalendarExportRow calendar={calendar} />
      <GoogleCalendarRows />
      <StepsConnectionRow />
      <WatchConnectionRow />
    </>
  );
}

/** The web: Google Calendar (connected through Google's page), then what only the phone app connects. */
function WebConnections() {
  const google = useGoogleCalendarConnect('privacy');
  return (
    <>
      <GoogleCalendarRows first />
      <PhoneOnlyRow divider={google.available} />
      <WatchConnectionRow />
    </>
  );
}
