import type { StartingComfort } from '@/api/types';
import type { IconName } from '@/components/ui';

/** Icons for the desktop starting-point cards; the phone's radio cards have none. */
export const COMFORT_ICONS: Record<StartingComfort, IconName> = {
  starting_out: 'sprout',
  occasionally_active: 'footprints',
  some_routine: 'calendar-check',
};

/** A catalog sport without an onboarding icon. */
export const SPORT_FALLBACK_ICON: IconName = 'activity';
