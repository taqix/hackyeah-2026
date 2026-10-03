import { type ReactNode, useState } from 'react';
import { Linking } from 'react-native';

import { Button, ListRow, Spinner } from '@/components/ui';
import { useStepCounter } from '@/hooks/use-step-counter';

import { StatusNote, StatusOn } from './status-on';
import { useCalendarAccess } from './use-calendar-access';

function openSystemSettings() {
  Linking.openSettings().catch(() => undefined);
}

/** Device calendar: On, Connect (explicit tap only), or Settings once the phone stops asking. */
export function CalendarConnectionRow() {
  const { access, connecting, connect, retry } = useCalendarAccess();

  let right: ReactNode;
  switch (access.status) {
    case 'checking':
      right = <Spinner size={18} accessibilityLabel="Checking calendar access" />;
      break;
    case 'granted':
      right = <StatusOn />;
      break;
    case 'unavailable':
      right = <StatusNote>Not available</StatusNote>;
      break;
    case 'error':
      right = (
        <Button variant="secondary" size="sm" onPress={() => void retry()} accessibilityLabel="Check calendar access again">
          Try again
        </Button>
      );
      break;
    default:
      right =
        access.status === 'denied' && !access.canAskAgain ? (
          <Button
            variant="secondary"
            size="sm"
            onPress={openSystemSettings}
            accessibilityLabel="Open Settings to allow calendar access">
            Settings
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            onPress={() => void connect()}
            loading={connecting}
            accessibilityLabel="Connect calendar">
            Connect
          </Button>
        );
  }

  return (
    <ListRow
      icon="calendar"
      discSize={36}
      title="Calendar"
      detail={
        access.status === 'error'
          ? "We couldn't check calendar access"
          : "Busy times only, never what's in your events"
      }
      right={right}
    />
  );
}

/** Today's steps from the phone: On, Turn on, then Open Settings if the phone still says no. */
export function StepsConnectionRow() {
  const steps = useStepCounter();
  const [asked, setAsked] = useState(false);
  const status = steps.source === 'unsupported' ? 'unavailable' : steps.status;

  let right: ReactNode;
  switch (status) {
    case 'idle':
    case 'loading':
      right = <Spinner size={18} accessibilityLabel="Checking step access" />;
      break;
    case 'ready':
      right = <StatusOn />;
      break;
    case 'unavailable':
      right = <StatusNote>Not available</StatusNote>;
      break;
    case 'error':
      right = (
        <Button variant="secondary" size="sm" onPress={() => void steps.refresh()} accessibilityLabel="Read steps again">
          Try again
        </Button>
      );
      break;
    case 'permission-required':
      right = asked ? (
        <Button
          variant="secondary"
          size="sm"
          onPress={() => void steps.openSettings().catch(() => undefined)}
          accessibilityLabel="Open Settings to allow step access">
          Open Settings
        </Button>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          onPress={() => {
            setAsked(true);
            void steps.requestPermission();
          }}
          accessibilityLabel="Turn on steps">
          Turn on
        </Button>
      );
      break;
  }

  return (
    <ListRow
      icon="footprints"
      discSize={36}
      title="Steps"
      detail={status === 'error' ? "We couldn't read today's count" : "Today's count, stays on this phone"}
      right={right}
      divider
    />
  );
}

/** Watches are not connected yet (README › Profile: shown as Later). */
export function WatchConnectionRow() {
  return (
    <ListRow
      icon="watch"
      discTone="quiet"
      discSize={36}
      title="Watch"
      detail="Garmin, COROS, Apple Watch"
      right={<StatusNote>Later</StatusNote>}
      divider
      style={{ opacity: 0.7 }}
    />
  );
}
