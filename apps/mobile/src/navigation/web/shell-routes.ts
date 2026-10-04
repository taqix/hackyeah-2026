import type { TabRoute } from '../tab-items';

/**
 * Route facts for the desktop web shell, from expo-router's segments
 * (`['(tabs)', 'calendar']`, `['session', '[id]']`). Pure, so the rules read
 * in one place.
 */
type Segments = readonly string[];

/** First segments of the signed-in app: the pages the sidebar frames. Sign-in, onboarding and the gym runner stand alone. */
const SHELL_SECTIONS: ReadonlySet<string> = new Set([
  '(tabs)',
  'session',
  'log',
  'feedback',
  'plan-history',
  'profile',
  'settings',
  'coach',
]);

export function isShellRoute(segments: Segments): boolean {
  const first = segments[0];
  return first !== undefined && SHELL_SECTIONS.has(first);
}

/** Whether the focused root route is the tab navigator (its own tabs switch in place). */
export function isTabsRoute(segments: Segments): boolean {
  return segments[0] === '(tabs)';
}

/** The tab a (tabs) route shows; null outside the tabs. */
export function tabOf(segments: Segments): TabRoute | null {
  if (!isTabsRoute(segments)) return null;
  const tab = segments[1];
  if (tab === 'calendar' || tab === 'you') return tab;
  return 'index';
}

/** What the sidebar marks as current: a tab, Plan history or Settings. */
export type ShellDestination = TabRoute | 'plan-history' | 'settings';

/**
 * The sidebar's current item. Pages without an item of their own (a session,
 * Log it, feedback) keep the tab they were opened from, as the phone's tab bar
 * does under them; the You tab owns its profile pages.
 */
export function currentDestination(segments: Segments, lastTab: TabRoute | null): ShellDestination | null {
  const tab = tabOf(segments);
  if (tab) return tab;
  switch (segments[0]) {
    case 'plan-history':
      return 'plan-history';
    case 'settings':
      return 'settings';
    case 'profile':
      return 'you';
    default:
      return lastTab;
  }
}

/** Document titles by route pattern (segments joined, `index` left out). */
const PAGE_TITLES: Readonly<Record<string, string>> = {
  '(tabs)': 'Today',
  '(tabs)/calendar': 'Calendar',
  '(tabs)/you': 'You',
  'session/[id]': 'Activity',
  'log/[sessionId]': 'Log it',
  'feedback/[logId]': 'How did it feel?',
  'gym/[sessionId]': 'Workout',
  'gym/[sessionId]/review': 'What you did',
  'plan-history': 'Plan history',
  coach: 'Coach',
  settings: 'Settings',
  'settings/privacy': 'Data and privacy',
  'settings/demo': 'Demo controls',
  'profile/summary': 'How we see you',
  'profile/why/[statementId]': 'Why we think this',
  'profile/feedback': 'Your feedback',
  'profile/edit/[section]': 'Edit your answers',
  '(auth)/welcome': 'Welcome',
  '(auth)/password': 'Sign in',
  'auth/callback': 'Signing in',
  'auth/reset': 'New password',
  guest: 'Guest',
  'onboarding/starting': 'Starting point',
  'onboarding/time': 'Time',
  'onboarding/activities': 'Activities',
  'onboarding/places': 'Places',
  'onboarding/extras': 'Good to know',
  'onboarding/review': 'Review',
};

export const APP_NAME = 'Movo';

/** "Calendar · Movo"; the bare app name where a page has no title of its own. */
export function documentTitle(segments: Segments): string {
  const pattern = segments.filter((segment) => segment !== 'index').join('/');
  const page = PAGE_TITLES[pattern];
  return page ? `${page} · ${APP_NAME}` : APP_NAME;
}
