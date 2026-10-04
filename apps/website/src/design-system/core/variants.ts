// The control palettes Button and IconButton share, so a variant is defined once.

export type ControlVariant = "primary" | "secondary" | "ghost" | "inverse";

export interface ControlPalette {
  background: string;
  color: string;
  borderColor: string;
  /** Set where a variant dims on hover instead of changing colour. */
  opacity?: number;
}

export interface InteractionState {
  hover: boolean;
  pressed: boolean;
}

export function controlPalette(variant: ControlVariant, { hover, pressed }: InteractionState): ControlPalette {
  switch (variant) {
    case "primary":
      return {
        background: pressed ? "var(--accent-pressed)" : hover ? "var(--accent-hover)" : "var(--accent)",
        color: "var(--text-on-accent)",
        borderColor: "transparent",
      };
    case "secondary":
      return {
        background: hover ? "var(--surface-sunken)" : "var(--surface-card)",
        color: "var(--text-primary)",
        borderColor: "var(--border-strong)",
      };
    case "ghost":
      return {
        background: hover ? "var(--surface-sunken)" : "transparent",
        color: "var(--text-primary)",
        borderColor: "transparent",
      };
    case "inverse":
      return {
        background: "var(--surface-inverse)",
        color: "var(--text-inverse)",
        borderColor: "transparent",
        opacity: hover ? 0.88 : 1,
      };
  }
}
