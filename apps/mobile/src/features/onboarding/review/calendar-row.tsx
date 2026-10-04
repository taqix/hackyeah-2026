import type { ReactNode } from 'react';

import { Button, type DiscTone, Icon, type IconName, ListRow, Spinner } from '@/components/ui';
import type { GoogleCalendarConnect } from '@/features/google-calendar';
import { useTheme } from '@/theme';

import type { CalendarAccess } from './calendar-access';

type Look = { icon: IconName; value: string; detail: string; tone: DiscTone };

/** design/prototype/onboarding.jsx CALENDAR; unavailable covers web and Expo Go. */
const LOOKS: Record<Exclude<CalendarAccess, 'checking'>, Look> = {
  off: { icon: 'calendar', value: 'Not connected', detail: "We only see when you're busy.", tone: 'accent' },
  connected: {
    icon: 'calendar-check',
    value: 'Connected',
    detail: "Busy times only, never what's in your events.",
    tone: 'accent',
  },
  denied: { icon: 'calendar-x', value: 'Access is off', detail: 'Without it, we use your preferred times.', tone: 'quiet' },
  unavailable: {
    icon: 'calendar-x',
    value: 'Not available here',
    detail: 'Without it, we use your preferred times.',
    tone: 'quiet',
  },
};

export type CalendarRowProps = {
  access: CalendarAccess;
  canAskAgain: boolean;
  requesting: boolean;
  onConnect: () => void;
  onOpenSettings: () => void;
  /** "Calendar" alone; "Phone calendar" when Google Calendar is offered beside it. */
  label?: string;
};

/**
 * Calendar access on Review (4, 4.1). Connect asks only from this tap; a refusal
 * shows Settings and never reads as an empty calendar.
 */
export function CalendarRow({
  access,
  canAskAgain,
  requesting,
  onConnect,
  onOpenSettings,
  label = 'Calendar',
}: CalendarRowProps) {
  const { colors } = useTheme();
  const look = LOOKS[access === 'checking' ? 'off' : access];

  let right = null;
  if (access === 'connected') {
    right = <Icon name="check" size={18} color={colors.successText} />;
  } else if (access === 'denied' && !canAskAgain) {
    right = (
      <Button
        variant="secondary"
        size="sm"
        onPress={onOpenSettings}
        accessibilityLabel="Settings"
        accessibilityHint="Opens the phone's settings to allow calendar access">
        Settings
      </Button>
    );
  } else if (access !== 'unavailable') {
    right = (
      <Button
        variant="secondary"
        size="sm"
        loading={access === 'checking' || requesting}
        onPress={onConnect}
        accessibilityLabel="Connect calendar"
        accessibilityHint="Asks for calendar access">
        Connect
      </Button>
    );
  }

  return (
    <ListRow divider icon={look.icon} discTone={look.tone} label={label} title={look.value} detail={look.detail} right={right} />
  );
}

/** Copy on Review: what Google Calendar is used for, in one calm line. */
export const GOOGLE_CALENDAR_PROMISE = "We only read when you're busy, never what's in your events.";

export type GoogleCalendarRowProps = {
  google: GoogleCalendarConnect;
  /** The person signed in with Google: offered first, and it says why. */
  suggested: boolean;
  onConnect: () => void;
};

/**
 * Google Calendar on Review, beside the phone's calendar: Connect (the same
 * connect as Data and privacy), then the Google email with a check. Optional:
 * Build plan never waits for it. Rendered only while `google.available`.
 */
export function GoogleCalendarRow({ google, suggested, onConnect }: GoogleCalendarRowProps) {
  const { colors } = useTheme();
  const { status, connected, needsReconnect, connecting } = google;

  let look: Look = {
    icon: 'calendar-days',
    value: 'Not connected',
    detail: suggested ? `You signed in with Google. ${GOOGLE_CALENDAR_PROMISE}` : GOOGLE_CALENDAR_PROMISE,
    tone: 'accent',
  };
  let right: ReactNode = (
    <Button
      variant="secondary"
      size="sm"
      loading={connecting}
      onPress={onConnect}
      accessibilityLabel="Connect Google Calendar"
      accessibilityHint="Opens Google to share your busy times with Movo">
      Connect
    </Button>
  );

  if (!google.loaded) {
    look = { ...look, value: 'Checking' };
    right = <Spinner size={18} accessibilityLabel="Checking Google Calendar" />;
  } else if (google.readFailed && !status) {
    look = { icon: 'calendar-x', value: "Couldn't check", detail: "We couldn't check Google Calendar.", tone: 'quiet' };
    right = (
      <Button
        variant="secondary"
        size="sm"
        onPress={() => void google.reload()}
        accessibilityLabel="Check Google Calendar again">
        Try again
      </Button>
    );
  } else if (needsReconnect) {
    look = {
      icon: 'calendar-x',
      value: 'Reconnect needed',
      detail: 'Reconnect Google Calendar to keep planning around it.',
      tone: 'quiet',
    };
    right = (
      <Button
        variant="secondary"
        size="sm"
        loading={connecting}
        onPress={onConnect}
        accessibilityLabel="Reconnect Google Calendar">
        Reconnect
      </Button>
    );
  } else if (connected) {
    look = {
      icon: 'calendar-check',
      value: status?.email ?? 'Connected',
      detail: "Busy times only, never what's in your events.",
      tone: 'accent',
    };
    right = <Icon name="check" size={18} color={colors.successText} />;
  }

  return (
    <ListRow
      divider
      icon={look.icon}
      discTone={look.tone}
      label="Google Calendar"
      title={look.value}
      detail={look.detail}
      right={right}
    />
  );
}
