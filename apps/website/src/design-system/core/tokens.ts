// Shared style values the design system's components build their inline styles from.
// Every component states its transitions through `transition`, so durations and easings
// stay consistent with design/system/tokens.

type Duration = "fast" | "base" | "slow" | "calm";
type Easing = "out" | "spring";

/** A CSS transition from the design tokens: `transition(["background", "transform"])`. */
export function transition(properties: string[], duration: Duration = "fast", easing: Easing | null = "out"): string {
  const timing = easing ? ` var(--ease-${easing})` : "";
  return properties.map(property => `${property} var(--dur-${duration})${timing}`).join(", ");
}

/** The shrink every pressable control shares. */
export function pressTransform(pressed: boolean, scale = "var(--press-scale)"): string {
  return pressed ? `scale(${scale})` : "none";
}

export const DISABLED_OPACITY = 0.4;
