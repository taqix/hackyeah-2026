import type { SemanticColors } from '@/theme';

/** `#RRGGBB` plus an alpha, for the prototype's color-mix(... transparent) fills. */
export function withAlpha(hex: string, alpha: number) {
  const value = hex.replace('#', '');
  if (value.length !== 6) return hex;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16));
  return `rgba(${r},${g},${b},${alpha})`;
}

/** The current item's pill (prototype NavBar): text-primary at 7% with a 5% hairline. Tab bar and sidebar alike. */
export function activeNavFill(colors: SemanticColors) {
  return {
    backgroundColor: withAlpha(colors.textPrimary, 0.07),
    borderColor: withAlpha(colors.textPrimary, 0.05),
  };
}
