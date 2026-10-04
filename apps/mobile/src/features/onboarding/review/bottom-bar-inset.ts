import { BOTTOM_BAR_CLEARANCE, useBottomBarPadding } from '@/components/layout';

/** Content's bottom inset for a BottomBar that carries `extra` points of text above its button. */
export function useBottomBarInset(extra: number): number {
  return BOTTOM_BAR_CLEARANCE + useBottomBarPadding() + extra;
}
