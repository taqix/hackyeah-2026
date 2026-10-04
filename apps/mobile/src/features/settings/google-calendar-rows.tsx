import { type ReactNode, useEffect, useState } from 'react';
import { AccessibilityInfo, Platform, Switch } from 'react-native';

import { isMockMode } from '@/api/config';
import { useAuthProviders } from '@/api/hooks';
import { getRemoteRuntime } from '@/api/remote/default';
import { isApiError } from '@/api/types';
import { Col } from '@/components/layout';
import { Button, ListRow, Sheet, Spinner, Text } from '@/components/ui';
import { removeCalendarExport, removeGoogleCalendarExport, useCalendarExportStatus } from '@/features/calendar-export';
import { setCalendarExportEnabled, useCalendarExportSetting } from '@/state/calendar-export';
import { reloadGoogleCalendar, useGoogleCalendar } from '@/state/google-calendar';
import { useTheme } from '@/theme';

import { ConfirmSheet } from './confirm-sheet';
import { StatusOn } from './status-on';

const TITLE = 'Google Calendar';
const PLANNING_TITLE = 'Use for planning';
const EXPORT_TITLE = 'Add sessions to Google Calendar';
const CONNECT_FAILED = "Google Calendar didn't connect. Try again.";
const SAVE_FAILED = "That change didn't save. Try again.";
const REMOVE_FAILED = "We couldn't remove the Movo calendar from Google. Try again, or delete it in Google Calendar.";
const PHONE_REMOVE_FAILED = "We couldn't remove the Movo calendar from this phone. Try again.";

const account = () => getRemoteRuntime().googleCalendar;
const messageOf = (error: unknown, fallback: string) =>
  isApiError(error) ? error.message : fallback;

/** A failure whose message is already the copy to show. */
class Shown extends Error {}

function RowSwitch({
  value,
  disabled,
  onChange,
  label,
  hint,
}: {
  value: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint: string;
}) {
  const { colors } = useTheme();
  return (
    <Switch
      value={value}
      disabled={disabled}
      onValueChange={onChange}
      trackColor={{ false: colors.borderStrong, true: colors.accent }}
      thumbColor={Platform.OS === 'android' ? colors.surfaceRaised : undefined}
      ios_backgroundColor={colors.borderStrong}
      accessibilityLabel={label}
      accessibilityHint={hint}
    />
  );
}

/** A problem with the last action, announced and shown under the rows. */
function RowNote({ children }: { children: string }) {
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(children);
  }, [children]);
  return (
    <Text variant="bodySm" tone="danger" accessibilityRole="alert" style={{ paddingBottom: 8 }}>
      {children}
    </Text>
  );
}

type Busy = null | 'connect' | 'planning' | 'export' | 'disconnect';

/**
 * Data and privacy › Google Calendar (opt-in): Connect reads free/busy only,
 * never what's in events, and can add planned sessions to a "Movo" calendar
 * in Google. Connected, it shows the Google email, Use for planning (on by
 * default), Add sessions to Google Calendar (off by default) and Disconnect.
 * When Google stops accepting the connection it offers Reconnect instead of
 * failing quietly. Hidden in mock mode and while Google sign-in is off.
 */
export function GoogleCalendarRows() {
  const providers = useAuthProviders();
  const google = useGoogleCalendar();
  const deviceExport = useCalendarExportSetting();
  const exportStatus = useCalendarExportStatus('google');
  const [busy, setBusy] = useState<Busy>(null);
  const [note, setNote] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ planning?: boolean; export?: boolean }>({});
  const [sheet, setSheet] = useState<null | 'disconnect' | 'export-off' | 'move-here'>(null);
  const [sheetBusy, setSheetBusy] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const status = google.status;

  if (isMockMode || providers.data?.google === false) return null;
  if (google.loaded && !status && !google.error) return null;

  // A connect that finished away from this screen (the web page after Google, another account) leaves a notice.
  const shownNote = note ?? google.notice;
  const clearNotes = () => {
    setNote(null);
    if (google.notice) account().setNotice(null);
  };

  const run = async (kind: Busy, action: () => Promise<void>, fallback: string) => {
    setBusy(kind);
    clearNotes();
    try {
      await action();
      await reloadGoogleCalendar();
    } catch (error) {
      setNote(messageOf(error, fallback));
    } finally {
      setBusy(null);
      setDraft({});
    }
  };

  const connect = async () => {
    setBusy('connect');
    clearNotes();
    try {
      const result = await account().connect();
      // Web: the page is on its way to Google; keep the spinner.
      if (result.status === 'redirecting') return;
      if (result.status === 'connected') AccessibilityInfo.announceForAccessibility('Google Calendar connected');
      await reloadGoogleCalendar();
    } catch (error) {
      setNote(messageOf(error, CONNECT_FAILED));
    }
    setBusy(null);
  };

  const closeSheet = () => {
    if (sheetBusy) return;
    setSheet(null);
    setSheetError(null);
  };

  /** Runs the sheet's action; the sheet closes when it worked and shows the error when not. */
  const confirm = async (action: () => Promise<void>, failure: string) => {
    setSheetBusy(true);
    setSheetError(null);
    try {
      await action();
      setSheet(null);
    } catch (error) {
      const shown = error instanceof Shown || (isApiError(error) && error.code === 'offline');
      setSheetError(shown ? (error as Error).message : failure);
    } finally {
      setSheetBusy(false);
      await reloadGoogleCalendar();
    }
  };

  const disconnect = (removeCalendar: boolean) =>
    confirm(async () => {
      await account().disconnect({ removeCalendar });
      AccessibilityInfo.announceForAccessibility('Google Calendar disconnected');
    }, removeCalendar ? REMOVE_FAILED : SAVE_FAILED);

  const turnExportOff = () =>
    confirm(async () => {
      await account().setExportEnabled(false);
      await removeGoogleCalendarExport();
    }, REMOVE_FAILED);

  // The export has one target: moving it here takes the sessions off this phone's Movo calendar first.
  const moveExportHere = () =>
    confirm(async () => {
      setCalendarExportEnabled(false);
      await removeCalendarExport();
      await account()
        .setExportEnabled(true)
        .catch(() => {
          throw new Shown(SAVE_FAILED);
        });
    }, PHONE_REMOVE_FAILED);

  const connected = !!status?.connected;
  const reconnect = connected && !!status?.needsReconnect;

  let right: ReactNode;
  if (!google.loaded || (busy === 'connect' && !connected)) {
    right =
      busy === 'connect' ? (
        <Button variant="secondary" size="sm" loading accessibilityLabel="Connecting Google Calendar">
          Connect
        </Button>
      ) : (
        <Spinner size={18} accessibilityLabel="Checking Google Calendar" />
      );
  } else if (google.error && !status) {
    right = (
      <Button
        variant="secondary"
        size="sm"
        onPress={() => void reloadGoogleCalendar()}
        accessibilityLabel="Check Google Calendar again">
        Try again
      </Button>
    );
  } else if (reconnect) {
    right = (
      <Button
        variant="secondary"
        size="sm"
        onPress={() => void connect()}
        loading={busy === 'connect'}
        accessibilityLabel="Reconnect Google Calendar">
        Reconnect
      </Button>
    );
  } else if (connected) {
    right = <StatusOn />;
  } else {
    right = (
      <Button
        variant="secondary"
        size="sm"
        onPress={() => void connect()}
        accessibilityLabel="Connect Google Calendar"
        accessibilityHint="Opens Google to share your busy times with Movo">
        Connect
      </Button>
    );
  }

  let detail = "Busy times only, never what's in your events. It can also add your sessions.";
  if (google.error) detail = "We couldn't check Google Calendar.";
  else if (reconnect) detail = 'Reconnect Google Calendar to keep planning around it.';
  else if (connected) detail = status?.email ?? 'Connected';

  const planning = draft.planning ?? status?.useForPlanning ?? true;
  const exporting = draft.export ?? status?.exportEnabled ?? false;
  let exportDetail = 'Planned sessions go into a Movo calendar in Google';
  if (exporting && exportStatus === 'failed') exportDetail = "We couldn't update Google Calendar. We'll try again.";

  return (
    <>
      <ListRow icon="calendar-days" discSize={36} title={TITLE} detail={detail} right={right} divider />
      {connected ? (
        <>
          <ListRow
            icon="calendar-check"
            discTone="quiet"
            discSize={36}
            title={PLANNING_TITLE}
            detail="Plans fit around your Google busy times"
            right={
              <RowSwitch
                value={planning}
                disabled={busy !== null || reconnect}
                label={PLANNING_TITLE}
                hint="Plans fit around your Google busy times"
                onChange={(value) => {
                  setDraft({ planning: value });
                  void run('planning', () => account().setUseForPlanning(value), SAVE_FAILED);
                }}
              />
            }
            divider
          />
          <ListRow
            icon="calendar-plus"
            discTone="quiet"
            discSize={36}
            title={EXPORT_TITLE}
            detail={exportDetail}
            right={
              <RowSwitch
                value={exporting}
                disabled={busy !== null || reconnect}
                label={EXPORT_TITLE}
                hint={exportDetail}
                onChange={(value) => {
                  if (!value) setSheet('export-off');
                  else if (deviceExport.enabled) setSheet('move-here');
                  else {
                    setDraft({ export: true });
                    void run('export', () => account().setExportEnabled(true), SAVE_FAILED);
                  }
                }}
              />
            }
            divider
          />
          <ListRow
            icon="log-out"
            discTone="quiet"
            discSize={36}
            title="Disconnect Google Calendar"
            detail="Movo stops reading your Google busy times"
            onPress={() => setSheet('disconnect')}
            chevron={false}
            disabled={busy !== null}
            accessibilityLabel="Disconnect Google Calendar"
            divider
          />
        </>
      ) : null}
      {shownNote ? <RowNote>{shownNote}</RowNote> : null}

      <Sheet
        visible={sheet === 'disconnect'}
        onClose={closeSheet}
        title="Disconnect Google Calendar?"
        description={
          status?.hasMovoCalendar && !reconnect
            ? 'Movo stops reading your busy times. Your plan stays the same. You can also remove the Movo calendar from Google.'
            : 'Movo stops reading your busy times. Your plan stays the same.'
        }>
        {sheetError ? (
          <Text variant="bodySm" tone="danger" accessibilityRole="alert" style={{ paddingHorizontal: 4 }}>
            {sheetError}
          </Text>
        ) : null}
        <Col gap={8}>
          {status?.hasMovoCalendar && !reconnect ? (
            <>
              <Button onPress={() => void disconnect(true)} loading={sheetBusy} fullWidth>
                Disconnect and remove calendar
              </Button>
              <Button variant="secondary" onPress={() => void disconnect(false)} disabled={sheetBusy} fullWidth>
                Disconnect, keep the calendar
              </Button>
            </>
          ) : (
            <Button onPress={() => void disconnect(false)} loading={sheetBusy} fullWidth>
              Disconnect
            </Button>
          )}
          <Button variant="ghost" onPress={closeSheet} fullWidth>
            Cancel
          </Button>
        </Col>
      </Sheet>
      <ConfirmSheet
        visible={sheet === 'export-off'}
        onClose={closeSheet}
        title="Remove the Movo calendar from Google?"
        description="Your planned sessions come off Google Calendar. Your plan stays the same."
        confirmLabel="Remove calendar"
        onConfirm={() => void turnExportOff()}
        busy={sheetBusy}
        error={sheetError}
      />
      <ConfirmSheet
        visible={sheet === 'move-here'}
        onClose={closeSheet}
        title="Add sessions to Google instead?"
        description="Sessions leave the Movo calendar on this phone and go into a Movo calendar in Google. Your plan stays the same."
        confirmLabel="Use Google Calendar"
        onConfirm={() => void moveExportHere()}
        busy={sheetBusy}
        error={sheetError}
      />
    </>
  );
}
