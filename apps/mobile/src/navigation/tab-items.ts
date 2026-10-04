import type { Href } from 'expo-router';

import type { IconName } from '@/components/ui/icon';

/** The (tabs) navigator's screens, by route name. */
export type TabRoute = 'index' | 'calendar' | 'you';

export type TabItem = { route: TabRoute; label: string; icon: IconName; href: Href };

/** Today · Calendar · You, You last: the phone's floating tab bar and the desktop sidebar. */
export const TAB_ITEMS: readonly TabItem[] = [
  { route: 'index', label: 'Today', icon: 'sun', href: '/(tabs)' },
  { route: 'calendar', label: 'Calendar', icon: 'calendar', href: '/(tabs)/calendar' },
  { route: 'you', label: 'You', icon: 'user-round', href: '/(tabs)/you' },
];
