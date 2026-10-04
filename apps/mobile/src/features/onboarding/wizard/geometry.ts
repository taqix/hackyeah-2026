import { DESKTOP_GUTTER, useLayout } from '@/components/layout';

/** The step rail's slot beside the wizard (its floating card plus the inset): narrower on a medium window. */
export const RAIL_WIDTH = { medium: 252, wide: 292 } as const;
/** The question card's widest; long lines read badly beyond it. */
export const CARD_MAX_WIDTH = 720;
export const ASIDE_WIDTH = 288;
export const ASIDE_GAP = 32;
/** The aside only shows while the card keeps at least this much room. */
const CARD_MIN_WITH_ASIDE = 600;

export type WizardGeometry = {
  railWidth: number;
  /** Whether "why we ask" sits beside the card. */
  showAside: boolean;
  /** Content's maxWidth: the card, plus the aside when it shows. */
  maxWidth: number;
  cardPadding: number;
};

/** How the desktop wizard divides the window between rail, card and aside. */
export function useWizardGeometry(): WizardGeometry {
  const { isWide, width } = useLayout();
  const railWidth = isWide ? RAIL_WIDTH.wide : RAIL_WIDTH.medium;
  const room = width - railWidth - DESKTOP_GUTTER * 2;
  const showAside = isWide && room >= CARD_MIN_WITH_ASIDE + ASIDE_GAP + ASIDE_WIDTH;
  return {
    railWidth,
    showAside,
    maxWidth: showAside ? CARD_MAX_WIDTH + ASIDE_GAP + ASIDE_WIDTH : CARD_MAX_WIDTH,
    cardPadding: isWide ? 40 : 32,
  };
}
