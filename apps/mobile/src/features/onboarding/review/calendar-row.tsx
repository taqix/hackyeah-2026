import { Button, type DiscTone, Icon, type IconName, ListRow } from '@/components/ui';
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
};

/**
 * Calendar access on Review (4, 4.1). Connect asks only from this tap; a refusal
 * shows Settings and never reads as an empty calendar.
 */
export function CalendarRow({ access, canAskAgain, requesting, onConnect, onOpenSettings }: CalendarRowProps) {
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
    <ListRow divider icon={look.icon} discTone={look.tone} label="Calendar" title={look.value} detail={look.detail} right={right} />
  );
}
