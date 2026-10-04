import { createContext, useContext } from 'react';

/** md on phones (the design's hero); lg on the desktop dashboard, where the hero is the page's focus. */
export type HeroSize = 'md' | 'lg';

const HeroSizeContext = createContext<HeroSize>('md');

/** Wraps the hero slot; every hero and state card inside it takes this size. */
export const HeroSizeProvider = HeroSizeContext.Provider;

export function useHeroSize(): HeroSize {
  return useContext(HeroSizeContext);
}

/**
 * The large hero's measures, matching SuggestionCard's lg size, so a photo card,
 * a tinted day card and a state card keep one shape as the selected day changes.
 */
export const LARGE_HERO = {
  minHeight: 360,
  padding: 24,
  titleSize: 34,
} as const;
