import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BOTTOM_BAR_CLEARANCE } from '@/components/layout';

/** Content's bottom inset for a BottomBar that carries `extra` points of text above its button. */
export function useBottomBarInset(extra: number): number {
  const insets = useSafeAreaInsets();
  return BOTTOM_BAR_CLEARANCE + Math.max(insets.bottom, 20) + extra;
}
