/** Icons and names for catalog sports, so every screen draws a sport the same way. */
import type { SportDefinition } from '@/api/types';
import type { IconName } from '@/components/ui/icon';
import type { PreferenceIcon } from '@/lib/preference-options';

type KitIcon<T extends IconName> = T;
/** Fails to compile if an onboarding option names an icon the kit lacks. */
export type OptionIconName = KitIcon<PreferenceIcon>;

const SPORT_ICONS: Record<string, IconName> = {
  walking: 'footprints',
  nordic_walking: 'footprints',
  hiking: 'mountain',
  running: 'wind',
  cycling: 'bike',
  swimming: 'waves',
  mobility: 'person-standing',
  yoga: 'person-standing',
  pilates: 'person-standing',
  strength: 'dumbbell',
  gym: 'dumbbell',
  football: 'goal',
};

/** The Lucide icon for a sport: footprints, wind, bike, waves, person-standing, dumbbell, goal, else activity. */
export function sportIcon(sportId: string | null | undefined): IconName {
  return (sportId && SPORT_ICONS[sportId]) || 'activity';
}

/** The catalog name of a sport, or a readable fallback from its ID. */
export function sportName(sports: SportDefinition[] | null | undefined, id: string): string {
  const found = sports?.find((s) => s.id === id)?.name;
  if (found) return found;
  const words = id.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}
