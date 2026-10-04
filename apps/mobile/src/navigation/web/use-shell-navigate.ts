import { type Href, useRouter, useSegments } from 'expo-router';

import { isTabsRoute } from './shell-routes';

/** A tab of the (tabs) navigator, or a page of the root stack. */
export type ShellTarget = { href: Href; tab: boolean };

/**
 * Goes to an app page from outside the page's own stack (the sidebar, the
 * coach dock). On the tabs, a tab switches in place and any other page opens
 * over them. From a page over the tabs, it goes back down to the target when
 * the target is already open below (the tabs, Settings), and otherwise
 * replaces the page, so the stack never piles up a second set of tabs.
 */
export function useShellNavigate() {
  const router = useRouter();
  const inTabs = isTabsRoute(useSegments());
  return ({ href, tab }: ShellTarget) => {
    if (!inTabs) router.dismissTo(href);
    else if (tab) router.navigate(href);
    else router.push(href);
  };
}
