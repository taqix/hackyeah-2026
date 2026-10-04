import { type ReactNode, useState } from 'react';
import { Linking, Platform, Switch } from 'react-native';

import { getRemoteRuntime } from '@/api/remote/default';
import { Button, ListRow, Spinner } from '@/components/ui';
import { removeCalendarExport, removeGoogleCalendarExport, useCalendarExportStatus } from '@/features/calendar-export';
import { useStepCounter } from '@/hooks/use-step-counter';
import { setCalendarExportEnabled, useCalendarExportSetting } from '@/state/calendar-export';
import { reloadGoogleCalendar, useGoogleCalendar } from '@/state/google-calendar';
import { useTheme } from '@/theme';

import { ConfirmSheet } from './confirm-sheet';
import { StatusNote, StatusOn } from './status-on';
import type { CalendarAccessControls } from './use-calendar-access';

function openSystemSettings() {
  Linking.openSettings().catch(() => undefined);
}

/** Device calendar: On, Connect (explicit tap only), or Settings once the phone stops asking. */
export function CalendarConnectionRow({ calendar }: { calendar: CalendarAccessControls }) {
  const { access, connecting, connect, retry } = calendar;

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

const EXPORT_TITLE = 'Add sessions to my calendar';

/**
 * Opt-in, off by default (an extra beyond the design): planned sessions are
 * copied into a "Movo" calendar on this phone. Turning it on asks for calendar
 * access when needed; turning it off removes that calendar after a confirm.
 * Sessions go to one Movo calendar only: when Google Calendar has them,
 * turning this on first moves them here, after a confirm.
 */
export function CalendarExportRow({ calendar }: { calendar: CalendarAccessControls }) {
  const { colors } = useTheme();
  const setting = useCalendarExportSetting();
  const status = useCalendarExportStatus();
  const google = useGoogleCalendar().status;
  const [confirmingOff, setConfirmingOff] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [confirmingMove, setConfirmingMove] = useState(false);
  const [moving, setMoving] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const { access } = calendar;
  const googleHasSessions = !!google?.connected && google.exportEnabled;

  const turnOn = async () => {
    if (access.status === 'denied' && !access.canAskAgain) {
      openSystemSettings();
      return;
    }
    const next = access.status === 'granted' ? access : await calendar.connect();
    if (next.status === 'granted') setCalendarExportEnabled(true);
  };

  const closeConfirm = () => {
    setConfirmingOff(false);
    setRemoveError(null);
  };

  const closeMove = () => {
    if (moving) return;
    setConfirmingMove(false);
    setMoveError(null);
  };

  const moveHere = async () => {
    setMoving(true);
    setMoveError(null);
    try {
      await getRemoteRuntime().googleCalendar.setExportEnabled(false);
      await removeGoogleCalendarExport();
      setConfirmingMove(false);
      await turnOn();
    } catch {
      setMoveError("We couldn't remove the Movo calendar from Google. Try again, or delete it in Google Calendar.");
    } finally {
      setMoving(false);
      void reloadGoogleCalendar();
    }
  };

  const turnOff = async () => {
    setRemoving(true);
    setRemoveError(null);
    setCalendarExportEnabled(false);
    try {
      await removeCalendarExport();
      setConfirmingOff(false);
    } catch {
      setRemoveError("We couldn't remove the Movo calendar. Try again, or delete it in your calendar app.");
    } finally {
      setRemoving(false);
    }
  };

  let detail = 'Planned sessions go into a Movo calendar on this phone';
  if (setting.enabled && access.status === 'denied') {
    detail = "Calendar access is off, so sessions aren't added";
  } else if (setting.enabled && status === 'failed') {
    detail = "We couldn't update your calendar. We'll try again.";
  }

  let right: ReactNode;
  if (!setting.loaded || access.status === 'checking') {
    right = <Spinner size={18} accessibilityLabel="Checking your calendar setting" />;
  } else if (access.status === 'unavailable') {
    right = <StatusNote>Not available</StatusNote>;
  } else {
    right = (
      <Switch
        value={setting.enabled}
        disabled={calendar.connecting || removing || moving}
        onValueChange={(value) => {
          if (!value) setConfirmingOff(true);
          else if (googleHasSessions) setConfirmingMove(true);
          else void turnOn();
        }}
        trackColor={{ false: colors.borderStrong, true: colors.accent }}
        thumbColor={Platform.OS === 'android' ? colors.surfaceRaised : undefined}
        ios_backgroundColor={colors.borderStrong}
        accessibilityLabel={EXPORT_TITLE}
        accessibilityHint={detail}
      />
    );
  }

  return (
    <>
      <ListRow icon="calendar-plus" discSize={36} title={EXPORT_TITLE} detail={detail} right={right} divider />
      <ConfirmSheet
        visible={confirmingOff}
        onClose={closeConfirm}
        title="Remove the Movo calendar?"
        description="Your planned sessions come off this phone's calendar. Your plan stays the same."
        confirmLabel="Remove calendar"
        onConfirm={() => void turnOff()}
        busy={removing}
        error={removeError}
      />
      <ConfirmSheet
        visible={confirmingMove}
        onClose={closeMove}
        title="Add sessions to this phone instead?"
        description="Sessions leave the Movo calendar in Google and go into a Movo calendar on this phone. Your plan stays the same."
        confirmLabel="Use this phone"
        onConfirm={() => void moveHere()}
        busy={moving}
        error={moveError}
      />
    </>
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

/**
 * The web has no device calendar or step counter, so instead of rows that can
 * only say "Not available" it says where they connect: the phone app.
 */
export function PhoneOnlyRow({ divider = false }: { divider?: boolean }) {
  return (
    <ListRow
      icon="smartphone"
      discTone="quiet"
      discSize={36}
      title="Phone calendar and steps"
      detail="These connect in the Movo app on your phone"
      right={<StatusNote>Phone app</StatusNote>}
      divider={divider}
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
