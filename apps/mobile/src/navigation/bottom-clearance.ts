import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Floating tab bar and chat button height (prototype: 64). */
export const TAB_BAR_HEIGHT = 64;
/** Space between the bar's top edge and the end of a tab screen's content. */
const CONTENT_MARGIN = 24;

/**
 * Distance from the screen's bottom edge to the bar. The prototype floats it 24 pt
 * above the edge of an iPhone with a home indicator; elsewhere it clears the system bar.
 */
export function tabBarBottomOffset(insetBottom: number) {
  if (insetBottom === 0) return 24;
  return Platform.OS === 'ios' ? Math.max(insetBottom - 10, 16) : insetBottom + 8;
}

/** Bottom padding a tab screen needs so its content scrolls clear of the floating bar. */
export function useBottomClearance() {
  const insets = useSafeAreaInsets();
  return tabBarBottomOffset(insets.bottom) + TAB_BAR_HEIGHT + CONTENT_MARGIN;
}
