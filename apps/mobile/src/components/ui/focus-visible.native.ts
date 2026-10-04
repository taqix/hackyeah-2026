import type { OutlineStyle } from './focus-visible';

/** Touch focus never shows a ring on iOS and Android; see focus-visible.ts for the web. */
export function focusIsVisible(): boolean {
  return false;
}

/** Nothing to hide: native views draw no focus outline of their own. */
export const noBrowserOutline: OutlineStyle = {};
