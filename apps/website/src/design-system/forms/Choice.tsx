// Ported from design/system/components.js (components/forms/Radio.jsx): the row or card
// shell a choice control sits in. The indicator is passed in, so radios and anything
// else that behaves like one share this layout and its keyboard handling.
import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import { pressTransform, transition } from "../core/tokens";
import { useInteraction } from "../core/useInteraction";

export type ChoiceVariant = "row" | "card";

export interface ChoiceProps {
  variant?: ChoiceVariant;
  checked?: boolean;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  /** Drawn before the text in a row, after it in a card. */
  indicator: (hover: boolean) => ReactNode;
  style?: CSSProperties;
}

/** A card choice presses in less than a button, so a full-width card still feels still. */
const PRESS_SCALE = "0.985";

export function Choice({ variant = "row", checked, label, description, disabled, onClick, indicator, style }: ChoiceProps) {
  const { hover, pressed, bind } = useInteraction(!!disabled);
  const card = variant === "card";

  const activate = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled || (event.key !== " " && event.key !== "Enter")) return;
    event.preventDefault();
    onClick?.();
  };

  const text = label || description ? (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
      {label ? (
        <span style={{ font: `${card ? "600 " : "500 "}var(--text-base)/1.3 var(--font-body)`, color: "var(--text-primary)" }}>
          {label}
        </span>
      ) : null}
      {description ? <span style={{ font: "var(--type-body-sm)", color: "var(--text-tertiary)" }}>{description}</span> : null}
    </div>
  ) : null;

  return (
    <div
      role="radio"
      aria-checked={checked}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      onClick={disabled ? undefined : onClick}
      onKeyDown={activate}
      {...bind}
      style={{
        display: "flex",
        alignItems: description ? "flex-start" : "center",
        gap: 14,
        minHeight: card ? 60 : 48,
        padding: card ? "14px 16px" : "10px 0",
        borderRadius: card ? "var(--radius-md)" : 0,
        background: card
          ? checked ? "var(--accent-soft)" : hover ? "var(--surface-sunken)" : "var(--surface-card)"
          : "transparent",
        boxShadow: card
          ? checked ? "inset 0 0 0 1.5px var(--accent)" : "inset 0 0 0 1px var(--border-strong)"
          : "none",
        transform: pressTransform(pressed, PRESS_SCALE),
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        outline: "none",
        transition: transition(["background", "box-shadow", "transform"]),
        ...style,
      }}
    >
      {card ? null : indicator(hover)}
      {text}
      {card ? indicator(hover) : null}
    </div>
  );
}
