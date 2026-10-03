// Ported from design/system/components.js (components/core/Card.jsx).
import type { CSSProperties, MouseEventHandler, ReactNode } from "react";
import { pressTransform, transition } from "./tokens";
import { useInteraction } from "./useInteraction";

export type CardVariant = "default" | "sunken" | "accent" | "outline";

const VARIANTS: Record<CardVariant, Pick<CSSProperties, "background" | "border" | "boxShadow">> = {
  default: { background: "var(--surface-card)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" },
  sunken: { background: "var(--surface-sunken)", border: "1px solid transparent", boxShadow: "none" },
  accent: { background: "var(--accent-soft)", border: "1px solid transparent", boxShadow: "none" },
  outline: { background: "transparent", border: "1px solid var(--border-strong)", boxShadow: "none" },
};

/** A card presses in only when it has an onClick, which also makes it a button. */
const PRESS_SCALE = "0.99";

export interface CardProps {
  variant?: CardVariant;
  padding?: number;
  onClick?: MouseEventHandler<HTMLDivElement>;
  children?: ReactNode;
  style?: CSSProperties;
}

export function Card({ variant = "default", padding = 20, onClick, children, style }: CardProps) {
  const interactive = !!onClick;
  const { pressed, bind } = useInteraction(!interactive);
  return (
    <div
      onClick={onClick}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      {...bind}
      style={{
        ...VARIANTS[variant],
        borderRadius: "var(--radius-card)",
        padding,
        cursor: interactive ? "pointer" : undefined,
        transform: pressTransform(pressed, PRESS_SCALE),
        transition: transition(["transform"], "base"),
        ...style,
      }}
    >
      {children}
    </div>
  );
}
